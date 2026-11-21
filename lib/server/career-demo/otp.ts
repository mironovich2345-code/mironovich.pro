// Passwordless sign-in with a six-digit email code. Adapted from the CLUB-OPS model (src/lib/otp.ts,
// src/lib/login-challenge.ts), here as the FIRST and only factor:
//  - the code lives 10 minutes, at most 5 attempts, then the challenge is locked;
//  - resend only after 60 s and at most 5 sends per email per hour, plus per-IP and global limits;
//  - only an HMAC of the code is stored (key: CAREER_V3_OTP_SECRET, salted by the challenge token hash);
//    the browser holds an opaque challenge token in an HttpOnly cookie, the database only its HMAC;
//  - a challenge is consumed with a conditional update, so a code works once, even under concurrency;
//  - the first step answers the same way whether or not the email has an account (no enumeration).
// Existing accounts are found by email; the first successful code marks the email as confirmed.
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { CareerError } from "../career/config.ts";
import { careerPool, transaction } from "../career/db.ts";
import { createSession, demoLimit, normalizeCode, normalizeEmail, signupInvite } from "./auth.ts";
import { requireDemo, type DemoConfig } from "./config.ts";
import { sendCodeEmail } from "./mail.ts";

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_SENDS_PER_HOUR = 5;
/** After a correct code for an email without an account, the invite must follow within this window. */
const SIGNUP_WINDOW_MINUTES = 10;

const tokenMac = (c: DemoConfig, token: string) => createHmac("sha256", c.sessionSecret).update("login-challenge:" + token).digest("hex");
export const codeDigest = (secret: string, tokenHash: string, code: string) => createHmac("sha256", secret).update(tokenHash + ":" + code).digest("hex");
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
export const newOtp = () => Array.from({ length: 6 }, () => String(randomInt(10))).join("");
export const maskEmail = (email: string) => { const [l, d] = email.split("@"); return d ? `${l.slice(0, 1)}***@${d}` : "***"; };

function otpReady(c: DemoConfig) {
  if (!c.otpSecret || !c.mail) throw new CareerError(404, "Вход по коду недоступен");
  return c.otpSecret;
}

async function sendsLastHour(email: string): Promise<number> {
  const r = await careerPool().query(
    "SELECT coalesce(sum(send_count),0)::int AS n FROM career_login_challenges WHERE email=$1 AND last_sent_at > now() - interval '1 hour'", [email]);
  return r.rows[0].n;
}
async function cooldownLeft(email: string): Promise<number> {
  const r = await careerPool().query(
    "SELECT ceil(extract(epoch FROM max(resend_available_at) - now()))::int AS s FROM career_login_challenges WHERE email=$1 AND resend_available_at > now()", [email]);
  return Math.max(0, r.rows[0].s ?? 0);
}
const tooSoon = (s: number) => new CareerError(429, `Код уже отправлен. Новый можно запросить через ${s} с.`);
const hourly = () => new CareerError(429, "Слишком много запросов кода для этого адреса. Попробуйте через час.");

export interface Started { token: string; expiresAt: Date; maskedEmail: string; resendSeconds: number }

/** Step 1: email → code. Same answer for known and unknown addresses. */
export async function startOtp(emailInput: unknown, ip: string): Promise<Started> {
  const c = requireDemo();
  const secret = otpReady(c);
  // Protection against mass sending of codes to arbitrary addresses: per address (cooldown + 5/hour, below),
  // per IP (20/hour, 60/day) and for the whole service (300/hour, 1000/day).
  await demoLimit(c, "otp-start-global", 300, 3600);
  await demoLimit(c, "otp-start-global-day", 1000, 86400);
  await demoLimit(c, "otp-start-ip:" + ip, 20, 3600);
  await demoLimit(c, "otp-start-ip-day:" + ip, 60, 86400);
  const email = normalizeEmail(emailInput);
  if (!email) throw new CareerError(400, "Введите корректный email");
  const wait = await cooldownLeft(email);
  if (wait > 0) throw tooSoon(wait);
  if ((await sendsLastHour(email)) >= OTP_MAX_SENDS_PER_HOUR) throw hourly();

  const token = randomBytes(32).toString("hex");
  const tokenHash = tokenMac(c, token);
  const code = newOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
  const id = randomUUID();
  await transaction(async (tx) => {
    await tx.query("UPDATE career_login_challenges SET revoked_at=now(), revoked_reason='superseded' WHERE email=$1 AND consumed_at IS NULL AND revoked_at IS NULL", [email]);
    await tx.query(
      "INSERT INTO career_login_challenges(id,token_hash,email,code_digest,expires_at,resend_available_at) VALUES($1,$2,$3,$4,$5,now()+make_interval(secs=>$6))",
      [id, tokenHash, email, codeDigest(secret, tokenHash, code), expiresAt, OTP_RESEND_SECONDS]);
  });
  const sent = await sendCodeEmail(c, email, code, OTP_TTL_MINUTES);
  if (!sent.ok) {
    await careerPool().query("UPDATE career_login_challenges SET delivery_failed_at=now() WHERE id=$1", [id]);
    throw new CareerError(503, "Не удалось отправить письмо. Попробуйте ещё раз через минуту.");
  }
  return { token, expiresAt, maskedEmail: maskEmail(email), resendSeconds: OTP_RESEND_SECONDS };
}

