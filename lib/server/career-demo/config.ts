// Closed cloud contours of AI Career 3.0 — explicitly allow-listed configurations, separate from the
// synthetic v2 sandbox. demoConfig() returns null (closed) unless EVERY check passes; any configuration
// error closes the contour instead of opening a weaker mode. The checks below are hard-coded on purpose:
// environment variables can only *select* a profile, they cannot widen what is allowed.
//
// Two profiles share the code but never a database:
//  - closed-demo  — the running invite-only demo (password sign-in kept for its existing accounts; email codes
//                   only when mail is configured). Commerce is forbidden there.
//  - stage1       — the stage-1 commercial preview: passwordless email-code sign-in, admin cabinet, price
//                   modes and the Robokassa TEST integration. Separate Railway environment, service and database.
//
// Cloud (Railway):  CAREER_V3_DEMO=1, project/environment/service names equal to the profile constants,
//                   https origin on the service's own *.up.railway.app domain, database name exactly the
//                   profile's, strong secrets, and NO v2 sandbox / live payment / external AI variables.
// Local (tests):    CAREER_V3_DEMO=1 + CAREER_V3_DEMO_LOCAL=1, http://127.0.0.1 origin, no RAILWAY_* variables.
import { CareerError } from "../career/config.ts";

export const DEMO_RAILWAY_PROJECT = "mironovich-career-cloud-demo";
export const DEMO_RAILWAY_ENVIRONMENT = "ai-career-v3-closed-demo";
export const DEMO_RAILWAY_SERVICE = "ai-career-v3-demo";
export const DEMO_DATABASE_NAME = "mironovich_career_demo_v3";
/** Session setting a migration needs to run on a contour database (see migrations/career/*.sql guards). */
export const DEMO_MIGRATION_SETTING = "mironovich.career_demo";
export const DEMO_MIGRATION_VALUE = "closed-demo-v3";
export const DEMO_SESSION_COOKIE_SECURE = "__Host-career_demo_session";
export const DEMO_SESSION_COOKIE_LOCAL = "career_demo_session";
export const LOGIN_COOKIE_SECURE = "__Host-career_login";
export const LOGIN_COOKIE_LOCAL = "career_login";
export const DEMO_BANNER =
  "Демонстрационная версия. Учебные материалы находятся на проверке. Используйте только вымышленные данные";
export const STAGE1_BANNER =
  "Закрытое превью этапа 1. Оплата только тестовая, без списаний. Используйте вымышленные данные";

export type DemoProfile = "closed-demo" | "stage1";
interface ProfileSpec { project: string; environment: string; service: string; database: string; migration: string }
/** Each profile lives in its own Railway project: the stage-1 preview cannot reach the closed demo's services or data. */
export const PROFILES: Record<DemoProfile, ProfileSpec> = {
  "closed-demo": { project: DEMO_RAILWAY_PROJECT, environment: DEMO_RAILWAY_ENVIRONMENT, service: DEMO_RAILWAY_SERVICE, database: DEMO_DATABASE_NAME, migration: DEMO_MIGRATION_VALUE },
  stage1: { project: "mironovich-career-stage1", environment: "ai-career-stage1-preview", service: "ai-career-stage1", database: "mironovich_career_stage1", migration: "stage1-preview" },
};
/** The only sender address the product may use. */
export const MAIL_FROM_ADDRESS = "info@mironovich.pro";

/** Variables that belong to other contours. Their presence closes the contour (no mixing of modes). */
const FORBIDDEN = [
  "CAREER_SANDBOX_ENABLED", "CAREER_PAYMENT_MODE", "YOOKASSA_SHOP_ID", "YOOKASSA_TEST_SECRET_KEY", "YOOKASSA_SECRET_KEY",
  "CAREER_MAIL_MODE", "CAREER_SMTP_URL", "CAREER_AI_MODE", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
  "CAREER_V3_FIXTURE_LIBRARY", "CAREER_V3_REVIEW_PREVIEW", "LEGAL_PREVIEW",
  // Live Robokassa credentials are never accepted at stage 1: only the separate TEST pair is.
  "ROBOKASSA_PASSWORD1", "ROBOKASSA_PASSWORD2", "ROBOKASSA_PASSWORD3", "CAREER_V3_ROBOKASSA_PASSWORD1", "CAREER_V3_ROBOKASSA_PASSWORD2",
];
const COMMERCE_VARS = ["CAREER_V3_ROBOKASSA", "CAREER_V3_ROBOKASSA_LOGIN", "CAREER_V3_ROBOKASSA_TEST_PASSWORD1", "CAREER_V3_ROBOKASSA_TEST_PASSWORD2", "CAREER_V3_ROBOKASSA_HASH", "CAREER_V3_ROBOKASSA_RECEIPT"];
export const ROBOKASSA_HASHES = ["md5", "sha1", "sha256", "sha384", "sha512"] as const;
export type RobokassaHash = (typeof ROBOKASSA_HASHES)[number];

