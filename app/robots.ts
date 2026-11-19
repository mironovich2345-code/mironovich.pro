import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";

// Staging and other non-production copies set SITE_NOINDEX=1 so they never
// compete with mironovich.pro in search results.
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_NOINDEX === "1" || process.env.CAREER_V3_DEMO === "1") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: siteUrl + "/sitemap.xml",
  };
}