interface ChallengeRow { id: string; token_hash: string; email: string; code_digest: string; expires_at: Date; attempts: number; verified_at: Date | null; consumed_at: Date | null; revoked_at: Date | null; revoked_reason: string | null }
async function challengeFor(c: DemoConfig, token: unknown): Promise<ChallengeRow | null> {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = await careerPool().query("SELECT * FROM career_login_challenges WHERE token_hash=$1", [tokenMac(c, token)]);
  return r.rows[0] ?? null;
}
const expired = () => new CareerError(410, "Срок действия кода истёк. Запросите новый код.");
const used = () => new CareerError(409, "Этот код уже использован. Запросите новый код.");
const locked = () => new CareerError(423, "Слишком много неверных попыток. Запросите новый код.");

/** A new code for the same challenge: the previous code stops working at once. */
export async function resendOtp(token: unknown, ip: string): Promise<{ expiresAt: Date; maskedEmail: string; resendSeconds: number }> {
  const c = requireDemo();
  const secret = otpReady(c);
  await demoLimit(c, "otp-resend-ip:" + ip, 20, 3600);
  const ch = await challengeFor(c, token);
  if (!ch || ch.revoked_at) throw expired();
  if (ch.consumed_at || ch.verified_at) throw used();
  const wait = await cooldownLeft(ch.email);
  if (wait > 0) throw tooSoon(wait);
  if ((await sendsLastHour(ch.email)) >= OTP_MAX_SENDS_PER_HOUR) throw hourly();
  const code = newOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
  const r = await careerPool().query(
    `UPDATE career_login_challenges SET code_digest=$2, expires_at=$3, attempts=0, resend_available_at=now()+make_interval(secs=>$4),
       last_sent_at=now(), send_count=send_count+1, delivery_failed_at=NULL
     WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL AND verified_at IS NULL AND send_count < 20`,
    [ch.id, codeDigest(secret, ch.token_hash, code), expiresAt, OTP_RESEND_SECONDS]);
  if (!r.rowCount) throw expired();
  const sent = await sendCodeEmail(c, ch.email, code, OTP_TTL_MINUTES);
  if (!sent.ok) {
    await careerPool().query("UPDATE career_login_challenges SET delivery_failed_at=now() WHERE id=$1", [ch.id]);
    throw new CareerError(503, "Не удалось отправить письмо. Попробуйте ещё раз через минуту.");
  }
  return { expiresAt, maskedEmail: maskEmail(ch.email), resendSeconds: OTP_RESEND_SECONDS };
}

export type Verified = { session: string } | { needInvite: true; maskedEmail: string };

/** Step 2: the code. Signs in an existing account; for a new email asks for an invite (closed contours). */
export async function verifyOtp(token: unknown, codeInput: unknown, ip: string): Promise<Verified> {
  const c = requireDemo();
  const secret = otpReady(c);
  await demoLimit(c, "otp-verify-ip:" + ip, 60, 900);
  const ch = await challengeFor(c, token);
  if (!ch) throw expired();
  if (ch.revoked_at) throw ch.revoked_reason === "locked" ? locked() : expired();
  if (ch.consumed_at || ch.verified_at) throw used();
  if (new Date(ch.expires_at).getTime() <= Date.now()) throw expired();
  if (ch.attempts >= OTP_MAX_ATTEMPTS) throw locked();
  const code = typeof codeInput === "string" ? codeInput.replace(/\s/g, "") : "";
  if (!/^\d{6}$/.test(code) || !same(codeDigest(secret, ch.token_hash, code), ch.code_digest)) {
    const r = await careerPool().query(
      `UPDATE career_login_challenges SET attempts=attempts+1,
         revoked_at=CASE WHEN attempts+1 >= $2 THEN now() END, revoked_reason=CASE WHEN attempts+1 >= $2 THEN 'locked' END
       WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL RETURNING attempts`, [ch.id, OTP_MAX_ATTEMPTS]);
    const n = r.rows[0]?.attempts ?? OTP_MAX_ATTEMPTS;
    if (n >= OTP_MAX_ATTEMPTS) throw locked();
    throw new CareerError(400, `Неверный код. Осталось попыток: ${OTP_MAX_ATTEMPTS - n}.`);
  }
  const outcome = await transaction(async (tx) => {
    // Replay-safe: only one request flips the challenge.
    const flip = await tx.query(
      "UPDATE career_login_challenges SET verified_at=now() WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL AND verified_at IS NULL AND expires_at > now() RETURNING email", [ch.id]);
    if (!flip.rowCount) return { error: "used" as const };
    const email = flip.rows[0].email as string;
    let user = (await tx.query("SELECT id FROM career_demo_users WHERE email=$1 FOR UPDATE", [email])).rows[0];
    if (!user) {
      const staff = (await tx.query("SELECT 1 FROM career_staff WHERE email=$1 AND revoked_at IS NULL", [email])).rowCount;
      // Closed contours need an invite; the commercial app opens an account (without access) for a confirmed email.
      if (!staff && c.signup === "invite") return { needInvite: true as const, email };
      if (!staff && (await tx.query("SELECT count(*)::int AS n FROM career_demo_users")).rows[0].n >= c.maxUsers) return { error: "full" as const };
      user = { id: await insertUser(tx, email, null) };
    }
    await tx.query("UPDATE career_login_challenges SET consumed_at=now() WHERE id=$1", [ch.id]);
    await tx.query(
      "UPDATE career_demo_users SET email_verified=true, email_verified_at=coalesce(email_verified_at,now()), last_login_at=now(), last_seen_at=now() WHERE id=$1", [user.id]);
    await tx.query("UPDATE career_login_challenges SET revoked_at=now(), revoked_reason='superseded' WHERE email=$1 AND id<>$2 AND consumed_at IS NULL AND revoked_at IS NULL", [email, ch.id]);
    return { session: await createSession(c, tx, user.id, "otp") };
  });
  if ("error" in outcome) throw outcome.error === "full" ? new CareerError(429, "Регистрация временно недоступна") : used();
  if ("needInvite" in outcome) return { needInvite: true, maskedEmail: maskEmail(outcome.email as string) };
  return { session: outcome.session as string };
}

