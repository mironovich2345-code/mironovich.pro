import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaLink from "@/components/CtaLink";
import Markdown, { tableOfContents } from "@/components/Markdown";
import { categoryBySlug, categoryHref } from "@/config/blog";
import { serviceBySlug, serviceId } from "@/config/services";
import { contactHref, site, siteUrl } from "@/config/site";
import { formatDate, getPostBySlug, getRoutablePosts, readingTimeLabel, relatedPosts } from "@/lib/blog";
import { jsonLd } from "@/lib/jsonld";
import { OG_IMAGE_PATH, breadcrumbList, defaultImage } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

// Only slugs returned below exist; anything else (including drafts in production) is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getRoutablePosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const url = siteUrl + "/blog/" + post.slug;
  const title = (post.seoTitle ?? post.title) + " — " + site.name;
  const published = post.status === "published";
  const image = post.cover
    ? { url: post.cover.src, width: post.cover.width, height: post.cover.height, alt: post.cover.alt, type: post.cover.type }
    : defaultImage;

  return {
    title: { absolute: title },
    description: post.description,
    alternates: { canonical: url },
    authors: [{ name: site.person, url: siteUrl + "/about" }],
    openGraph: {
      type: "article",
      locale: "ru_RU",
      url,
      siteName: site.name,
      title: post.title,
      description: post.description,
      publishedTime: post.publishDate,
      modifiedTime: post.updatedDate ?? post.publishDate,
      authors: [siteUrl + "/about"],
      section: categoryBySlug(post.category).name,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: [image.url] },
    // a draft is only ever reachable in `next dev`; keep it out of any index regardless
    robots: published ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const url = siteUrl + "/blog/" + post.slug;
  const modified = post.updatedDate ?? post.publishDate;
  const revised = modified !== post.publishDate;
  const category = categoryBySlug(post.category);
  const service = post.service ? serviceBySlug(post.service) : null;
  const toc = tableOfContents(post.blocks);
  // by topic: explicit `related`, then same category, then same service
  const readNext = relatedPosts(post, 3);

  const crumbs = [
    { name: "Главная", href: "/" },
    { name: "Блог", href: "/blog" },
    { name: category.name, href: categoryHref(post.category) },
    { name: post.title, href: "/blog/" + post.slug },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": url + "#article",
        headline: post.title,
        description: post.description,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        inLanguage: "ru-RU",
        datePublished: post.publishDate,
        dateModified: modified,
        articleSection: category.name,
        timeRequired: "PT" + post.readingTime + "M",
        image: post.cover
          ? [{ "@type": "ImageObject", url: siteUrl + post.cover.src, width: post.cover.width, height: post.cover.height }]
          : [siteUrl + OG_IMAGE_PATH],
        author: { "@type": "Person", "@id": siteUrl + "/#person", name: site.person, url: siteUrl + "/about" },
        publisher: { "@type": "Person", "@id": siteUrl + "/#person", name: site.person, url: siteUrl },
        isPartOf: { "@type": "Blog", "@id": siteUrl + "/blog#blog", name: "Блог " + site.name, url: siteUrl + "/blog" },
        ...(service ? { about: { "@type": "Service", "@id": serviceId(siteUrl, service.slug), name: service.title } } : {}),
        breadcrumb: { "@id": url + "#breadcrumb" },
      },
      { ...breadcrumbList(crumbs), "@id": url + "#breadcrumb" },
    ],
  };

  return (
    <>
      <main id="main">
        {/* Hero */}
        <section className="bg-graphite px-[22px] pb-14 pt-6 min-[560px]:pb-20 min-[560px]:pt-10">
          <div className="mx-auto max-w-[780px]">
            {/* the article title is the H1 right below, so the trail stops at the category */}
            <div className="mb-8">
              <Breadcrumbs items={crumbs.slice(0, 3)} />
            </div>

            {post.status === "draft" && (
              <p className="mb-5 inline-block border border-signal/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-signal">
                Черновик — виден только в режиме разработки
              </p>
            )}

            <h1 className="m-0 mb-6 text-balance font-display text-[clamp(32px,6.6vw,56px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-cream">
              {post.title}
            </h1>

            <p className="m-0 mb-6 text-pretty text-[clamp(17px,3.4vw,20px)] leading-[1.55] text-cream/80">{post.excerpt}</p>

            <p className="m-0 text-[13.5px] leading-[1.7] text-stone">
              <Link href="/about" className="text-cream transition-colors hover:text-signal">
                {site.person}
              </Link>
              <span aria-hidden> · </span>
              <time dateTime={post.publishDate}>{formatDate(post.publishDate)}</time>
              <span aria-hidden> · </span>
              {readingTimeLabel(post.readingTime)}
              {revised && (
                <>
                  <span aria-hidden> · </span>
                  обновлено <time dateTime={modified}>{formatDate(modified)}</time>
                </>
              )}
            </p>
          </div>

          {post.cover && (
            <div className="mx-auto mt-10 max-w-[1080px] min-[560px]:mt-14">
              <Image
                src={post.cover.src}
                alt={post.cover.alt}
                width={post.cover.width}
                height={post.cover.height}
                sizes="(max-width: 1080px) 100vw, 1080px"
                priority
                className="block h-auto w-full"
              />
            </div>
          )}
        </section>

        {/* Body */}
        <section className="bg-cream px-[22px] pb-16 pt-12 min-[560px]:pb-24 min-[560px]:pt-16">
          <article className="mx-auto max-w-[760px]">
            {toc.length >= 3 && (
              <details className="group mb-10 border-y border-graphite/15" open>
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between text-[12px] uppercase tracking-[0.18em] text-maroon [&::-webkit-details-marker]:hidden">
                  В статье
                  <span aria-hidden className="font-display text-lg leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <nav aria-label="Содержание статьи" className="pb-5">
                  <ol className="m-0 flex list-none flex-col gap-1 p-0">
                    {toc.map((t, i) => (
                      <li key={t.id}>
                        <a href={"#" + t.id} className="flex min-h-[36px] items-baseline gap-3 py-1 text-[15px] leading-[1.4] text-graphite transition-colors hover:text-maroon">
                          <span className="font-display text-[13px] font-extrabold text-signal">{String(i + 1).padStart(2, "0")}</span>
                          {t.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </details>
            )}

            <Markdown blocks={post.blocks} />
          </article>

          <div className="mx-auto mt-14 flex max-w-[760px] flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-graphite/15 pt-6">
            <div>
              <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-maroon">Автор</p>
              <p className="m-0 mt-2 text-[15px] text-graphite">{site.person}</p>
              <p className="m-0 mt-1 text-[12px] uppercase tracking-[0.12em] text-graphite/65">{site.tagline}</p>
            </div>
            <Link href="/about" className="inline-flex min-h-[44px] items-center whitespace-nowrap text-[14px] uppercase tracking-[0.06em] text-maroon underline underline-offset-4 hover:text-signal">
              Обо мне →
            </Link>
          </div>
        </section>

        {/* Service the article belongs to + CTA */}
        <section className="bg-maroon px-[22px] py-16 min-[560px]:py-20">
          <div className="mx-auto max-w-[780px]">
            {service && (
              <div className="mb-10 border-b border-cream/15 pb-10">
                <p className="m-0 mb-3 text-[11px] uppercase tracking-[0.22em] text-stone">Связанная услуга</p>
                <h2 className="m-0 mb-3 font-display text-[clamp(24px,4vw,36px)] font-extrabold uppercase leading-[1.08] text-cream">
                  <Link href={service.href} className="transition-colors hover:text-signal">
                    {service.title} →
                  </Link>
                </h2>
                <p className="m-0 max-w-[52ch] text-pretty text-[15px] leading-[1.6] text-cream/80">{service.gives}</p>
              </div>
            )}
            <div className="flex flex-col gap-6 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
              <div>
                <p className="m-0 mb-2 font-display text-[clamp(22px,3.4vw,30px)] font-extrabold uppercase leading-[1.1] text-cream">
                  Есть похожая задача?
                </p>
                <p className="m-0 text-pretty text-[15px] leading-[1.6] text-cream/80">Первичное обсуждение — бесплатно.</p>
              </div>
              <CtaLink
                href={contactHref}
                location="article"
                className="inline-flex min-h-[56px] items-center justify-center whitespace-nowrap bg-signal px-5 text-center text-[14px] font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] min-[400px]:px-8 min-[400px]:text-[15px] min-[400px]:tracking-[0.06em]"
              >
                Обсудить задачу бесплатно
              </CtaLink>
            </div>
          </div>
        </section>

        {/* Read next — by topic */}
        {readNext.length > 0 && (
          <section className="bg-cream px-[22px] py-16 min-[560px]:py-20">
            <div className="mx-auto max-w-[780px]">
              <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="m-0 text-[11px] font-normal uppercase tracking-[0.22em] text-maroon">Читать по теме</h2>
                <Link href={categoryHref(post.category)} className="inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.08em] text-maroon underline underline-offset-4 hover:text-signal">
                  Все статьи раздела →
                </Link>
              </div>
              <div className="flex flex-col border-t border-graphite/15">
                {readNext.map((p) => (
                  <Link key={p.slug} href={"/blog/" + p.slug} className="group flex flex-col gap-1.5 border-b border-graphite/15 py-6">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-graphite/65">{categoryBySlug(p.category).name}</span>
                    <span className="max-w-[48ch] text-balance font-display text-[clamp(19px,3.4vw,24px)] font-extrabold uppercase leading-[1.15] tracking-[-0.01em] text-graphite transition-colors group-hover:text-maroon">
                      {p.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
