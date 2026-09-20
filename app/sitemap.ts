import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";

// Legal pages are deliberately excluded — they are noindex, follow.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: siteUrl + "/", lastModified, changeFrequency: "monthly", priority: 1 },
    { url: siteUrl + "/about", lastModified, changeFrequency: "yearly", priority: 0.6 },
  ];
}
