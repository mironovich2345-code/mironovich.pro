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

type TxLike = { query: (q: string, a?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }> };
/** Server-side session: the browser gets a random token, the database keeps only its HMAC. */
export async function createSession(c: DemoConfig, tx: TxLike, userId: string, method: "password" | "otp") {
  const token = randomBytes(32).toString("hex");
  await tx.query("INSERT INTO career_demo_sessions(token_hash,user_id,expires_at,auth_method) VALUES($1,$2,$3,$4)",
    [mac(c, "session", token), userId, new Date(Date.now() + SESSION_HOURS * 3600000), method]);
  return token;
}
const newSession = (c: DemoConfig, tx: TxLike, userId: string) => createSession(c, tx, userId, "password");
/** Locks and returns a usable invite's digest, or null. */
export async function signupInvite(c: DemoConfig, tx: TxLike, invite: string): Promise<string | null> {
  const inv = await tx.query("SELECT code_hash FROM career_demo_invites WHERE code_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE",
    [mac(c, "invite", invite)]);
  return inv.rowCount ? (inv.rows[0].code_hash as string) : null;
}
const passwordOnly = (c: DemoConfig) => { if (!c.passwordLogin) throw new CareerError(404, "Вход по паролю отключён: войдите по коду из письма"); };

export interface RegisterInput { email: unknown; password: unknown; passwordConfirm: unknown; invite: unknown; ip: string }

export async function registerDemoUser(input: RegisterInput) {
  const c = requireDemo();
  passwordOnly(c);
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
  passwordOnly(c);
  await demoLimit(c, "login-global", 300, 3600);
  await demoLimit(c, "login-ip:" + ip, 30, 900);
  const email = normalizeEmail(emailInput);
  if (!email || typeof password !== "string" || !password || password.length > PASSWORD_MAX) throw new CareerError(400, "Неверный email или пароль");
  await demoLimit(c, "login-email:" + email, 8, 900);
  const r = await careerPool().query("SELECT id,password_hash,access_until FROM career_demo_users WHERE email=$1", [email]);
  const user = r.rows[0];
  const ok = await verifyPassword(password, user?.password_hash ?? (await dummy()));
  if (!user || !ok) throw new CareerError(401, "Неверный email или пароль");
  if (!user.access_until || new Date(user.access_until).getTime() <= Date.now()) throw new CareerError(403, "Срок демонстрационного доступа истёк");
  return transaction(async (tx) => {
    await tx.query("UPDATE career_demo_users SET last_login_at=now() WHERE id=$1", [user.id]);
    return newSession(c, tx, user.id);
  });
}

export interface DemoUser {
  userId: string; accountId: string; email: string; emailVerified: boolean; createdAt: string;
  /** Latest end of access: invite access or a paid grant; null = no access (sign-in still works, the cabinet asks to buy). */
  accessUntil: string | null;
  hasAccess: boolean;
  authMethod: "password" | "otp";
  /** Admin = active staff row for this email AND a session opened with an email code for a confirmed email. Server-only. */
  isAdmin: boolean;
}

