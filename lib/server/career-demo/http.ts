// Request checks shared by the demo auth API and the v3 API in demo mode.
import { NextResponse, type NextRequest } from "next/server";
import { CareerError } from "../career/config.ts";
import { requireDemo, type DemoConfig } from "./config.ts";

export const MAX_BODY = 8192;
export const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
export const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: noStore });

/** Host must be the demo host; state-changing requests must come from the demo origin (CSRF) and be JSON. */
export function guardDemoRequest(req: NextRequest): DemoConfig {
  const c = requireDemo();
  if (req.headers.get("host") !== c.host) throw new CareerError(403, "Неверный адрес");
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
