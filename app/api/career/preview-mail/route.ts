// Stage-1 preview without SMTP: unlock the preview mailbox with the key from the Railway variable
// CAREER_V3_PREVIEW_OUTBOX_KEY (readable only by people with access to the Railway project). The cookie holds an HMAC,
// never the key. Refused unless config.ts selected the preview-outbox transport (never possible in production).
import { timingSafeEqual } from "node:crypto";
import { PREVIEW_MAIL_COOKIE, previewMailToken } from "@/lib/server/career-demo/preview-mail";
import { NextRequest, NextResponse } from "next/server";
import { demoConfig } from "@/lib/server/career-demo/config";
import { demoLimit } from "@/lib/server/career-demo/auth";
import { clientIp } from "@/lib/server/career-demo/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const c = demoConfig();
  if (!c || c.mail?.mode !== "preview-outbox" || req.headers.get("host") !== c.host || req.headers.get("origin") !== c.origin) return new NextResponse("Not found", { status: 404 });
  try { await demoLimit(c, "preview-mail:" + clientIp(req), 10, 900); } catch { return new NextResponse("Слишком много попыток", { status: 429 }); }
  const key = new URLSearchParams((await req.text()).slice(0, 512)).get("key") ?? "";
  const a = Buffer.from(previewMailToken(c.sessionSecret, key)), b = Buffer.from(previewMailToken(c.sessionSecret, c.mail.key));
  const res = NextResponse.redirect(new URL("/preview-mail" + (timingSafeEqual(a, b) ? "" : "?wrong=1"), c.origin), 303);
  if (timingSafeEqual(a, b)) res.cookies.set(PREVIEW_MAIL_COOKIE, b.toString(), { httpOnly: true, secure: !c.local, sameSite: "strict", path: "/", maxAge: 8 * 3600 });
  return res;
}
