import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lead = {
  name?: unknown; phone?: unknown; task?: unknown; consent?: unknown; company?: unknown;
  attribution?: unknown;
};

/** First-touch attribution sent by the form. Never required — a missing or
 *  malformed block degrades to direct / unknown and never fails the lead. */
const ATTR_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer", "landingPage"] as const;

const LIMITS = { name: 100, phone: 40, task: 2000, payload: 10000 };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clamp = (s: string, max: number) => (s.length > max ? s.slice(0, max) + "…" : s);

function readAttribution(v: unknown) {
  const src = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of ATTR_FIELDS) {
    const raw = typeof src[k] === "string" ? (src[k] as string).trim() : "";
    const fallback = k === "utm_source" || k === "utm_medium" || k === "referrer" ? "direct" : "unknown";
    out[k] = (raw || fallback).slice(0, 200);
  }
  return out;
}

// the contact field accepts a phone number OR a Telegram username / t.me link
const validContact = (v: string) => {
  const s = v.replace(/^https?:\/\/t\.me\//i, "");
  if (/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(s)) return true;
  return s.replace(/\D/g, "").length >= 10;
};

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

export async function POST(req: Request) {
  if (req.headers.get("content-type")?.includes("application/json") !== true) {
    return fail("bad_content_type", 415);
  }

  const raw = await req.text();
  if (raw.length > LIMITS.payload) return fail("too_large", 413);

  let body: Lead;
  try {
    body = JSON.parse(raw) as Lead;
  } catch {
    return fail("bad_request", 400);
  }

  // honeypot — silently accepted for the bot, never delivered
  if (str(body.company) !== "") {
    return NextResponse.json({ ok: false, delivered: false, error: "spam" }, { status: 400 });
  }

  const name = str(body.name);
  const phone = str(body.phone);
  const task = str(body.task);
  const attr = readAttribution(body.attribution);

  if (body.consent !== true) return fail("consent_required", 422);
  if (name.length < 2 || !validContact(phone) || task.length < 10) {
    return fail("validation", 422);
  }
  if (name.length > LIMITS.name || phone.length > LIMITS.phone || task.length > LIMITS.task) {
    return fail("too_long", 422);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return fail("rate_limited", 429);

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
      "<b>Контакт:</b>\n" + escapeHtml(phone) + "\n\n" +
      "<b>Задача:</b>\n" + escapeHtml(task) + "\n\n" +
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
