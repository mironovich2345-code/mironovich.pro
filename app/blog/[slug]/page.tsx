import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import CtaLink from "@/components/CtaLink";
import Markdown from "@/components/Markdown";
import { site, siteUrl } from "@/config/site";
import { formatDate, getPostBySlug, getPublishedPosts, getRoutablePosts, readingTimeLabel } from "@/lib/blog";
import { jsonLd } from "@/lib/jsonld";

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
  const title = (post.seoTitle ?? post.title) + " | " + site.name;
  const published = post.status === "published";
  const image = post.cover
    ? { url: post.cover.src, width: post.cover.width, height: post.cover.height, alt: post.cover.alt, type: post.cover.type }
    : { url: "/og.png", width: 1200, height: 630, alt: site.name, type: "image/png" };

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
      section: post.category,
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

  // Next 2 articles, in publish order, wrapping around — always 2 as long as
  // at least 2 other posts are published. Recommendations only ever point at
  // real published articles, draft or not.
  const published = getPublishedPosts();
  const selfIdx = published.findIndex((p) => p.slug === post.slug);
  const start = selfIdx === -1 ? 0 : selfIdx;
  const readNext: typeof published = [];
  for (let step = 1; readNext.length < 2 && step <= published.length; step++) {
    const candidate = published[(start + step) % published.length];
    if (candidate.slug !== post.slug) readNext.push(candidate);
  }

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
        articleSection: post.category,
        timeRequired: "PT" + post.readingTime + "M",
        image: post.cover
          ? [{ "@type": "ImageObject", url: siteUrl + post.cover.src, width: post.cover.width, height: post.cover.height }]
          : [siteUrl + "/og.png"],
        author: { "@type": "Person", "@id": siteUrl + "/#person", name: site.person, url: siteUrl + "/about" },
        publisher: { "@type": "Person", "@id": siteUrl + "/#person", name: site.person, url: siteUrl },
        isPartOf: { "@type": "Blog", "@id": siteUrl + "/blog#blog", name: "Блог " + site.name, url: siteUrl + "/blog" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl + "/" },
          { "@type": "ListItem", position: 2, name: "Блог", item: siteUrl + "/blog" },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <main>
        {/* Hero */}
        <section className="bg-graphite px-[22px] pb-14 pt-10 min-[560px]:pb-20 min-[560px]:pt-14">
          <div className="mx-auto max-w-[780px]">
            <p className="m-0 mb-8 text-[13px]">
              <Link href="/blog" className="text-stone transition-colors hover:text-cream">
                ← Блог
              </Link>
            </p>

            {post.status === "draft" && (
              <p className="mb-5 inline-block border border-signal/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-signal">
                Черновик — виден только в режиме разработки
              </p>
            )}

            <p className="m-0 mb-4 text-[11px] uppercase tracking-[0.22em] text-signal">
              {post.category}
              <span aria-hidden> / </span>
              <time dateTime={post.publishDate}>{formatDate(post.publishDate)}</time>
            </p>

            <h1 className="m-0 mb-6 text-balance font-display text-[clamp(32px,6.6vw,56px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-cream">
              {post.title}
            </h1>

            <p className="m-0 mb-6 text-pretty text-[clamp(17px,3.4vw,20px)] leading-[1.55] text-stone">{post.excerpt}</p>

            <p className="m-0 text-[13.5px] leading-[1.7] text-stone">
              <Link href="/about" className="text-cream transition-colors hover:text-signal">
                {site.person}
              </Link>
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
            <Markdown blocks={post.blocks} />
          </article>

          <div className="mx-auto mt-14 flex max-w-[760px] flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-graphite/15 pt-6">
            <div>
              <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-maroon">01 / Автор</p>
              <p className="m-0 mt-2 text-[15px] text-graphite">{site.person}</p>
              <p className="m-0 mt-1 text-[11px] uppercase tracking-[0.12em] text-graphite/50">{site.tagline}</p>
            </div>
            <Link href="/about" className="whitespace-nowrap text-[14px] uppercase tracking-[0.06em] text-maroon underline underline-offset-4 hover:text-signal">
              Обо мне →
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-maroon px-[22px] py-16 text-center min-[560px]:py-20">
          <div className="mx-auto max-w-[640px]">
            <h2 className="m-0 mb-5 text-balance font-display text-[clamp(28px,6vw,48px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-cream">
              Есть похожая проблема в компании?
            </h2>
            <p className="m-0 mb-8 text-pretty text-[15px] leading-[1.6] text-stone">
              Можно начать с разбора текущего процесса обучения.
            </p>
            <CtaLink
              href="/#contact"
              location="article"
              className="inline-flex min-h-[54px] items-center justify-center bg-signal px-9 text-base font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323]"
            >
              Разобрать обучение →
            </CtaLink>
          </div>
        </section>

        {/* Read next */}
        {readNext.length > 0 && (
          <section className="bg-cream px-[22px] py-16 min-[560px]:py-20">
            <div className="mx-auto max-w-[780px]">
              <p className="m-0 mb-8 text-[11px] uppercase tracking-[0.22em] text-maroon">Читать дальше</p>
              <div className="flex flex-col border-t border-graphite/15">
                {readNext.map((p) => (
                  <Link
                    key={p.slug}
                    href={"/blog/" + p.slug}
                    className="group flex flex-col gap-1.5 border-b border-graphite/15 py-6 transition-colors"
                  >
                    <span className="text-[11px] uppercase tracking-[0.18em] text-graphite/50">{p.category}</span>
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