export async function demoSessionUser(token: string | undefined): Promise<DemoUser | null> {
  const c = requireDemo();
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = await careerPool().query(
    `SELECT u.id,u.account_id,u.email,u.email_verified,u.created_at,s.auth_method,
            greatest(CASE WHEN u.tester THEN u.access_until END,
                     (SELECT max(g.expires_at) FROM career_access_grants g WHERE g.account_id=u.account_id AND g.revoked_at IS NULL)) AS access_until,
            EXISTS (SELECT 1 FROM career_staff st WHERE st.email=u.email AND st.revoked_at IS NULL) AS staff,
            (u.last_seen_at IS NULL OR u.last_seen_at < now() - interval '5 minutes') AS stale
       FROM career_demo_sessions s JOIN career_demo_users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>now() AND s.revoked_at IS NULL`, [mac(c, "session", token)]);
  const u = r.rows[0];
  if (!u) return null;
  if (u.stale) await careerPool().query("UPDATE career_demo_users SET last_seen_at=now() WHERE id=$1", [u.id]);
  const until = u.access_until ? new Date(u.access_until) : null;
  return {
    userId: u.id, accountId: u.account_id, email: u.email, emailVerified: u.email_verified, createdAt: new Date(u.created_at).toISOString(),
    accessUntil: until ? until.toISOString() : null, hasAccess: !!until && until.getTime() > Date.now(),
    authMethod: u.auth_method, isAdmin: !!u.staff && u.auth_method === "otp" && !!u.email_verified,
  };
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

/** Deletes the account and everything stored for it (diagnostic, route, progress, measurements, sessions).
 *  Password accounts confirm with the password; code-only accounts retype their email in a session opened with a code. */
export async function deleteDemoAccount(user: DemoUser, password: unknown, emailConfirm?: unknown) {
  const c = requireDemo();
  await demoLimit(c, "delete:" + user.userId, 5, 900);
  const r = await careerPool().query("SELECT password_hash FROM career_demo_users WHERE id=$1", [user.userId]);
  if (!r.rows[0]) throw new CareerError(401, "Войдите снова");
  if (r.rows[0].password_hash && user.authMethod === "password") {
    if (typeof password !== "string" || password.length > PASSWORD_MAX) throw new CareerError(400, "Введите пароль");
    if (!(await verifyPassword(password, r.rows[0].password_hash))) throw new CareerError(401, "Неверный пароль");
  } else if (user.authMethod !== "otp" || normalizeEmail(emailConfirm) !== user.email) {
    throw new CareerError(400, "Введите свой email, чтобы подтвердить удаление");
  }
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
/** One-time bootstrap invite from the Railway variable CAREER_V3_DEMO_BOOTSTRAP_INVITE (set by the operator, readable
 *  only by people with access to the Railway project). Inserted once as an HMAC digest; a code that already exists —
 *  unused, used or revoked — is never re-activated, so a restart cannot revive a spent invite. Never logs the code. */
export async function ensureBootstrapInvite(raw: string | undefined): Promise<"absent" | "invalid" | "added" | "exists"> {
  const c = requireDemo();
  if (!raw) return "absent";
  const code = normalizeCode(raw, 4);
  if (!code) return "invalid";
  const r = await careerPool().query(
    "INSERT INTO career_demo_invites(code_hash,label,expires_at) VALUES($1,'bootstrap',now()+interval '7 days') ON CONFLICT (code_hash) DO NOTHING",
    [mac(c, "invite", code)]);
  return r.rowCount ? "added" : "exists";
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
  // Only invite (demo) access expires into deletion; accounts with purchases or without access are kept.
  const expired = await careerPool().query(
    `SELECT u.account_id FROM career_demo_users u WHERE u.tester AND u.access_until < now()-interval '7 days'
       AND NOT EXISTS (SELECT 1 FROM career_shop_orders o WHERE o.account_id=u.account_id)
       AND NOT EXISTS (SELECT 1 FROM career_staff st WHERE st.email=u.email AND st.revoked_at IS NULL)`);
  for (const row of expired.rows) await purgeAccount(row.account_id);
  await careerPool().query("DELETE FROM career_demo_sessions WHERE expires_at<now() OR revoked_at IS NOT NULL");
  await careerPool().query("DELETE FROM career_demo_invites WHERE expires_at < now()-interval '30 days' AND code_hash NOT IN (SELECT invite_hash FROM career_demo_users WHERE invite_hash IS NOT NULL)");
  await careerPool().query("DELETE FROM career_rate_buckets WHERE expires_at<now()");
  await careerPool().query("DELETE FROM career_login_challenges WHERE created_at < now()-interval '1 day'");
  await careerPool().query("DELETE FROM career_mail_preview WHERE expires_at < now()");
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

/** Admin role: granted only here (operator terminal or the bootstrap variable at migrate), never through the browser. */
export async function grantAdmin(emailInput: string, by: "bootstrap" | "operator") {
  requireDemo();
  const email = normalizeEmail(emailInput);
  if (!email) throw new Error("bad email");
  await careerPool().query(
    "INSERT INTO career_staff(email,role,granted_by) VALUES($1,'admin',$2) ON CONFLICT (email) DO UPDATE SET revoked_at=NULL", [email, by]);
  return email;
}
export async function revokeAdmin(emailInput: string) {
  requireDemo();
  const r = await careerPool().query("UPDATE career_staff SET revoked_at=now() WHERE email=$1 AND revoked_at IS NULL", [normalizeEmail(emailInput)]);
  return (r.rowCount ?? 0) > 0;
}
/** CAREER_V3_ADMIN_EMAILS: comma-separated, applied at migrate. Adds only; removal is an explicit operator command. */
export async function ensureBootstrapAdmins(raw: string | undefined): Promise<number> {
  if (!raw?.trim()) return 0;
  let n = 0;
  for (const part of raw.split(",")) if (normalizeEmail(part)) { await grantAdmin(part, "bootstrap"); n++; }
  return n;
}
