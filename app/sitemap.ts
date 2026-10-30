import type { MetadataRoute } from "next";
import { services } from "@/config/services";
import { projectsPublished, siteUrl } from "@/config/site";
import { projectsWithCase } from "@/content/projects";
import { getPublishedPosts, lastBlogUpdate } from "@/lib/blog";

// Published articles are added automatically. Drafts are never listed, and legal
// pages are deliberately excluded — they are noindex, follow. Static pages carry
// no lastmod: a build timestamp would claim a change on every deploy.
export default function sitemap(): MetadataRoute.Sitemap {
  const blogUpdated = lastBlogUpdate();

  return [
    { url: siteUrl + "/", changeFrequency: "monthly", priority: 1 },
    { url: siteUrl + "/services", changeFrequency: "monthly", priority: 0.8 },
    ...services.map((s) => ({ url: siteUrl + s.href, changeFrequency: "monthly" as const, priority: 0.9 })),
    // /projects only once it has confirmed entries — an empty portfolio is noindex
    ...(projectsPublished ? [{ url: siteUrl + "/projects", changeFrequency: "monthly" as const, priority: 0.7 }] : []),
    ...projectsWithCase().map((p) => ({
      url: siteUrl + "/projects/" + p.slug,
      lastModified: new Date(p.caseStudy!.publishDate),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
    { url: siteUrl + "/about", changeFrequency: "yearly", priority: 0.6 },
    { url: siteUrl + "/contact", changeFrequency: "yearly", priority: 0.7 },
    {
      url: siteUrl + "/blog",
      ...(blogUpdated ? { lastModified: new Date(blogUpdated) } : {}),
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
