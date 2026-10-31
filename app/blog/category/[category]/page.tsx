import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BlogCategoryNav from "@/components/BlogCategoryNav";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaLink from "@/components/CtaLink";
import PostList from "@/components/PostList";
import { MIN_POSTS_TO_INDEX_CATEGORY, categoryBySlug, categoryHref, isCategorySlug } from "@/config/blog";
import { serviceBySlug } from "@/config/services";
import { contactHref, siteUrl } from "@/config/site";
import { categoriesWithPosts, getPostsByCategory } from "@/lib/blog";
import { jsonLd } from "@/lib/jsonld";
import { breadcrumbList, pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ category: string }> };

// A page exists only for a category with published articles; an empty one is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return categoriesWithPosts().map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!isCategorySlug(category)) return {};
  const c = categoryBySlug(category);
  const count = getPostsByCategory(category).length;
  // a thin category stays reachable for readers but out of the index
  return pageMetadata({
    title: c.name + ": статьи — блог MIRONOVICH",
    description: c.description,
    path: categoryHref(category),
    noindex: count < MIN_POSTS_TO_INDEX_CATEGORY,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  if (!isCategorySlug(category)) notFound();
  const posts = getPostsByCategory(category);
  if (posts.length === 0) notFound();

  const c = categoryBySlug(category);
  const service = c.service ? serviceBySlug(c.service) : null;
  const url = siteUrl + categoryHref(category);
  const crumbs = [
    { name: "Главная", href: "/" },
    { name: "Блог", href: "/blog" },
    { name: c.name, href: categoryHref(category) },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": url + "#webpage",
        url,
        name: c.name,
        description: c.description,
        inLanguage: "ru-RU",
        isPartOf: { "@id": siteUrl + "/blog#blog" },
        breadcrumb: { "@id": url + "#breadcrumb" },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: posts.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: siteUrl + "/blog/" + p.slug,
            name: p.title,
          })),
        },
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
            <h1 className="m-0 max-w-[18ch] text-balance font-display text-[clamp(36px,6.4vw,76px)] font-extrabold uppercase leading-[0.96] tracking-[-0.02em] text-cream">
              {c.name}
              <span className="text-signal">.</span>
            </h1>
            <p className="m-0 max-w-[56ch] text-pretty text-[clamp(16px,2.4vw,19px)] leading-[1.55] text-cream/80">{c.about}</p>
            <BlogCategoryNav active={category} />
          </div>
        </section>

        <section className="bg-graphite px-[22px] pb-16 min-[560px]:pb-24">
          <div className="mx-auto max-w-[1080px]">
            <h2 className="m-0 mb-8 text-[11px] font-normal uppercase tracking-[0.22em] text-stone">
              Статьи · {posts.length}
            </h2>
            <PostList posts={posts} />
          </div>
        </section>

        <section className="bg-cream px-[22px] py-14 min-[560px]:py-20">
          <div className="mx-auto flex max-w-[1080px] flex-col gap-6 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
            <div>
              <p className="m-0 mb-3 text-[11px] uppercase tracking-[0.22em] text-maroon">{service ? "Связанная услуга" : "Обсудить задачу"}</p>
              {service ? (
                <h2 className="m-0 mb-3 font-display text-[clamp(24px,3.6vw,34px)] font-extrabold uppercase leading-[1.08] text-graphite">
                  <Link href={service.href} className="transition-colors hover:text-maroon">
                    {service.title} →
                  </Link>
                </h2>
              ) : (
                <h2 className="m-0 mb-3 font-display text-[clamp(24px,3.6vw,34px)] font-extrabold uppercase leading-[1.08] text-graphite">
                  Нужно разобрать ваш процесс?
                </h2>
              )}
              <p className="m-0 max-w-[50ch] text-pretty text-[15px] leading-[1.6] text-graphite/75">
                {service ? service.lead + " " : ""}Первичное обсуждение задачи — бесплатно.
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
