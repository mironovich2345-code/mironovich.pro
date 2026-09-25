import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";
import { getPublishedPosts, lastBlogUpdate } from "@/lib/blog";

// Published articles are added automatically. Drafts are never listed, and legal
// pages are deliberately excluded — they are noindex, follow.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const blogUpdated = lastBlogUpdate();

  return [
    { url: siteUrl + "/", lastModified, changeFrequency: "monthly", priority: 1 },
    { url: siteUrl + "/about", lastModified, changeFrequency: "yearly", priority: 0.6 },
    {
      url: siteUrl + "/blog",
      lastModified: blogUpdated ? new Date(blogUpdated) : lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...getPublishedPosts().map((p) => ({
      url: siteUrl + "/blog/" + p.slug,
      lastModified: new Date(p.updatedDate ?? p.publishDate),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
