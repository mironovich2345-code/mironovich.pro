const metricaId = (process.env.NEXT_PUBLIC_YANDEX_METRICA_ID || "").trim();
const gaId = (process.env.NEXT_PUBLIC_GA_ID || "").trim();

// Analytics hosts are added to the CSP only when the matching ID is set, so a
// site without analytics keeps the strictest possible policy.
const ymHosts = metricaId ? ["https://mc.yandex.ru", "https://mc.yandex.com"] : [];
const gaHosts = gaId ? ["https://www.googletagmanager.com", "https://www.google-analytics.com"] : [];
const scriptHosts = [...ymHosts, ...gaHosts];
const connectHosts = [...ymHosts, ...gaHosts, ...(gaId ? ["https://region1.google-analytics.com"] : [])];
const imgHosts = [...ymHosts, ...(gaId ? ["https://www.google-analytics.com"] : [])];
const join = (list) => (list.length ? " " + list.join(" ") : "");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
