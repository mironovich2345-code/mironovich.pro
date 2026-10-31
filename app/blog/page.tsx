import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import BlogCategoryNav from "@/components/BlogCategoryNav";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaLink from "@/components/CtaLink";
import PostList from "@/components/PostList";
import { categoryBySlug, categoryHref } from "@/config/blog";
import { contactHref, site, siteUrl } from "@/config/site";
import { categoriesWithPosts, formatDate, getPublishedPosts, readingTimeLabel } from "@/lib/blog";
import { jsonLd } from "@/lib/jsonld";
import { breadcrumbList, pageMetadata } from "@/lib/seo";

const title = "Блог об автоматизации, приложениях и обучении — MIRONOVICH";
const description =
  "Практические разборы автоматизации процессов, разработки приложений, ИИ для бизнеса и обучения сотрудников. Без лишней теории.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/blog" });

const crumbs = [
  { name: "Главная", href: "/" },
  { name: "Блог", href: "/blog" },
];

export default function BlogPage() {
  const posts = getPublishedPosts();
  const [featured, ...rest] = posts;
  const categories = categoriesWithPosts();
  const url = siteUrl + "/blog";

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": url + "#blog",
        url,
        name: "Блог " + site.name,
        description,
        inLanguage: "ru-RU",
        isPartOf: { "@id": siteUrl + "/#website" },
        author: { "@type": "Person", "@id": siteUrl + "/#person", name: site.person, url: siteUrl + "/about" },
        breadcrumb: { "@id": url + "#breadcrumb" },
        ...(posts.length > 0
          ? {
              blogPost: posts.map((p) => ({
                "@type": "BlogPosting",
                headline: p.title,
                url: siteUrl + "/blog/" + p.slug,
                datePublished: p.publishDate,
                articleSection: categoryBySlug(p.category).name,
                ...(p.cover ? { image: siteUrl + p.cover.src } : {}),
              })),
            }
          : {}),
      },
      { ...breadcrumbList(crumbs), "@id": url + "#breadcrumb" },
    ],
  };

  return (
    <>
      <main id="main">
        <section className="bg-graphite px-[22px] pb-10 pt-6 min-[560px]:pb-14 min-[560px]:pt-10">
          <div className="mx-auto flex max-w-[1080px] flex-col gap-5 min-[560px]:gap-8">
            <Breadcrumbs items={crumbs} />
            <h1 className="m-0 font-display text-[clamp(44px,8vw,96px)] font-extrabold uppercase leading-[0.94] tracking-[-0.025em] text-cream">
              Блог<span className="text-signal">.</span>
            </h1>
            <p className="m-0 max-w-[52ch] text-pretty text-[clamp(16px,2.4vw,19px)] leading-[1.55] text-cream/80">
              Разборы для руководителей: автоматизация процессов, приложения для бизнеса, ИИ и обучение сотрудников.
            </p>
            <BlogCategoryNav />
          </div>
        </section>

        {featured ? (
          <>
            {/* Featured article — DOM is [image, text] so mobile shows image → title; grid areas put text left on desktop. */}
            <section className="bg-cream px-[22px] py-14 min-[560px]:py-20">
              <div className="mx-auto max-w-[1080px]">
                <p className="m-0 mb-8 text-[11px] uppercase tracking-[0.22em] text-maroon min-[560px]:mb-10">Новое</p>
                <div className="grid gap-8 min-[860px]:grid-cols-[1.05fr_0.95fr] min-[860px]:items-center min-[860px]:gap-16 min-[860px]:[grid-template-areas:'text_image']">
                  {featured.cover && (
                    <Link href={"/blog/" + featured.slug} className="block min-[860px]:[grid-area:image]" aria-hidden tabIndex={-1}>
                      <Image
                        src={featured.cover.src}
                        alt=""
                        width={featured.cover.width}
                        height={featured.cover.height}
                        sizes="(max-width: 860px) 100vw, 50vw"
                        priority
                        className="block aspect-[4/3] w-full object-cover"
                      />
                    </Link>
                  )}
                  <div className="min-[860px]:[grid-area:text]">
                    <Link
                      href={categoryHref(featured.category)}
                      className="mb-3 inline-flex min-h-[28px] items-center text-[11px] uppercase tracking-[0.2em] text-signal hover:text-maroon"
                    >
                      {categoryBySlug(featured.category).name}
                    </Link>
                    <h2 className="m-0 mb-4 text-balance font-display text-[clamp(28px,5vw,44px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-graphite">
                      <Link href={"/blog/" + featured.slug} className="transition-colors hover:text-maroon">
                        {featured.title}
                      </Link>
                    </h2>
                    <p className="m-0 mb-6 max-w-[58ch] text-pretty text-[16px] leading-[1.7] text-graphite/75">{featured.excerpt}</p>
                    <p className="m-0 mb-6 text-[13px] text-graphite/65">
                      <time dateTime={featured.publishDate}>{formatDate(featured.publishDate)}</time>
                      <span aria-hidden> · </span>
                      {readingTimeLabel(featured.readingTime)}
                    </p>
                    <Link
                      href={"/blog/" + featured.slug}
                      className="inline-flex min-h-[44px] items-center text-[15px] uppercase tracking-[0.06em] text-maroon underline underline-offset-4 transition-colors hover:text-signal"
                    >
                      Читать →
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {rest.length > 0 && (
              <section className="bg-graphite px-[22px] py-16 min-[560px]:py-24">
                <div className="mx-auto max-w-[1080px]">
                  <h2 className="m-0 mb-10 text-[11px] font-normal uppercase tracking-[0.22em] text-stone min-[560px]:mb-14">Все материалы</h2>
                  <PostList posts={rest} startAt={2} />
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
            <div className="mx-auto max-w-[1080px]">
              <p className="m-0 max-w-[560px] border-l-2 border-signal pl-5 text-[16px] leading-[1.65] text-graphite/75">
                Опубликованных материалов пока нет.
              </p>
            </div>
          </section>
        )}

        {/* What the blog covers — a category appears here only once it has a published article */}
        {categories.length > 0 && (
          <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
            <div className="mx-auto max-w-[1080px]">
              <h2 className="m-0 mb-10 max-w-[18ch] text-balance font-display text-[clamp(28px,4.6vw,44px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-graphite min-[560px]:mb-14">
                Разделы блога
              </h2>
              <ul className="m-0 grid list-none grid-cols-1 border-t border-graphite/15 p-0 min-[760px]:grid-cols-2 min-[760px]:gap-x-12">
                {categories.map((c) => (
                  <li key={c.slug} className="border-b border-graphite/15 py-6">
                    <h3 className="m-0 mb-2 font-display text-[clamp(19px,2.4vw,23px)] font-extrabold uppercase leading-[1.15] text-graphite">
                      <Link href={categoryHref(c.slug)} className="transition-colors hover:text-maroon">
                        {c.name} →
                      </Link>
                    </h3>
                    <p className="m-0 max-w-[50ch] text-pretty text-[15px] leading-[1.6] text-graphite/75">{c.description}</p>
                    <p className="m-0 mt-2 text-[12px] uppercase tracking-[0.14em] text-graphite/65">Статей: {c.count}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="bg-maroon px-[22px] py-14 min-[560px]:py-20">
          <div className="mx-auto flex max-w-[1080px] flex-col gap-6 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
            <div>
              <h2 className="m-0 mb-3 max-w-[22ch] text-balance font-display text-[clamp(26px,4.4vw,40px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-cream">
                Есть задача, а не только вопрос?
              </h2>
              <p className="m-0 max-w-[48ch] text-pretty text-[15px] leading-[1.6] text-cream/80">
                Блог ведёт {site.person}.{" "}
                <Link href="/about" className="text-cream underline underline-offset-4 hover:text-signal">Обо мне</Link>
                {" · "}
                <Link href="/services" className="text-cream underline underline-offset-4 hover:text-signal">Услуги</Link>
              </p>
            </div>
            <CtaLink
              href={contactHref}
              location="blog"
              className="inline-flex min-h-[56px] items-center justify-center whitespace-nowrap bg-signal px-5 text-center text-[14px] font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] min-[400px]:px-8 min-[400px]:text-[15px] min-[400px]:tracking-[0.06em]"
            >
              Обсудить задачу бесплатно
            </CtaLink>
          </div>
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
