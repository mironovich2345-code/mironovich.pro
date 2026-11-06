import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ServicePage from "@/components/ServicePage";
import { isServiceSlug, serviceBySlug, serviceId, allServices } from "@/config/services";
import { site, siteUrl } from "@/config/site";
import { servicePages } from "@/content/services";
import { getPublishedPosts } from "@/lib/blog";
import { jsonLd } from "@/lib/jsonld";
import { breadcrumbList, defaultImage, pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return allServices.map((s) => ({ slug: s.slug }));
}

const crumbsFor = (slug: string, label: string) => [
  { name: "Главная", href: "/" },
  { name: "Услуги", href: "/services" },
  { name: label, href: "/services/" + slug },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isServiceSlug(slug)) return {};
  const page = servicePages[slug];
  return pageMetadata({
    title: page.seo.title,
    description: page.seo.description,
    path: "/services/" + slug,
    image: ["automation", "apps", "training"].includes(slug) ? {
      url: "/og/services-" + slug + ".png?v=1",
      width: 1200,
      height: 630,
      alt: site.name + ": " + page.h1,
      type: "image/png",
    } : defaultImage,
  });
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!isServiceSlug(slug)) notFound();

  const page = servicePages[slug];
  const service = serviceBySlug(slug);
  const url = siteUrl + "/services/" + slug;
  const crumbs = crumbsFor(slug, service.label);

  // only articles that are actually published, in the order the content file lists them
  const published = getPublishedPosts();
  const articles = (page.relatedArticles ?? [])
    .map((s) => published.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const person = { "@id": siteUrl + "/#person" };
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url + "#webpage",
        url,
        name: page.seo.title,
        description: page.seo.description,
        inLanguage: "ru-RU",
        isPartOf: { "@id": siteUrl + "/#website" },
        about: { "@id": serviceId(siteUrl, slug) },
        breadcrumb: { "@id": url + "#breadcrumb" },
      },
      {
        "@type": "Service",
        "@id": serviceId(siteUrl, slug),
        name: page.h1,
        serviceType: service.serviceType,
        description: page.offer,
        url,
        provider: person,
      },
      { "@type": "Person", "@id": siteUrl + "/#person", name: site.person, url: siteUrl + "/about" },
      { ...breadcrumbList(crumbs), "@id": url + "#breadcrumb" },
      {
        "@type": "FAQPage",
        "@id": url + "#faq",
        mainEntity: page.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  };

  return (
    <>
      <ServicePage page={page} crumbs={crumbs} articles={articles} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