export type MailConfig =
  | { mode: "smtp"; host: string; port: number; secure: boolean; user: string; password: string; from: string }
  | { mode: "preview-outbox"; key: string };
export type RobokassaConfig = { mode: "test" | "emulator"; merchantLogin: string; password1: string; password2: string; hash: RobokassaHash; receipt: boolean };

export interface DemoConfig {
  origin: string;
  host: string;
  local: boolean;
  databaseUrl: string;
  sessionSecret: string;
  cookieName: string;
  accessDays: number;
  maxUsers: number;
  profile: DemoProfile;
  databaseName: string;
  migrationValue: string;
  loginCookieName: string;
  /** Password sign-in for accounts created before email codes (closed demo only). */
  passwordLogin: boolean;
  /** HMAC key for email codes; null = email codes are off (closed demo without mail). */
  otpSecret: string | null;
  mail: MailConfig | null;
  /** Commerce (orders, price modes, Robokassa TEST) — stage-1 profile only. */
  commerce: { robokassa: RobokassaConfig | null; paidAccessDays: number; reservationMinutes: number } | null;
  banner: string;
}

const norm = (v: string | undefined) => (v ?? "").trim();

/** Why the demo is closed (no secret values). Empty list = the demo configuration is valid. */
export function demoProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const problems: string[] = [];
  if (env.CAREER_V3_DEMO !== "1") return ["CAREER_V3_DEMO не равен 1"];
  const profileName = norm(env.CAREER_V3_DEMO_PROFILE) || "closed-demo";
  if (!(profileName in PROFILES)) return ["CAREER_V3_DEMO_PROFILE должен быть closed-demo или stage1"];
  const profile = profileName as DemoProfile;
  const spec = PROFILES[profile];
  for (const k of FORBIDDEN) if (norm(env[k])) problems.push(`задана посторонняя переменная ${k}`);
  if (norm(env.SITE_NOINDEX) !== "1") problems.push("SITE_NOINDEX должен быть 1");
  const railwayVars = Object.keys(env).filter((k) => k.startsWith("RAILWAY_") && norm(env[k]));
  const local = env.CAREER_V3_DEMO_LOCAL === "1";
  let origin: URL | null = null;
  try {
    origin = new URL(norm(env.CAREER_V3_DEMO_ORIGIN));
    if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/" || origin.port && !local)
      problems.push("CAREER_V3_DEMO_ORIGIN должен быть чистым адресом без пути и параметров");
  } catch {
    problems.push("CAREER_V3_DEMO_ORIGIN не задан");
  }
  if (local) {
    if (railwayVars.length) problems.push("локальный режим демо запрещён на Railway");
    if (origin && !(origin.protocol === "http:" && origin.hostname === "127.0.0.1")) problems.push("локальный режим допускает только http://127.0.0.1");
  } else {
    if (norm(env.RAILWAY_PROJECT_NAME) !== spec.project) problems.push("проект Railway не совпадает с разрешённым");
    if (norm(env.RAILWAY_ENVIRONMENT_NAME) !== spec.environment) problems.push("среда Railway не совпадает с разрешённой");
    if (norm(env.RAILWAY_SERVICE_NAME) !== spec.service) problems.push("сервис Railway не совпадает с разрешённым");
    if (norm(env.RAILWAY_ENVIRONMENT).toLowerCase() === "production") problems.push("среда production запрещена");
    if (origin) {
      if (origin.protocol !== "https:") problems.push("облачное демо работает только по HTTPS");
      if (!origin.hostname.endsWith(".up.railway.app")) problems.push("разрешён только служебный домен *.up.railway.app");
      if (origin.hostname !== norm(env.RAILWAY_PUBLIC_DOMAIN)) problems.push("домен не совпадает с публичным доменом сервиса");
    }
    if (norm(env.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, "") !== (origin?.origin ?? "-")) problems.push("NEXT_PUBLIC_SITE_URL должен совпадать с адресом демо");
  }
  if (/mironovich\.pro$/i.test(origin?.hostname ?? "")) problems.push("основной домен запрещён");
  try {
    const db = new URL(norm(env.CAREER_V3_DEMO_DATABASE_URL));
    if (!["postgres:", "postgresql:"].includes(db.protocol)) problems.push("CAREER_V3_DEMO_DATABASE_URL не PostgreSQL");
    if (db.pathname.slice(1) !== spec.database) problems.push(`имя базы должно быть ${spec.database}`);
    if (norm(env.CAREER_DATABASE_URL) || norm(env.DATABASE_URL)) problems.push("заданы адреса других баз (CAREER_DATABASE_URL/DATABASE_URL)");
  } catch {
    problems.push("CAREER_V3_DEMO_DATABASE_URL не задан");
  }
  const secret = env.CAREER_V3_DEMO_SESSION_SECRET ?? "";
  if (secret.length < 48 || /^(.)\1+$/.test(secret)) problems.push("CAREER_V3_DEMO_SESSION_SECRET короче 48 символов");
  const days = Number(env.CAREER_V3_DEMO_ACCESS_DAYS ?? "30");
  if (!Number.isInteger(days) || days < 1 || days > 60) problems.push("CAREER_V3_DEMO_ACCESS_DAYS должен быть от 1 до 60");
  const max = Number(env.CAREER_V3_DEMO_MAX_USERS ?? "50");
  if (!Number.isInteger(max) || max < 1 || max > 200) problems.push("CAREER_V3_DEMO_MAX_USERS должен быть от 1 до 200");
  // Email codes: a dedicated key, never the session secret.
  const otp = env.CAREER_V3_OTP_SECRET ?? "";
  if (profile === "stage1" && !otp) problems.push("CAREER_V3_OTP_SECRET не задан");
  if (otp && (otp.length < 32 || /^(.)\1+$/.test(otp))) problems.push("CAREER_V3_OTP_SECRET короче 32 символов");
  if (otp && otp === secret) problems.push("CAREER_V3_OTP_SECRET не должен совпадать с секретом сессий");
  problems.push(...mailProblems(env, profile, local, !!otp));
  problems.push(...commerceProblems(env, profile, local));
  return problems;
}

