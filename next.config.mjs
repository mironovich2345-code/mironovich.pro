import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import { runReleaseGuard } from "./lib/release-guard.mjs";
/** Local test builds served over plain http on loopback (never the public site). */
const loopbackSite = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(process.env.NEXT_PUBLIC_SITE_URL ?? "");

// Same validation as lib/analytics.ts: a malformed id disables the provider and its hosts.
const rawMetrica = (process.env.NEXT_PUBLIC_YANDEX_METRICA_ID || "").trim();
const metricaId = /^\d{5,12}$/.test(rawMetrica) ? rawMetrica : "";

// Analytics hosts are added to the CSP only when the matching ID is set, so a
// site without analytics keeps the strictest possible policy.
const ymHosts = metricaId ? ["https://mc.yandex.ru", "https://mc.yandex.com"] : [];
// Only Yandex Metrica (GA4 removed): no Google hosts in the CSP at all.
const scriptHosts = ymHosts;
const connectHosts = ymHosts;
const imgHosts = ymHosts;
const join = (list) => (list.length ? " " + list.join(" ") : "");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      // Next.js inlines a small runtime script; styles are emitted inline by the framework.
      "script-src 'self' 'unsafe-inline'" + join(scriptHosts) + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:" + join(imgHosts),
      "font-src 'self' data:",
      "connect-src 'self'" + join(connectHosts),
      // Upgrading http→https is right for every public origin, but on a loopback test server (http://127.0.0.1 in CI)
      // Safari/WebKit would upgrade the page's own scripts and API calls to https and the page would never load.
      ...(loopbackSite ? [] : ["upgrade-insecure-requests"]),
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Local two-server tests build the public site and the learning app side by side (default .next everywhere else).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  compress: true,
  // Critical search/crawler user agents need metadata in <head> before streaming.
  // Do not classify ordinary browsers as bots: this can delay their response.
  // Verify Googlebot, Lighthouse and YandexBot output in browser smoke tests.
  // Commercial learning app (separate service behind the site's proxy): its static files are served on the site under
  // /career-app/_next/… so they never collide with the site's own /_next/… files. Keep in sync with middleware.ts.
  assetPrefix: process.env.CAREER_V3_DEMO === "1" && /^commercial(-staging)?$/.test(process.env.CAREER_V3_DEMO_PROFILE ?? "") ? "/career-app" : undefined,
  // Public site → learning app proxy: a hung app must not hold the site's workers for long.
  experimental: { proxyTimeout: 15000 },
  htmlLimitedBots: /Googlebot|Google-InspectionTool|Lighthouse|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|YandexMobileBot|facebookexternalhit|Twitterbot|LinkedInBot/i,
  async headers() {
    // staging / preview copies: keep every response out of search indexes
    const noindex = process.env.SITE_NOINDEX === "1" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : [];
    return [{ source: "/:path*", headers: [...securityHeaders, ...noindex] }];
  },
};

// Production release guard: a production build stops if the legal texts are not
// published and filled in, or analytics do not match the consent banner.
// Staging and local builds only get a report. See docs/release/release-guard.md.
// Deliberately no environment variable can switch it off. Next may load the
// config in several processes; each one checks again (same result).
const checked = Symbol.for("mrnv.release-guard");
export default function config(phase) {
  if (phase === PHASE_PRODUCTION_BUILD && !globalThis[checked]) {
    const result = runReleaseGuard();
    if (result.blocked) throw new Error(result.message);
    globalThis[checked] = true;
  }
  return nextConfig;
}
