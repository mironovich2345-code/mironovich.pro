export class CareerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const SESSION_COOKIE = "career_test_session";
export const GATE_COOKIE = "career_test_gate";
export const UUID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const TERMS_VERSION = "2026-11-18-synthetic-1993-steps-v2";
export const syntheticEmail = (value: unknown): value is string =>
  typeof value === "string" &&
  /^demo-[a-z0-9-]{1,48}@example\.invalid$/.test(value);
export function sandboxVisible(env: NodeJS.ProcessEnv = process.env) {
  if (
    env.CAREER_SANDBOX_ENABLED !== "1" ||
    env.CAREER_ENVIRONMENT !== "synthetic-sandbox" ||
    env.CAREER_ONLY_SYNTHETIC !== "true"
  )
    return false;
  if (
    (
      env.RAILWAY_ENVIRONMENT_NAME ||
      env.RAILWAY_ENVIRONMENT ||
      ""
    ).toLowerCase() === "production"
  )
    return false;
  try {
    const u = new URL(env.CAREER_APP_ORIGIN || "");
    return (
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      u.pathname === "/" &&
      ((u.protocol === "http:" && u.hostname === "127.0.0.1") ||
        (u.protocol === "https:" && u.hostname.endsWith(".up.railway.app")))
    );
  } catch {
    return false;
  }
}
export function careerConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!sandboxVisible(env))
    throw new CareerError(404, "Тестовый контур закрыт");
  const origin = new URL(env.CAREER_APP_ORIGIN!).origin;
  let database: URL;
  try {
    database = new URL(env.CAREER_DATABASE_URL || "");
  } catch {
    throw new CareerError(503, "Не настроена отдельная тестовая БД");
  }
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    database.pathname.slice(1) !== env.CAREER_DATABASE_NAME ||
    !/^mironovich_career_test(?:_[a-z0-9]+)*$/.test(
      database.pathname.slice(1),
    ) ||
    database.host !== env.CAREER_DATABASE_HOST
  )
    throw new CareerError(503, "Недопустимая тестовая БД");
  if (
    !env.CAREER_SESSION_SECRET ||
    env.CAREER_SESSION_SECRET.length < 40 ||
    !env.CAREER_TESTER_SECRET ||
    env.CAREER_TESTER_SECRET.length < 32
  )
    throw new CareerError(503, "Не настроена защита тестового контура");
  const mode = env.CAREER_PAYMENT_MODE;
  if (mode !== "fixture" && mode !== "yookassa")
    throw new CareerError(503, "Не выбран тестовый платёжный режим");
  const local = new URL(origin).hostname === "127.0.0.1";
  if (mode === "fixture" && !local)
    throw new CareerError(503, "Симулятор допускается только локально");
  if (
    mode === "yookassa" &&
    (env.YOOKASSA_TEST_KEY_ROTATED !== "true" ||
      !/^test_[A-Za-z0-9_-]{16,}$/.test(env.YOOKASSA_TEST_SECRET_KEY || "") ||
      !/^\d{5,20}$/.test(env.YOOKASSA_SHOP_ID || ""))
  )
    throw new CareerError(503, "Не настроен перевыпущенный тестовый ключ");
  return {
    origin,
    local,
    databaseUrl: env.CAREER_DATABASE_URL!,
    sessionSecret: env.CAREER_SESSION_SECRET,
    testerSecret: env.CAREER_TESTER_SECRET,
    mode,
    keys: {
      shopId: env.YOOKASSA_SHOP_ID || "",
      secretKey: env.YOOKASSA_TEST_SECRET_KEY || "",
    },
  };
}
