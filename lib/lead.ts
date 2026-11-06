/**
 * Lead form rules shared by the browser form and /api/lead, so both sides
 * validate exactly the same way. No server-only code in here.
 */

export const LEAD_LIMITS = { name: 100, company: 120, phone: 40, task: 2000, payload: 10000 } as const;

export const LEAD_DIRECTIONS = [
  { value: "automation", label: "Автоматизация и ИИ" },
  { value: "apps", label: "Разработка приложения" },
  { value: "training", label: "Обучение сотрудников" },
  { value: "unknown", label: "Пока не знаю" },
] as const;

export type LeadDirection = (typeof LEAD_DIRECTIONS)[number]["value"];

export const isLeadDirection = (v: unknown): v is LeadDirection =>
  typeof v === "string" && LEAD_DIRECTIONS.some((d) => d.value === v);

export const directionLabel = (v: LeadDirection) => LEAD_DIRECTIONS.find((d) => d.value === v)!.label;

/** Accepts a phone number OR a Telegram username / t.me link. */
export const validContact = (v: string) => {
  const s = v.trim().replace(/^https?:\/\/t\.me\//i, "");
  if (/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(s)) return true;
  return s.replace(/\D/g, "").length >= 10;
};

/**
 * Company and direction change the set of personal data the form collects, so
 * they stay off until the updated privacy policy is approved and published.
 * Read at build time on the client and at runtime on the server.
 */
export const leadFormExtended = process.env.NEXT_PUBLIC_LEAD_FORM_EXTENDED === "1";

/** Hidden field name for the spam trap. Must never match a real field. */
export const HONEYPOT_FIELD = "website";

/** Static routes a lead can be sent from. Articles, blog categories and case pages are matched by pattern below. */
const KNOWN_PAGES = new Set([
  "/", "/services", "/services/automation", "/services/apps", "/services/training",
  "/about", "/blog", "/contact", "/projects",
  "/services/cto", "/services/development", "/services/support", "/services/expertise",
  "/tools", "/tools/labor-cost", "/tools/automation-cost",
]);

/**
 * Reduces whatever the client sent to a known site path, so the Telegram message
 * never carries an arbitrary URL, query string or injected text. Anything that is
 * not one of our routes becomes "unknown".
 */
export function normalizePagePath(v: unknown): string {
  if (typeof v !== "string") return "unknown";
  let path = v.trim().slice(0, 200).split(/[?#]/)[0];
  if (!path.startsWith("/") || path.startsWith("//")) return "unknown";
  if (path.length > 1) path = path.replace(/\/+$/, "");
  path = path.toLowerCase();
  if (KNOWN_PAGES.has(path)) return path;
  if (/^\/(?:blog|blog\/category|projects)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) && path.length <= 120) return path;
  return "unknown";
}

/**
 * True when a value looks like personal data: an e-mail, a phone-like run of
 * digits, a mailto:/tel: link or a long numeric id. Used to drop such values
 * from UTM tags and query strings before they reach a lead or analytics.
 */
export function looksPersonal(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  if (/@|%40|mailto:|tel:/i.test(s)) return true;
  // 7+ digits once spaces, brackets, dashes and plus are ignored: phone numbers, passport/INN-like ids
  return /\d{7,}/.test(s.replace(/[\s()+\-.]/g, ""));
}

/** Marker that replaces a value removed by looksPersonal(). */
export const REDACTED = "redacted";
