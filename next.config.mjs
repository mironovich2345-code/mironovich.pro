import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import { runReleaseGuard } from "./lib/release-guard.mjs";

// Same validation as lib/analytics.ts: a malformed id disables the provider and its hosts.
const rawMetrica = (process.env.NEXT_PUBLIC_YANDEX_METRICA_ID || "").trim();
const rawGa = (process.env.NEXT_PUBLIC_GA_ID || "").trim();
const metricaId = /^\d{5,12}$/.test(rawMetrica) ? rawMetrica : "";
const gaId = /^G-[A-Z0-9]{4,20}$/.test(rawGa) ? rawGa : "";

// Analytics hosts are added to the CSP only when the matching ID is set, so a
// site without analytics keeps the strictest possible policy.
const ymHosts = metricaId ? ["https://mc.yandex.ru", "https://mc.yandex.com"] : [];
// GA4 loads from googletagmanager and sends hits to regional *.google-analytics.com /
// *.analytics.google.com endpoints.
const gaScriptHosts = gaId ? ["https://www.googletagmanager.com"] : [];
const gaDataHosts = gaId
  ? ["https://www.googletagmanager.com", "https://*.google-analytics.com", "https://*.analytics.google.com"]
  : [];
const scriptHosts = [...ymHosts, ...gaScriptHosts];
const connectHosts = [...ymHosts, ...gaDataHosts];
const imgHosts = [...ymHosts, ...gaDataHosts];
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
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
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
