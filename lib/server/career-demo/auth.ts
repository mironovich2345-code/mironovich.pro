// Email + password accounts for the closed cloud demo. Invite-only registration, scrypt password hashes
// (memory-hard, equivalent class to Argon2id; Node 22 has no built-in Argon2), server-side sessions stored
// only as HMAC digests, rate limits on every credential endpoint. Passwords, invite and recovery codes are
// never logged, never returned after creation and never stored in the clear.
import { createHmac, randomBytes, randomInt, randomUUID, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { CareerError } from "../career/config.ts";
import { careerPool, transaction } from "../career/db.ts";
import { requireDemo, type DemoConfig } from "./config.ts";

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, keylen, options, (e, key) => (e ? reject(e) : resolve(key))));

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_HOURS = 24 * 7;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, 32, SCRYPT);
  return `scrypt$${Math.log2(SCRYPT.N)}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const m = /^scrypt\$(\d{2})\$(\d{1,2})\$(\d)\$([A-Za-z0-9+/=]{24})\$([A-Za-z0-9+/=]{44})$/.exec(stored);
  if (!m || Number(m[1]) > 17) return false;
  const expected = Buffer.from(m[5], "base64");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(m[4], "base64"), expected.length, {
    N: 2 ** Number(m[1]), r: Number(m[2]), p: Number(m[3]), maxmem: SCRYPT.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
/** A valid hash of a random string: compared against when the email is unknown, so timing does not reveal accounts. */
let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword(randomBytes(24).toString("hex")));

const mac = (c: DemoConfig, purpose: string, value: string) => createHmac("sha256", c.sessionSecret).update(purpose + ":" + value).digest("hex");
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

/** One-time code in groups of four from an alphabet without look-alike characters (5 bits per character). */
export function newCode(groups: number): string {
  return Array.from({ length: groups }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")).join("-");
}
export function normalizeCode(value: unknown, groups: number): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const raw = value.toUpperCase().replace(/[\s-]/g, "");
  if (raw.length !== groups * 4 || [...raw].some((ch) => !ALPHABET.includes(ch))) return null;
  return raw.match(/.{4}/g)!.join("-");
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const e = value.trim().toLowerCase();
  if (e.length < 6 || e.length > 254 || !/^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/.test(e)) return null;
  return e;
}

export function passwordProblem(password: unknown, confirm: unknown, email: string): string | null {
  if (typeof password !== "string" || typeof confirm !== "string") return "Введите пароль и его подтверждение";
  if (password.length < PASSWORD_MIN) return `Пароль должен быть не короче ${PASSWORD_MIN} символов`;
  if (password.length > PASSWORD_MAX) return `Пароль должен быть не длиннее ${PASSWORD_MAX} символов`;
  if (password !== confirm) return "Пароль и подтверждение не совпадают";
  if (password.toLowerCase().includes(email.split("@")[0]) && email.split("@")[0].length >= 4) return "Пароль не должен содержать email";
  if (new Set(password).size < 4) return "Пароль слишком простой";
  return null;
}

/** Fixed-window counter in the shared career_rate_buckets table; keys are HMAC digests (no emails or IPs stored). */
export async function demoLimit(c: DemoConfig, key: string, max: number, seconds: number) {
  const slot = Math.floor(Date.now() / (seconds * 1000));
  const r = await careerPool().query(
    "INSERT INTO career_rate_buckets(bucket,count,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET count=career_rate_buckets.count+1 RETURNING count",
    [mac(c, "rate", key + ":" + seconds + ":" + slot), new Date((slot + 1) * seconds * 1000)],
  );
  if (r.rows[0].count > max) throw new CareerError(429, "Слишком много попыток. Подождите и попробуйте снова.");
}

async function newSession(c: DemoConfig, tx: { query: (q: string, a?: unknown[]) => Promise<unknown> }, userId: string) {
  const token = randomBytes(32).toString("hex");
  await tx.query("INSERT INTO career_demo_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
    [mac(c, "session", token), userId, new Date(Date.now() + SESSION_HOURS * 3600000)]);
  return token;
}

export interface RegisterInput { email: unknown; password: unknown; passwordConfirm: unknown; invite: unknown; ip: string }

export async function registerDemoUser(input: RegisterInput) {
  const c = requireDemo();
  await demoLimit(c, "register-global", 40, 3600);
  await demoLimit(c, "register-ip:" + input.ip, 10, 3600);
  const email = normalizeEmail(input.email);
  if (!email) throw new CareerError(400, "Введите корректный email");
  const problem = passwordProblem(input.password, input.passwordConfirm, email);
  if (problem) throw new CareerError(400, problem);
  const invite = normalizeCode(input.invite, 4);
  if (!invite) throw new CareerError(403, "Пригласительный код недействителен или уже использован");
  await demoLimit(c, "register-invite:" + invite, 5, 3600);
  const passwordHash = await hashPassword(input.password as string);
  const recoveryCode = newCode(5);
  const outcome = await transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('career-demo-register'))");
    const inv = await tx.query("SELECT code_hash FROM career_demo_invites WHERE code_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE",
      [mac(c, "invite", invite)]);
    if (!inv.rowCount) return { error: "invite" as const };
    if ((await tx.query("SELECT 1 FROM career_demo_users WHERE email=$1", [email])).rowCount) return { error: "exists" as const };
    if ((await tx.query("SELECT count(*)::int AS n FROM career_demo_users")).rows[0].n >= c.maxUsers) return { error: "full" as const };
    const accountId = randomUUID(), userId = randomUUID();
    // Synthetic alias keeps the v2 table constraint (no real addresses in career_accounts).
    await tx.query("INSERT INTO career_accounts(id,email) VALUES($1,$2)", [accountId, `demo-${randomBytes(8).toString("hex")}@example.invalid`]);
    await tx.query(
      "INSERT INTO career_demo_users(id,account_id,email,password_hash,recovery_hash,invite_hash,access_until,last_login_at) VALUES($1,$2,$3,$4,$5,$6,now()+make_interval(days=>$7),now())",
      [userId, accountId, email, passwordHash, mac(c, "recovery", recoveryCode), inv.rows[0].code_hash, c.accessDays]);
    await tx.query("UPDATE career_demo_invites SET used_at=now() WHERE code_hash=$1", [inv.rows[0].code_hash]);
    return { token: await newSession(c, tx, userId) };
  });
  if ("error" in outcome) {
    if (outcome.error === "exists") throw new CareerError(409, "Этот email уже зарегистрирован. Войдите или восстановите пароль.");
    if (outcome.error === "full") throw new CareerError(429, "Демонстрационный контур заполнен");
    throw new CareerError(403, "Пригласительный код недействителен или уже использован");
  }
  return { token: outcome.token, recoveryCode };
}

export async function loginDemoUser(emailInput: unknown, password: unknown, ip: string) {
  const c = requireDemo();
  await demoLimit(c, "login-global", 300, 3600);
  await demoLimit(c, "login-ip:" + ip, 30, 900);
  const email = normalizeEmail(emailInput);
  if (!email || typeof password !== "string" || !password || password.length > PASSWORD_MAX) throw new CareerError(400, "Неверный email или пароль");
  await demoLimit(c, "login-email:" + email, 8, 900);
  const r = await careerPool().query("SELECT id,password_hash,access_until FROM career_demo_users WHERE email=$1", [email]);
  const user = r.rows[0];
  const ok = await verifyPassword(password, user?.password_hash ?? (await dummy()));
  if (!user || !ok) throw new CareerError(401, "Неверный email или пароль");
  if (new Date(user.access_until).getTime() <= Date.now()) throw new CareerError(403, "Срок демонстрационного доступа истёк");
  return transaction(async (tx) => {
    await tx.query("UPDATE career_demo_users SET last_login_at=now() WHERE id=$1", [user.id]);
    return newSession(c, tx, user.id);
  });
}

export interface DemoUser { userId: string; accountId: string; email: string; accessUntil: string; createdAt: string }

export async function demoSessionUser(token: string | undefined): Promise<DemoUser | null> {
  const c = requireDemo();
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = await careerPool().query(
    `SELECT u.id,u.account_id,u.email,u.access_until,u.created_at FROM career_demo_sessions s JOIN career_demo_users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND s.revoked_at IS NULL AND u.tester AND u.access_until>now()`, [mac(c, "session", token)]);
  const u = r.rows[0];
  return u ? { userId: u.id, accountId: u.account_id, email: u.email, accessUntil: new Date(u.access_until).toISOString(), createdAt: new Date(u.created_at).toISOString() } : null;
}

export async function logoutDemo(token: string | undefined) {
  const c = requireDemo();
  if (token && /^[a-f0-9]{64}$/.test(token))
    await careerPool().query("UPDATE career_demo_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL", [mac(c, "session", token)]);
}

/** Self-service reset with the recovery code shown once at registration, or with a one-time reset code that
 *  the demo operator issues after confirming the person out of band. Revokes every session; rotates the recovery code. */
export async function recoverDemoPassword(input: { email: unknown; code: unknown; password: unknown; passwordConfirm: unknown; ip: string }) {
  const c = requireDemo();
  await demoLimit(c, "recover-ip:" + input.ip, 10, 3600);
  const email = normalizeEmail(input.email);
  if (!email) throw new CareerError(400, "Неверный email или код восстановления");
  await demoLimit(c, "recover-email:" + email, 5, 3600);
  const problem = passwordProblem(input.password, input.passwordConfirm, email);
  if (problem) throw new CareerError(400, problem);
  const recovery = normalizeCode(input.code, 5);
  const reset = normalizeCode(input.code, 4);
  if (!recovery && !reset) throw new CareerError(400, "Неверный email или код восстановления");
  const passwordHash = await hashPassword(input.password as string);
  const nextRecovery = newCode(5);
  const ok = await transaction(async (tx) => {
    const r = await tx.query("SELECT id,recovery_hash,reset_hash,reset_expires_at FROM career_demo_users WHERE email=$1 FOR UPDATE", [email]);
    const u = r.rows[0];
    if (!u) return false;
    const byRecovery = !!recovery && !!u.recovery_hash && same(u.recovery_hash, mac(c, "recovery", recovery));
    const byReset = !!reset && !!u.reset_hash && new Date(u.reset_expires_at).getTime() > Date.now() && same(u.reset_hash, mac(c, "reset", reset));
    if (!byRecovery && !byReset) return false;
    await tx.query("UPDATE career_demo_users SET password_hash=$2,recovery_hash=$3,reset_hash=NULL,reset_expires_at=NULL WHERE id=$1",
      [u.id, passwordHash, mac(c, "recovery", nextRecovery)]);
    await tx.query("UPDATE career_demo_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [u.id]);
    return true;
  });
  if (!ok) throw new CareerError(400, "Неверный email или код восстановления");
  return { recoveryCode: nextRecovery };
}

/** Deletes the account and everything stored for it (diagnostic, route, progress, measurements, sessions). */
export async function deleteDemoAccount(user: DemoUser, password: unknown) {
  const c = requireDemo();
  await demoLimit(c, "delete:" + user.userId, 5, 900);
  if (typeof password !== "string" || password.length > PASSWORD_MAX) throw new CareerError(400, "Введите пароль");
  const r = await careerPool().query("SELECT password_hash FROM career_demo_users WHERE id=$1", [user.userId]);
  if (!r.rows[0] || !(await verifyPassword(password, r.rows[0].password_hash))) throw new CareerError(401, "Неверный пароль");
  await purgeAccount(user.accountId);
}

export async function purgeAccount(accountId: string) {
  await transaction(async (tx) => {
    await tx.query("DELETE FROM career_events WHERE account_id=$1", [accountId]);
    await tx.query("DELETE FROM career_accounts WHERE id=$1", [accountId]); // cascades to the demo user, sessions and all v3 data
  });
}

// ——— operator commands (scripts/career/demo-admin.mjs); codes are printed once to the operator's terminal ———
export async function createInvite(label = "", days = 14) {
  const c = requireDemo();
  if (!/^[A-Za-z0-9 _.-]{0,40}$/.test(label) || !Number.isInteger(days) || days < 1 || days > 30) throw new Error("bad invite arguments");
  const code = newCode(4);
  await careerPool().query("INSERT INTO career_demo_invites(code_hash,label,expires_at) VALUES($1,$2,now()+make_interval(days=>$3))", [mac(c, "invite", code), label, days]);
  return code;
}
export async function issueResetCode(emailInput: string) {
  const c = requireDemo();
  const email = normalizeEmail(emailInput);
  const code = newCode(4);
  const r = await careerPool().query("UPDATE career_demo_users SET reset_hash=$2,reset_expires_at=now()+interval '1 hour' WHERE email=$1", [email, mac(c, "reset", code)]);
  return r.rowCount ? code : null;
}
export async function deleteByEmail(emailInput: string) {
  requireDemo();
  const r = await careerPool().query("SELECT account_id FROM career_demo_users WHERE email=$1", [normalizeEmail(emailInput)]);
  if (!r.rows[0]) return false;
  await purgeAccount(r.rows[0].account_id);
  return true;
}
/** Retention: accounts are removed 7 days after demo access ends; spent invites, sessions and counters are cleaned. */
export async function purgeExpired() {
  requireDemo();
  const expired = await careerPool().query("SELECT account_id FROM career_demo_users WHERE access_until < now()-interval '7 days'");
  for (const row of expired.rows) await purgeAccount(row.account_id);
  await careerPool().query("DELETE FROM career_demo_sessions WHERE expires_at<now() OR revoked_at IS NOT NULL");
  await careerPool().query("DELETE FROM career_demo_invites WHERE expires_at < now()-interval '30 days' AND code_hash NOT IN (SELECT invite_hash FROM career_demo_users WHERE invite_hash IS NOT NULL)");
  await careerPool().query("DELETE FROM career_rate_buckets WHERE expires_at<now()");
  return { accountsRemoved: expired.rowCount ?? 0 };
}
export async function demoStatus() {
  requireDemo();
  const q = async (sql: string) => (await careerPool().query(sql)).rows[0].n as number;
  return {
    users: await q("SELECT count(*)::int AS n FROM career_demo_users"),
    activeUsers: await q("SELECT count(*)::int AS n FROM career_demo_users WHERE access_until>now()"),
    openInvites: await q("SELECT count(*)::int AS n FROM career_demo_invites WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at>now()"),
    activeSessions: await q("SELECT count(*)::int AS n FROM career_demo_sessions WHERE revoked_at IS NULL AND expires_at>now()"),
  };
}
export async function revokeOpenInvites() {
  requireDemo();
  return (await careerPool().query("UPDATE career_demo_invites SET revoked_at=now() WHERE used_at IS NULL AND revoked_at IS NULL")).rowCount ?? 0;
}
