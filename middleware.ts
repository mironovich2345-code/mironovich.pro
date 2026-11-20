// Closed AI Career demo deploy (CAREER_V3_DEMO=1): the same codebase serves ONLY the demo. "/" shows the
// demo, every other page of the public site answers 404, every response is noindex. On the main site this
// middleware does nothing (the variable is never set there).
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED = [/^\/career\/v3\/?$/, /^\/api\/career\/demo\/[a-z-]+$/, /^\/api\/career\/v3\//, /^\/robots\.txt$/, /^\/favicon\.ico$/, /^\/icon-\d+\.png$/, /^\/apple-touch-icon\.png$/, /^\/fonts\//];

const NOT_FOUND = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Страница не найдена</title></head>' +
  '<body style="font-family:system-ui,sans-serif;background:#F2EFE8;color:#0E0E11;padding:32px 16px"><p>Страница не найдена.</p><p><a href="/">Открыть демоверсию AI Career 3.0</a></p></body></html>';

// Stage-1 preview adds the admin cabinet, the test shop, Robokassa callbacks, preview-only helper pages and the product
// page with its documents (to check that the site, the order and the payment request show one price).
const STAGE1 = [/^\/admin(\/[a-z]+(\/emails)?)?\/?$/, /^\/api\/career\/(admin|shop)\/[a-z-]+$/, /^\/api\/career\/pay\/robokassa\/(result|success|fail)$/, /^\/api\/career\/pay\/emulator$/,
  /^\/api\/career\/preview-mail$/, /^\/preview-(robokassa|mail)\/?$/, /^\/products(\/ai-career)?\/?$/, /^\/(offer\/ai-career|delivery|refund|requisites|privacy|consent)\/?$/, /^\/_next\/image$/,
  /^\/products\/[a-z0-9-]+\.(png|svg|webp)$/];

export function middleware(req: NextRequest) {
  if (process.env.CAREER_V3_DEMO !== "1") return NextResponse.next();
  const { pathname } = req.nextUrl;
  const allowed = [...ALLOWED, ...(process.env.CAREER_V3_DEMO_PROFILE === "stage1" ? STAGE1 : [])];
  // "/" shows the demo itself (rewrite keeps the request's own host); every other page of the site is absent.
  const res = allowed.some((r) => r.test(pathname))
    ? NextResponse.next()
    : pathname === "/"
      ? NextResponse.rewrite(new URL("/career/v3", req.url))
      : pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Страница не найдена" }, { status: 404 })
        : new NextResponse(NOT_FOUND, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