/** Step 3 (new email in a closed contour): a one-time invite creates the account for the confirmed email. */
export async function completeSignup(token: unknown, inviteInput: unknown, ip: string): Promise<{ session: string }> {
  const c = requireDemo();
  otpReady(c);
  await demoLimit(c, "otp-signup-ip:" + ip, 10, 3600);
  const ch = await challengeFor(c, token);
  if (!ch || ch.revoked_at || ch.consumed_at || !ch.verified_at) throw expired();
  if (new Date(ch.verified_at).getTime() < Date.now() - SIGNUP_WINDOW_MINUTES * 60_000) throw expired();
  const invite = normalizeCode(inviteInput, 4);
  if (!invite) throw new CareerError(403, "Пригласительный код недействителен или уже использован");
  await demoLimit(c, "register-invite:" + invite, 5, 3600);
  const outcome = await transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext('career-demo-register'))");
    // A wrong invite must not spend the confirmed code: check everything before consuming the challenge.
    const inv = await signupInvite(c, tx, invite);
    if (!inv) return { error: "invite" as const };
    if ((await tx.query("SELECT count(*)::int AS n FROM career_demo_users")).rows[0].n >= c.maxUsers) return { error: "full" as const };
    const flip = await tx.query("UPDATE career_login_challenges SET consumed_at=now() WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL RETURNING email", [ch.id]);
    if (!flip.rowCount) return { error: "used" as const };
    const email = flip.rows[0].email as string;
    if ((await tx.query("SELECT 1 FROM career_demo_users WHERE email=$1", [email])).rowCount) throw new CareerError(409, "Аккаунт для этого email уже создан. Войдите по коду.");
    const userId = await insertUser(tx, email, { inviteHash: inv, accessDays: c.accessDays });
    return { session: await createSession(c, tx, userId, "otp") };
  });
  if ("error" in outcome) {
    if (outcome.error === "invite") throw new CareerError(403, "Пригласительный код недействителен или уже использован");
    if (outcome.error === "full") throw new CareerError(429, "Закрытый контур заполнен");
    throw used();
  }
  return outcome;
}

type Tx = { query: (q: string, a?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }> };
/** New account for a confirmed email. Invite → demo access for the invite's period; otherwise no access until a purchase. */
async function insertUser(tx: Tx, email: string, invite: { inviteHash: string; accessDays: number } | null): Promise<string> {
  const accountId = randomUUID(), userId = randomUUID();
  await tx.query("INSERT INTO career_accounts(id,email) VALUES($1,$2)", [accountId, `demo-${randomBytes(8).toString("hex")}@example.invalid`]);
  await tx.query(
    `INSERT INTO career_demo_users(id,account_id,email,email_verified,email_verified_at,password_hash,invite_hash,tester,access_until,last_login_at,last_seen_at)
     VALUES($1,$2,$3,true,now(),NULL,$4,$5,${invite ? "now()+make_interval(days=>$6)" : "NULL"},now(),now())`,
    invite ? [userId, accountId, email, invite.inviteHash, true, invite.accessDays] : [userId, accountId, email, null, false]);
  if (invite) await tx.query("UPDATE career_demo_invites SET used_at=now() WHERE code_hash=$1", [invite.inviteHash]);
  return userId;
}
