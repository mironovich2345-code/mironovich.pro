import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CtaLink from "@/components/CtaLink";
import Markdown from "@/components/Markdown";
import { site, siteUrl } from "@/config/site";
import { formatDate, getPostBySlug, getRoutablePosts, readingTimeLabel } from "@/lib/blog";
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
      <main className="mx-auto max-w-[720px] px-[22px] pb-12 pt-8 min-[560px]:pt-12">
        <article>
          <header className="mb-10 min-[560px]:mb-12">
            <p className="mb-5 text-[13px]">
              <Link href="/blog" className="text-neutral-500 transition-colors hover:text-accent-300">
                ← Блог
              </Link>
            </p>
            {post.status === "draft" && (
              <p className="mb-4 inline-block rounded-sm border border-accent-700 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-accent-300">
                Черновик — виден только в режиме разработки
              </p>
            )}
            <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">{post.category}</p>
            <h1 className="m-0 mb-6 text-balance text-[clamp(30px,6.6vw,48px)] font-medium leading-[1.1] tracking-[-0.035em]">
              {post.title}
            </h1>
            <p className="m-0 mb-6 text-pretty text-[clamp(17px,4vw,20px)] leading-[1.55] text-neutral-400">{post.excerpt}</p>
            <p className="m-0 text-[13.5px] leading-[1.7] text-neutral-500">
              <Link href="/about" className="text-neutral-300 transition-colors hover:text-accent-300">
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
          </header>

          <Markdown blocks={post.blocks} />
        </article>

        <aside
          aria-label="Об авторе"
          className="mt-14 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-5"
          style={{
            backgroundImage: "linear-gradient(90deg, #3f424d, transparent)",
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 1px",
          }}
        >
          <div>
            <p className="m-0 text-[15px] text-ink">{site.person}</p>
            <p className="m-0 mt-1 text-[11px] uppercase tracking-[0.14em] text-neutral-500">{site.tagline}</p>
          </div>
          <Link href="/about" className="whitespace-nowrap text-[14px] text-accent-300 transition-colors hover:text-accent-100">
            Обо мне →
          </Link>
        </aside>

        <section className="mt-14 text-center">
          <h2 className="m-0 mb-3 text-balance text-[clamp(22px,5.2vw,30px)] font-medium leading-[1.2] tracking-[-0.025em]">
            Есть похожая проблема в вашей компании?
          </h2>
          <p className="m-0 mx-auto mb-6 max-w-[52ch] text-pretty text-[15px] leading-[1.6] text-neutral-500">
            Можно начать с разбора текущего процесса обучения — без готового ТЗ и без обязательства сразу создавать большую
            систему.
          </p>
          <CtaLink
            href="/#contact"
            location="article"
            className="inline-flex min-h-[54px] items-center justify-center rounded-md border border-accent bg-accent-900 px-[30px] text-base font-medium tracking-[-0.01em] text-accent-200 transition-colors hover:border-accent-400 hover:bg-accent-800 hover:text-accent-100"
          >
            Обсудить систему обучения
          </CtaLink>
        </section>

        <p className="mt-10 text-center text-[14px]">
          <Link href="/blog" className="text-neutral-500 transition-colors hover:text-accent-300">
            ← Все статьи блога
          </Link>
        </p>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
