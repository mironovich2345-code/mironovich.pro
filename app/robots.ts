import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";

// Staging and other non-production copies set SITE_NOINDEX=1 so they never
// compete with mironovich.pro in search results.
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_NOINDEX === "1" || process.env.CAREER_V3_DEMO === "1") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    // Personal cabinets (learning app behind the proxy) stay out of search engines: also X-Robots-Tag noindex there.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/career", "/admin", "/career-app/", "/preview-"] }],
    sitemap: siteUrl + "/sitemap.xml",
  };
}
