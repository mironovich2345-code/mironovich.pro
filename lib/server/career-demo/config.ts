// Closed cloud demo of AI Career 3.0 — an explicitly allow-listed configuration, separate from the
// synthetic v2 sandbox. demoConfig() returns null (closed) unless EVERY check passes; any configuration
// error closes the demo instead of opening a weaker mode. The checks below are hard-coded on purpose:
// environment variables can only *select* the demo, they cannot widen what is allowed.
//
// Cloud (Railway):  CAREER_V3_DEMO=1, project/environment/service names equal to the constants below,
//                   https origin on the service's own *.up.railway.app domain, database name exactly
//                   DEMO_DATABASE_NAME, strong session secret, and NO v2 sandbox / payment / mail / AI variables.
// Local (tests):    CAREER_V3_DEMO=1 + CAREER_V3_DEMO_LOCAL=1, http://127.0.0.1 origin, no RAILWAY_* variables.
import { CareerError } from "../career/config.ts";

export const DEMO_RAILWAY_PROJECT = "mironovich-career-cloud-demo";
export const DEMO_RAILWAY_ENVIRONMENT = "ai-career-v3-closed-demo";
export const DEMO_RAILWAY_SERVICE = "ai-career-v3-demo";
export const DEMO_DATABASE_NAME = "mironovich_career_demo_v3";
/** Session setting a migration needs to run on the demo database (see migrations/career/*.sql guards). */
export const DEMO_MIGRATION_SETTING = "mironovich.career_demo";
export const DEMO_MIGRATION_VALUE = "closed-demo-v3";
export const DEMO_SESSION_COOKIE_SECURE = "__Host-career_demo_session";
export const DEMO_SESSION_COOKIE_LOCAL = "career_demo_session";
export const DEMO_BANNER =
  "Демонстрационная версия. Учебные материалы находятся на проверке. Используйте только вымышленные данные";

/** Variables that belong to other contours. Their presence closes the demo (no mixing of modes). */
const FORBIDDEN = [
  "CAREER_SANDBOX_ENABLED", "CAREER_PAYMENT_MODE", "YOOKASSA_SHOP_ID", "YOOKASSA_TEST_SECRET_KEY", "YOOKASSA_SECRET_KEY",
  "CAREER_MAIL_MODE", "CAREER_SMTP_URL", "CAREER_AI_MODE", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
  "CAREER_V3_FIXTURE_LIBRARY", "CAREER_V3_REVIEW_PREVIEW", "LEGAL_PREVIEW",
];

export interface DemoConfig {
  origin: string;
  host: string;
  local: boolean;
  databaseUrl: string;
  sessionSecret: string;
  cookieName: string;
  accessDays: number;
  maxUsers: number;
}

const norm = (v: string | undefined) => (v ?? "").trim();

/** Why the demo is closed (no secret values). Empty list = the demo configuration is valid. */
export function demoProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const problems: string[] = [];
  if (env.CAREER_V3_DEMO !== "1") return ["CAREER_V3_DEMO не равен 1"];
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
    if (norm(env.RAILWAY_PROJECT_NAME) !== DEMO_RAILWAY_PROJECT) problems.push("проект Railway не совпадает с разрешённым");
    if (norm(env.RAILWAY_ENVIRONMENT_NAME) !== DEMO_RAILWAY_ENVIRONMENT) problems.push("среда Railway не совпадает с разрешённой");
    if (norm(env.RAILWAY_SERVICE_NAME) !== DEMO_RAILWAY_SERVICE) problems.push("сервис Railway не совпадает с разрешённым");
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
    if (db.pathname.slice(1) !== DEMO_DATABASE_NAME) problems.push(`имя базы должно быть ${DEMO_DATABASE_NAME}`);
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
  return problems;
}

/** The demo configuration, or null: closed. Never throws. */
export function demoConfig(env: NodeJS.ProcessEnv = process.env): DemoConfig | null {
  try {
    if (demoProblems(env).length) return null;
    const origin = new URL(norm(env.CAREER_V3_DEMO_ORIGIN));
    const local = env.CAREER_V3_DEMO_LOCAL === "1";
    return {
      origin: origin.origin,
      host: origin.host,
      local,
      databaseUrl: norm(env.CAREER_V3_DEMO_DATABASE_URL),
      sessionSecret: env.CAREER_V3_DEMO_SESSION_SECRET!,
      cookieName: local ? DEMO_SESSION_COOKIE_LOCAL : DEMO_SESSION_COOKIE_SECURE,
      accessDays: Number(env.CAREER_V3_DEMO_ACCESS_DAYS ?? "30"),
      maxUsers: Number(env.CAREER_V3_DEMO_MAX_USERS ?? "50"),
    };
  } catch {
    return null;
  }
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