function mailProblems(env: NodeJS.ProcessEnv, profile: DemoProfile, local: boolean, otp: boolean): string[] {
  const mode = norm(env.CAREER_V3_MAIL);
  const p: string[] = [];
  if (!mode) return otp && profile === "stage1" ? ["CAREER_V3_MAIL не задан: без отправки писем вход по коду невозможен"] : [];
  if (!otp) p.push("CAREER_V3_MAIL задан, но нет CAREER_V3_OTP_SECRET");
  if (mode === "smtp") {
    for (const k of ["CAREER_V3_SMTP_HOST", "CAREER_V3_SMTP_USER", "CAREER_V3_SMTP_PASSWORD", "CAREER_V3_SMTP_FROM"]) if (!norm(env[k])) p.push(`${k} не задан`);
    const port = Number(env.CAREER_V3_SMTP_PORT ?? "465");
    if (![465, 587].includes(port)) p.push("CAREER_V3_SMTP_PORT должен быть 465 или 587");
    const from = norm(env.CAREER_V3_SMTP_FROM).toLowerCase();
    if (from && !(from === MAIL_FROM_ADDRESS || from.endsWith("<" + MAIL_FROM_ADDRESS + ">"))) p.push(`отправитель должен быть ${MAIL_FROM_ADDRESS}`);
  } else if (mode === "preview-outbox") {
    // Codes go to a key-protected preview mailbox page instead of email: stage-1 preview and local tests only.
    if (profile !== "stage1" && !local) p.push("предпросмотр писем разрешён только в превью этапа 1");
    const key = env.CAREER_V3_PREVIEW_OUTBOX_KEY ?? "";
    if (key.length < 24 || /^(.)\1+$/.test(key)) p.push("CAREER_V3_PREVIEW_OUTBOX_KEY короче 24 символов");
  } else p.push("CAREER_V3_MAIL должен быть smtp или preview-outbox");
  return p;
}

function commerceProblems(env: NodeJS.ProcessEnv, profile: DemoProfile, local: boolean): string[] {
  const set = COMMERCE_VARS.filter((k) => norm(env[k]));
  if (profile !== "stage1") return set.length ? ["переменные оплаты запрещены в закрытой демоверсии"] : [];
  if (!set.length) return [];
  const p: string[] = [];
  const mode = norm(env.CAREER_V3_ROBOKASSA);
  if (mode !== "test" && mode !== "emulator") p.push("CAREER_V3_ROBOKASSA должен быть test или emulator (боевой режим на этапе 1 запрещён)");
  if (mode === "emulator" && !local && profile !== "stage1") p.push("эмулятор Robokassa разрешён только в превью этапа 1");
  if (mode === "test" && !norm(env.CAREER_V3_ROBOKASSA_LOGIN)) p.push("CAREER_V3_ROBOKASSA_LOGIN не задан");
  for (const k of ["CAREER_V3_ROBOKASSA_TEST_PASSWORD1", "CAREER_V3_ROBOKASSA_TEST_PASSWORD2"]) if ((env[k] ?? "").length < 8) p.push(`${k} не задан`);
  if (env.CAREER_V3_ROBOKASSA_TEST_PASSWORD1 && env.CAREER_V3_ROBOKASSA_TEST_PASSWORD1 === env.CAREER_V3_ROBOKASSA_TEST_PASSWORD2) p.push("тестовые пароли #1 и #2 должны различаться");
  const hash = norm(env.CAREER_V3_ROBOKASSA_HASH || "md5").toLowerCase();
  if (!(ROBOKASSA_HASHES as readonly string[]).includes(hash)) p.push("CAREER_V3_ROBOKASSA_HASH: md5, sha1, sha256, sha384 или sha512");
  return p;
}

