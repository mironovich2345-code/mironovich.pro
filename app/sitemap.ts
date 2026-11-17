import type { MetadataRoute } from "next";
import { products } from "@/content/products";
import { tools } from "@/config/tools";
import { allServices } from "@/config/services";
import { solutions, solutionHref } from "@/config/solutions";
import { projectsPublished, siteUrl } from "@/config/site";
import { projectsWithCase } from "@/content/projects";
import { MIN_POSTS_TO_INDEX_CATEGORY, categoryHref } from "@/config/blog";
import { categoriesWithPosts, getPostsByCategory, getPublishedPosts, lastBlogUpdate } from "@/lib/blog";

// Published articles are added automatically. Drafts are never listed, and legal
// pages are deliberately excluded — they are noindex, follow. Static pages carry
// no lastmod: a build timestamp would claim a change on every deploy.
export default function sitemap(): MetadataRoute.Sitemap {
  const blogUpdated = lastBlogUpdate();

  return [
    { url: siteUrl + "/", changeFrequency: "monthly", priority: 1 },
    { url: siteUrl + "/solutions", changeFrequency: "monthly", priority: 0.9 },
    ...solutions.map(s => ({ url: siteUrl + solutionHref(s), changeFrequency: "monthly" as const, priority: 0.9 })),
    ...(products.some(p => p.status !== "preparing") ? [{ url: siteUrl + "/products", changeFrequency: "monthly" as const, priority: 0.7 }] : []),
    ...products.filter(p => p.status !== "preparing").map(p => ({ url: siteUrl + "/products/" + p.slug, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: siteUrl + "/tools", changeFrequency: "monthly", priority: 0.8 },
    ...tools.filter((t) => t.status === "available").map((t) => ({ url: siteUrl + t.href, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: siteUrl + "/services", changeFrequency: "monthly", priority: 0.8 },
    { url: siteUrl + "/service-prices", changeFrequency: "monthly", priority: 0.8 },
    { url: siteUrl + "/service-delivery", changeFrequency: "yearly", priority: 0.3 },
    { url: siteUrl + "/service-terms", changeFrequency: "yearly", priority: 0.3 },
    { url: siteUrl + "/service-refunds", changeFrequency: "yearly", priority: 0.3 },
    { url: siteUrl + "/requisites", changeFrequency: "yearly", priority: 0.3 },
    ...allServices.map((s) => ({ url: siteUrl + s.href, changeFrequency: "monthly" as const, priority: 0.9 })),
    // /projects only once it has confirmed entries — an empty portfolio is noindex
    ...(projectsPublished ? [{ url: siteUrl + "/projects", changeFrequency: "monthly" as const, priority: 0.7 }] : []),
    ...projectsWithCase().map((p) => ({
      url: siteUrl + "/projects/" + p.slug,
      ...(p.caseStudy!.publishDate ? { lastModified: new Date(p.caseStudy!.publishDate) } : {}),
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
    // only categories with enough articles to be indexable
    ...categoriesWithPosts()
      .filter((c) => c.count >= MIN_POSTS_TO_INDEX_CATEGORY)
      .map((c) => {
        const latest = getPostsByCategory(c.slug).map((p) => p.updatedDate ?? p.publishDate).sort().pop()!;
        return { url: siteUrl + categoryHref(c.slug), lastModified: new Date(latest), changeFrequency: "weekly" as const, priority: 0.6 };
      }),
    ...getPublishedPosts().map((p) => ({
      url: siteUrl + "/blog/" + p.slug,
      lastModified: new Date(p.updatedDate ?? p.publishDate),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
