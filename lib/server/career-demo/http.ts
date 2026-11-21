// Request checks shared by the demo auth API and the v3 API in demo mode.
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { CareerError } from "../career/config.ts";
import { demoConfig, requireDemo, type DemoConfig } from "./config.ts";

export const MAX_BODY = 8192;
export const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
export const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: noStore });

const PROXY_HEADER = "x-career-proxy";
const safeEqual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

/**
 * The host the browser actually used. Closed contours: the Host header. Commercial app: it sits behind the public
 * site's proxy (no public domain of its own), so only a request carrying the proxy secret counts, and the browser's
 * host is the X-Forwarded-Host the proxy set. Anything else → null (treated as a foreign request).
 */
export function requestHost(h: Headers, c: DemoConfig): string | null {
  if (!c.proxySecret) return h.get("host");
  if (!safeEqual(h.get(PROXY_HEADER) ?? "", c.proxySecret)) return null;
  return h.get("x-forwarded-host");
}

/** Host must be the contour's host; state-changing requests must come from its origin (CSRF) and be JSON. */
export function guardDemoRequest(req: NextRequest): DemoConfig {
  const c = requireDemo();
  const host = requestHost(req.headers, c);
  if (host === null && c.proxySecret) throw new CareerError(404, "Страница не найдена");
  if (host !== c.host) throw new CareerError(403, "Неверный адрес");
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (req.headers.get("origin") !== c.origin) throw new CareerError(403, "Неверный источник запроса");
    if (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin") throw new CareerError(403, "Неверный источник запроса");
  }
  return c;
}

export async function readJson(req: NextRequest, allowed: string[]): Promise<Record<string, unknown>> {
  if (req.headers.get("content-type")?.split(";")[0] !== "application/json") throw new CareerError(415, "Требуется JSON");
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) throw new CareerError(413, "Запрос слишком большой");
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY) throw new CareerError(413, "Запрос слишком большой");
  let b: unknown;
  try { b = JSON.parse(raw); } catch { throw new CareerError(400, "Неверный запрос"); }
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new CareerError(400, "Неверный запрос");
  if (Object.keys(b).some((k) => !allowed.includes(k))) throw new CareerError(400, "Неожиданные данные запроса");
  return b as Record<string, unknown>;
}

/** Client address for rate limits only (never stored: limit keys are HMAC digests). Railway's edge sets X-Real-IP. */
export function clientIp(req: NextRequest): string {
  // Commercial app: the site's proxy passes the visitor's address (trusted only with the proxy secret).
  const c = demoConfig();
  if (c?.proxySecret && requestHost(req.headers, c) !== null) {
    const fwd = req.headers.get("x-career-client-ip")?.trim();
    if (fwd && fwd.length <= 64) return fwd;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real && real.length <= 64) return real;
  const xff = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return xff?.length ? xff[xff.length - 1].slice(0, 64) : "unknown";
}

export function setSessionCookie(res: NextResponse, c: DemoConfig, token: string) {
  res.cookies.set(c.cookieName, token, { httpOnly: true, secure: !c.local, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600 });
}
export function clearSessionCookie(res: NextResponse, c: DemoConfig) {
  res.cookies.set(c.cookieName, "", { httpOnly: true, secure: !c.local, sameSite: "lax", path: "/", maxAge: 0 });
}

/** Short-lived cookie with the opaque email-code challenge token (HttpOnly; only its HMAC is stored). */
export function setLoginCookie(res: NextResponse, c: DemoConfig, token: string, expiresAt: Date) {
  res.cookies.set(c.loginCookieName, token, { httpOnly: true, secure: !c.local, sameSite: "lax", path: "/", expires: expiresAt });
}
export function clearLoginCookie(res: NextResponse, c: DemoConfig) {
  res.cookies.set(c.loginCookieName, "", { httpOnly: true, secure: !c.local, sameSite: "lax", path: "/", maxAge: 0 });
}
