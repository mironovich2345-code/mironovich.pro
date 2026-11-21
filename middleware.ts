// One middleware, three roles (Node.js runtime, so variables are read at run time, not baked into the build):
//
// 1. Closed contours (CAREER_V3_DEMO=1, profiles closed-demo / stage1): the codebase serves ONLY the contour;
//    every other page of the site answers 404; every response is noindex.
// 2. Commercial learning app (CAREER_V3_DEMO=1, profiles commercial-staging / commercial): a separate Railway service
//    with no public domain. It answers only requests that carry the public site's proxy secret (plus /healthz for
//    Railway's health check). /career shows the cabinet, /admin the admin cabinet.
// 3. Public site (no CAREER_V3_DEMO) with CAREER_APP_UPSTREAM set: proxies /career, /admin, /api/career/* and the app's
//    static assets to the learning app over Railway's private network, adding the secret, the visitor's host and IP.
//    If the app is down, only these paths fail — every page of the public site keeps working.
//    Without CAREER_APP_UPSTREAM (today's production) this middleware changes nothing on the public site.
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { trustedClientIp } from "./lib/server/client-ip.ts";

const ALLOWED = [/^\/career\/v3\/?$/, /^\/api\/career\/demo\/[a-z-]+$/, /^\/api\/career\/v3\//, /^\/robots\.txt$/, /^\/favicon\.ico$/, /^\/icon-\d+\.png$/, /^\/apple-touch-icon\.png$/, /^\/fonts\//];

const NOT_FOUND = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Страница не найдена</title></head>' +
  '<body style="font-family:system-ui,sans-serif;background:#F2EFE8;color:#0E0E11;padding:32px 16px"><p>Страница не найдена.</p><p><a href="/">На главную</a></p></body></html>';

// Stage-1 preview and the commercial app: admin cabinet, shop, Robokassa callbacks, preview-only helper pages.
const SHOP = [/^\/admin(\/[a-z]+(\/emails)?)?\/?$/, /^\/api\/career\/(admin|shop)\/[a-z-]+$/, /^\/api\/career\/pay\/robokassa\/(result|success|fail)$/, /^\/api\/career\/pay\/emulator$/,
  /^\/api\/career\/preview-mail$/, /^\/preview-(robokassa|mail)\/?$/];
// Stage-1 preview also serves the product page with its documents (to compare the price on the site and in the order).
const STAGE1_SITE = [/^\/products(\/ai-career)?\/?$/, /^\/(offer\/ai-career|delivery|refund|requisites|privacy|consent)\/?$/, /^\/_next\/image$/, /^\/products\/[a-z0-9-]+\.(png|svg|webp)$/];
// Paths the public site hands to the learning app.
const PROXIED = [/^\/career(\/.*)?$/, ...SHOP, /^\/api\/career\/(demo|v3)\//, /^\/career-app\/_next\//];
const CAREER_ASSET_PREFIX = "/career-app"; // keep in sync with next.config.mjs assetPrefix

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const noindex = (res: NextResponse) => { res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive"); return res; };
const notFound = (pathname: string) => pathname.startsWith("/api/")
  ? NextResponse.json({ error: "Страница не найдена" }, { status: 404 })
  : new NextResponse(NOT_FOUND, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });

function publicSite(req: NextRequest): NextResponse {
  const upstream = process.env.CAREER_APP_UPSTREAM;
  const secret = process.env.CAREER_PROXY_SECRET ?? "";
  const { pathname, search } = req.nextUrl;
  if (!upstream || secret.length < 32 || !PROXIED.some((r) => r.test(pathname))) return NextResponse.next();
  let target: URL;
  try {
    const base = new URL(upstream);
    if (base.protocol !== "http:" && base.protocol !== "https:") return NextResponse.next();
    // The app's static files live under /career-app/_next/… on the site and under /_next/… in the app.
    const path = pathname.startsWith(CAREER_ASSET_PREFIX + "/") ? pathname.slice(CAREER_ASSET_PREFIX.length) : pathname;
    target = new URL(path + search, base);
  } catch {
    return NextResponse.next();
  }
  const headers = new Headers(req.headers);
  headers.set("x-career-proxy", secret); // overwrites anything a visitor might send
  headers.set("x-forwarded-host", req.headers.get("host") ?? "");
  // Only a source Railway/Cloudflare guarantee (see lib/server/client-ip.ts); never a header a visitor can write.
  headers.set("x-career-client-ip", trustedClientIp(req.headers));
  return noindex(NextResponse.rewrite(target, { request: { headers } }));
}

export function middleware(req: NextRequest) {
  if (process.env.CAREER_V3_DEMO !== "1") return publicSite(req);
  const { pathname } = req.nextUrl;
  const profile = process.env.CAREER_V3_DEMO_PROFILE;
  const commercial = profile === "commercial" || profile === "commercial-staging";
  if (commercial) {
    if (pathname === "/healthz") return new NextResponse("ok", { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
    // Only the public site's proxy may talk to the app.
    const secret = process.env.CAREER_PROXY_SECRET ?? "";
    if (secret.length < 32 || !same(req.headers.get("x-career-proxy") ?? "", secret)) return noindex(notFound(pathname));
  }
  // /career is the cabinet's address in every contour (the page itself lives at /career/v3).
  if (pathname === "/career" || pathname === "/career/") {
    const r = NextResponse.rewrite(new URL("/career/v3" + req.nextUrl.search, req.url));
    r.headers.set("Referrer-Policy", "no-referrer");
    return noindex(r);
  }
  const allowed = [...ALLOWED, ...(profile === "stage1" || commercial ? SHOP : []), ...(profile === "stage1" ? STAGE1_SITE : [])];
  // Closed contours: "/" shows the cabinet (rewrite keeps the request's own host); every other page is absent.
  const res = allowed.some((r) => r.test(pathname))
    ? NextResponse.next()
    : pathname === "/" && !commercial
      ? NextResponse.rewrite(new URL("/career/v3", req.url))
      : notFound(pathname);
  res.headers.set("Referrer-Policy", "no-referrer");
  return noindex(res);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"], runtime: "nodejs" };
