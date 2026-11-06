import type { Metadata } from "next";
import { site, siteUrl } from "@/config/site";

type OgImage = { url: string; width: number; height: number; alt: string; type?: string };

/**
 * Site-wide share image. Bump the version whenever public/og.png is redrawn:
 * messengers cache previews by URL and would keep showing the old picture.
 */
export const OG_IMAGE_PATH = "/og/cto-positioning.png?v=1";

export const defaultImage: OgImage = {
  url: OG_IMAGE_PATH,
  width: 1200,
  height: 630,
  alt: site.name + ": Внешний технологический директор для бизнеса",
  type: "image/png",
};

/**
 * Per-page metadata with its own canonical, Open Graph and Twitter card. Every
 * page builds its metadata here, so nothing silently inherits the homepage's
 * title, description or URL.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = true,
  type = "website",
  image = defaultImage,
  noindex = false,
}: {
  title: string;
  description: string;
  /** Path starting with "/" */
  path: string;
  /** false → the layout template appends « — MIRONOVICH» */
  absoluteTitle?: boolean;
  type?: "website" | "profile";
  image?: OgImage;
  noindex?: boolean;
}): Metadata {
  const url = siteUrl + (path === "/" ? "" : path);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: { type, locale: "ru_RU", url, siteName: site.name, title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** schema.org BreadcrumbList for the same trail the page shows. */
export function breadcrumbList(items: { name: string; href: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: siteUrl + (c.href === "/" ? "/" : c.href),
    })),
  };
}
