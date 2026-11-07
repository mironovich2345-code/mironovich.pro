import { NextResponse } from "next/server";
import { consentVersion } from "@/config/legal";
import { clientIpSource, createLeadLimiter } from "@/lib/rate-limit";
import { parseToolContext, describeToolContext } from "@/lib/tools/context";
import { formatLeadMessage } from "@/lib/lead-message";
import { readLeadRequest } from "@/lib/lead-request";
import {
  HONEYPOT_FIELD, LEAD_LIMITS, REDACTED, directionLabel, isLeadDirection, leadFormExtended, looksPersonal, normalizePagePath, validContact,
} from "@/lib/lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** First-touch attribution sent by the form. Never required — a missing or
 *  malformed block degrades to direct / unknown and never fails the lead. */
type AttrField = "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term" | "referrer" | "landingPage";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

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

// In-memory rate limits (per warm instance) — docs/release/rate-limit.md:
// 5 a minute per client when its address is trusted (RATE_LIMIT_CLIENT_IP, set
// only after the staging check), and 10 a minute for everyone together, always.
const rateLimited = createLeadLimiter({ source: clientIpSource(process.env.RATE_LIMIT_CLIENT_IP) });

const fail = (error: string, status: number) =>
  NextResponse.json({ ok: false, delivered: false, error }, { status });

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
  if (req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return fail("bad_content_type", 415);
  }
  // refuse oversized bodies before reading them
  if (Number(req.headers.get("content-length") ?? 0) > LEAD_LIMITS.payload * 4) return fail("too_large", 413);
  // every attempt counts, valid or not, so invalid floods are throttled too
  if (rateLimited(req.headers)) return fail("rate_limited", 429);

  const parsed = await readLeadRequest(req, LEAD_LIMITS.payload);
  if (!parsed.ok) return fail(parsed.error, parsed.status);
  const body = parsed.body;

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

  const context = body.toolContext === undefined ? undefined : parseToolContext(body.toolContext);
  if (context === null) return fail("invalid_tool_context", 400);

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

  const text = formatLeadMessage({
    name, phone, task, company,
    direction: isLeadDirection(direction) ? directionLabel(direction) : "",
    page, date, consentVersion, attribution: attr,
    context: context ? describeToolContext(context) : "",
  });

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