/** The demo configuration, or null: closed. Never throws. */
export function demoConfig(env: NodeJS.ProcessEnv = process.env): DemoConfig | null {
  try {
    if (demoProblems(env).length) return null;
    const origin = new URL(norm(env.CAREER_V3_DEMO_ORIGIN));
    const local = env.CAREER_V3_DEMO_LOCAL === "1";
    const profile = (norm(env.CAREER_V3_DEMO_PROFILE) || "closed-demo") as DemoProfile;
    return {
      origin: origin.origin,
      host: origin.host,
      local,
      databaseUrl: norm(env.CAREER_V3_DEMO_DATABASE_URL),
      sessionSecret: env.CAREER_V3_DEMO_SESSION_SECRET!,
      cookieName: local ? DEMO_SESSION_COOKIE_LOCAL : DEMO_SESSION_COOKIE_SECURE,
      accessDays: Number(env.CAREER_V3_DEMO_ACCESS_DAYS ?? "30"),
      maxUsers: Number(env.CAREER_V3_DEMO_MAX_USERS ?? "50"),
      profile,
      databaseName: PROFILES[profile].database,
      migrationValue: PROFILES[profile].migration,
      loginCookieName: local ? LOGIN_COOKIE_LOCAL : LOGIN_COOKIE_SECURE,
      passwordLogin: profile === "closed-demo",
      otpSecret: env.CAREER_V3_OTP_SECRET || null,
      mail: readMail(env),
      commerce: profile === "stage1" ? { robokassa: readRobokassa(env), paidAccessDays: 90, reservationMinutes: 30 } : null,
      banner: profile === "stage1" ? STAGE1_BANNER : DEMO_BANNER,
    };
  } catch {
    return null;
  }
}

function readMail(env: NodeJS.ProcessEnv): MailConfig | null {
  const mode = norm(env.CAREER_V3_MAIL);
  if (mode === "preview-outbox") return { mode, key: env.CAREER_V3_PREVIEW_OUTBOX_KEY! };
  if (mode !== "smtp") return null;
  const port = Number(env.CAREER_V3_SMTP_PORT ?? "465");
  return { mode, host: norm(env.CAREER_V3_SMTP_HOST), port, secure: port === 465, user: norm(env.CAREER_V3_SMTP_USER), password: env.CAREER_V3_SMTP_PASSWORD!, from: norm(env.CAREER_V3_SMTP_FROM) };
}
function readRobokassa(env: NodeJS.ProcessEnv): RobokassaConfig | null {
  const mode = norm(env.CAREER_V3_ROBOKASSA);
  if (mode !== "test" && mode !== "emulator") return null;
  return {
    mode, merchantLogin: mode === "emulator" ? "stage1-emulator" : norm(env.CAREER_V3_ROBOKASSA_LOGIN),
    password1: env.CAREER_V3_ROBOKASSA_TEST_PASSWORD1!, password2: env.CAREER_V3_ROBOKASSA_TEST_PASSWORD2!,
    hash: norm(env.CAREER_V3_ROBOKASSA_HASH || "md5").toLowerCase() as RobokassaHash, receipt: env.CAREER_V3_ROBOKASSA_RECEIPT === "1",
  };
}

/** Like demoConfig(), but for request handlers: closed demo answers 404 (indistinguishable from absent). */
export function requireDemo(env: NodeJS.ProcessEnv = process.env): DemoConfig {
  const c = demoConfig(env);
  if (!c) throw new CareerError(404, "Страница не найдена");
  return c;
}

/** True when the demo variable is set at all — used to keep the rest of the site closed on a demo deploy,
 *  even when the demo itself is closed because of a configuration error (fail closed, not open). */
export const demoRequested = (env: NodeJS.ProcessEnv = process.env) => env.CAREER_V3_DEMO === "1";
