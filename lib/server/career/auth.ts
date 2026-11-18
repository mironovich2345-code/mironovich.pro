import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { careerPool, transaction, event } from "./db.ts";
import {
  careerConfig,
  CareerError,
  syntheticEmail,
  UUID_PATTERN,
} from "./config.ts";
import { sendCareerMail } from "./mail.ts";
export const digest = (value: string) =>
  createHmac("sha256", careerConfig().sessionSecret)
    .update(value)
    .digest("hex");
export const equal = (a: string, b: string) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export async function limit(key: string, max: number, seconds: number) {
  const slot = Math.floor(Date.now() / (seconds * 1000));
  const r = await careerPool().query(
    "INSERT INTO career_rate_buckets(bucket,count,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET count=career_rate_buckets.count+1 RETURNING count",
    [digest("rate:" + key + ":" + slot), new Date((slot + 1) * seconds * 1000)],
  );
  if (r.rows[0].count > max)
    throw new CareerError(429, "Слишком много попыток. Повторите позже.");
}
export async function admitTester(code: unknown, onlySynthetic: unknown) {
  await limit("tester-admission", 20, 3600);
  const c = careerConfig();
  if (
    typeof code !== "string" ||
    onlySynthetic !== true ||
    !equal(digest("gate:" + code), digest("gate:" + c.testerSecret))
  )
    throw new CareerError(403, "Доступ только для тестировщика");
  const body = `${Date.now() + 3600000}.${randomBytes(16).toString("hex")}`;
  return `${body}.${digest("gate-token:" + body)}`;
}
export function validGate(token: string | undefined) {
  if (!token || token.length > 180) return false;
  const p = token.split(".");
  if (
    p.length !== 3 ||
    !/^[a-f0-9]{64}$/.test(p[2]) ||
    !/^\d{13}$/.test(p[0]) ||
    !/^[a-f0-9]{32}$/.test(p[1])
  )
    return false;
  const until = Number(p[0]);
  return (
    until > Date.now() &&
    until < Date.now() + 3601000 &&
    equal(p[2], digest("gate-token:" + p[0] + "." + p[1]))
  );
}
export async function requestOtp(email: unknown) {
  if (!syntheticEmail(email))
    throw new CareerError(
      400,
      "Допустим только учебный адрес demo-…@example.invalid",
    );
  await limit("otp-global", 40, 3600);
  await limit("otp:" + email, 3, 3600);
  const id = randomUUID(),
    code = String(randomInt(0, 1000000)).padStart(6, "0");
  await transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [email]);
    const last = await tx.query(
      "SELECT created_at FROM career_otp WHERE email=$1 ORDER BY created_at DESC LIMIT 1",
      [email],
    );
    if (
      last.rows[0] &&
      Date.now() - new Date(last.rows[0].created_at).getTime() < 60000
    )
      throw new CareerError(429, "Новый код можно запросить через минуту");
    await tx.query(
      "UPDATE career_otp SET consumed_at=now() WHERE email=$1 AND consumed_at IS NULL",
      [email],
    );
    await tx.query(
      "INSERT INTO career_otp(id,email,code_hash,expires_at) VALUES($1,$2,$3,$4)",
      [
        id,
        email,
        digest("otp:" + id + ":" + code),
        new Date(Date.now() + 300000),
      ],
    );
  });
  try {
    await sendCareerMail(
      email,
      "Одноразовый код входа",
      `Ваш учебный код: ${code}\nOTP_CODE ${code}\nДействует 5 минут. Не сообщайте его другим людям.`,
    );
  } catch {
    await careerPool().query(
      "UPDATE career_otp SET consumed_at=now() WHERE id=$1",
      [id],
    );
    throw new CareerError(
      503,
      "Тестовое письмо не отправлено. Почта ещё не готова.",
    );
  }
  return { challengeId: id, expiresIn: 300 };
}
export async function verifyOtp(id: unknown, code: unknown) {
  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    typeof code !== "string" ||
    !/^\d{6}$/.test(code)
  )
    throw new CareerError(400, "Неверный код или запрос");
  await limit("verify:" + id, 10, 300);
  const token = randomBytes(32).toString("hex");
  const outcome = await transaction(async (tx) => {
    const r = await tx.query(
      "SELECT * FROM career_otp WHERE id=$1 FOR UPDATE",
      [id],
    );
    const otp = r.rows[0];
    if (
      !otp ||
      otp.consumed_at ||
      new Date(otp.expires_at).getTime() <= Date.now() ||
      otp.attempts >= 5
    )
      return { error: true };
    const matches = equal(otp.code_hash, digest("otp:" + id + ":" + code));
    await tx.query(
      "UPDATE career_otp SET attempts=attempts+1,consumed_at=CASE WHEN $2 OR attempts+1>=5 THEN now() ELSE consumed_at END WHERE id=$1",
      [id, matches],
    );
    if (!matches) return { error: true };
    await tx.query("SELECT pg_advisory_xact_lock(391045182)");
    const existing = await tx.query(
      "SELECT id FROM career_accounts WHERE email=$1",
      [otp.email],
    );
    if (
      !existing.rowCount &&
      (await tx.query("SELECT count(*)::int AS n FROM career_accounts")).rows[0]
        .n >= 30
    )
      return { capacity: true };
    const a = await tx.query(
      "INSERT INTO career_accounts(id,email) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id",
      [randomUUID(), otp.email],
    );
    await tx.query(
      "INSERT INTO career_sessions(token_hash,account_id,expires_at) VALUES($1,$2,$3)",
      [
        digest("session:" + token),
        a.rows[0].id,
        new Date(Date.now() + 12 * 3600000),
      ],
    );
    await event("login_success", a.rows[0].id, null, tx);
    return { ok: true };
  });
  if ("capacity" in outcome)
    throw new CareerError(429, "Тестовый контур заполнен");
  if ("error" in outcome)
    throw new CareerError(400, "Код неверен, истёк или уже использован");
  return token;
}
export async function sessionAccount(
  token: string | undefined,
): Promise<string | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = await careerPool().query(
    "SELECT account_id FROM career_sessions WHERE token_hash=$1 AND expires_at>now() AND revoked_at IS NULL",
    [digest("session:" + token)],
  );
  return r.rows[0]?.account_id || null;
}
export async function logout(token: string | undefined) {
  if (token)
    await careerPool().query(
      "UPDATE career_sessions SET revoked_at=now() WHERE token_hash=$1",
      [digest("session:" + token)],
    );
}
