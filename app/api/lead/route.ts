import { NextResponse } from "next/server";
import {
  HONEYPOT_FIELD, LEAD_LIMITS, REDACTED, directionLabel, isLeadDirection, leadFormExtended, looksPersonal, normalizePagePath, validContact,
} from "@/lib/lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lead = {
  name?: unknown; phone?: unknown; task?: unknown; consent?: unknown;
  company?: unknown; direction?: unknown; page?: unknown; attribution?: unknown;
  [HONEYPOT_FIELD]?: unknown;
};

/** First-touch attribution sent by the form. Never required — a missing or
 *  malformed block degrades to direct / unknown and never fails the lead. */
type AttrField = "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term" | "referrer" | "landingPage";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clamp = (s: string, max: number) => (s.length > max ? s.slice(0, max) + "…" : s);

const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** Never trust the client: UTM is printable text capped at 100, referrer is reduced to an
 *  http(s) origin, the landing page must be one of the site's own routes. */
function readAttribution(v: unknown) {
  const src = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const text = (x: unknown) => {
    const t = typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100) : "";
    return looksPersonal(t) ? REDACTED : t;
  };
  const out = {} as Record<AttrField, string>;
  for (const k of UTM_FIELDS) out[k] = text(src[k]) || (k === "utm_source" || k === "utm_medium" ? "direct" : "unknown");

  let referrer = "direct";
  if (typeof src.referrer === "string" && src.referrer !== "direct") {
    try {
      const u = new URL(src.referrer);
      if ((u.protocol === "http:" || u.protocol === "https:") && !looksPersonal(u.hostname)) referrer = u.origin;
    } catch {
      /* keep direct */
    }
  }
  out.referrer = referrer;
  out.landingPage = normalizePagePath(src.landingPage);
  return out;
}

// naive in-memory rate limit (per warm instance) — enough to stop casual spam
const hits = new Map<string, number[]>();
const rateLimited = (ip: string) => {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 5;
};

const fail = (error: string, status: number) =>
  NextResponse.json({ ok: false, delivered: false, error }, { status });

/** Client address for rate limiting. Best effort: forwarded headers can be set by the client,
 *  so this only slows casual spam; abuse protection belongs at the edge (proxy / WAF). */
const clientIp = (req: Request) =>
  req.headers.get("x-real-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/** Browsers always send Origin on a cross-site POST; reject one that is not this host. */
function foreignOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
}

export async function POST(req: Request) {
  if (foreignOrigin(req)) return fail("forbidden", 403);
  if (req.headers.get("content-type")?.includes("application/json") !== true) {
    return fail("bad_content_type", 415);
  }
  // refuse oversized bodies before reading them
  if (Number(req.headers.get("content-length") ?? 0) > LEAD_LIMITS.payload * 4) return fail("too_large", 413);
  // every attempt counts, valid or not, so invalid floods are throttled too
  if (rateLimited(clientIp(req))) return fail("rate_limited", 429);

  const raw = await req.text();
  if (raw.length > LEAD_LIMITS.payload) return fail("too_large", 413);

  let body: Lead;
  try {
    body = JSON.parse(raw) as Lead;
  } catch {
    return fail("bad_request", 400);
  }

  // honeypot — rejected and never delivered
  if (str(body[HONEYPOT_FIELD]) !== "") {
    return NextResponse.json({ ok: false, delivered: false, error: "spam" }, { status: 400 });
  }

  const name = str(body.name);
  const phone = str(body.phone);
  const task = str(body.task);
  const attr = readAttribution(body.attribution);
  const page = normalizePagePath(body.page);
  // Company and direction are only accepted once the extended form is switched on,
  // so the server never forwards data the published privacy policy does not cover.
  const company = leadFormExtended ? str(body.company) : "";
  const direction = leadFormExtended ? body.direction : undefined;

  if (body.consent !== true) return fail("consent_required", 422);
  if (name.length < 2 || !validContact(phone) || task.length < 10) {
    return fail("validation", 422);
  }
  if (leadFormExtended && !isLeadDirection(direction)) return fail("validation", 422);
  if (
    name.length > LEAD_LIMITS.name || phone.length > LEAD_LIMITS.phone ||
    task.length > LEAD_LIMITS.task || company.length > LEAD_LIMITS.company
  ) {
    return fail("too_long", 422);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Not configured — do not crash, but never claim the lead was delivered.
  if (!token || !chatId) {
    console.error("[lead] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set — lead not delivered");
    return fail("not_configured", 503);
  }

  const date = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: process.env.LEAD_TIMEZONE || "Europe/Moscow",
  }).format(new Date());

  const text = clamp(
    "<b>НОВАЯ ЗАЯВКА С САЙТА</b>\n\n" +
      "<b>Имя:</b>\n" + escapeHtml(name) + "\n\n" +
      (company ? "<b>Компания:</b>\n" + escapeHtml(company) + "\n\n" : "") +
      "<b>Контакт:</b>\n" + escapeHtml(phone) + "\n\n" +
      (isLeadDirection(direction) ? "<b>Направление:</b>\n" + escapeHtml(directionLabel(direction)) + "\n\n" : "") +
      "<b>Задача:</b>\n" + escapeHtml(task) + "\n\n" +
      "<b>Страница:</b>\n" + escapeHtml(page) + "\n\n" +
      "<b>Дата:</b>\n" + escapeHtml(date) + "\n\n" +
      "<b>ИСТОЧНИК</b>\n" +
      "Source: " + escapeHtml(attr.utm_source) + "\n" +
      "Medium: " + escapeHtml(attr.utm_medium) + "\n" +
      "Campaign: " + escapeHtml(attr.utm_campaign) + "\n" +
      "Content: " + escapeHtml(attr.utm_content) + "\n" +
      "Referrer: " + escapeHtml(attr.referrer) + "\n" +
      "Landing: " + escapeHtml(attr.landingPage),
    3800, // Telegram hard limit is 4096 characters
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: controller.signal,
      cache: "no-store",
    });

    const data: { ok?: boolean } = await res.json().catch(() => ({}));
    if (!res.ok || data.ok !== true) {
      console.error("[lead] telegram rejected the message", res.status);
      return fail("telegram", 502);
    }
    return NextResponse.json({ ok: true, delivered: true });
  } catch (err) {
    console.error("[lead] telegram request failed", err);
    return fail("telegram_unreachable", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
