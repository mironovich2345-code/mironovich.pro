import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import CtaLink from "@/components/CtaLink";
import { site, siteUrl } from "@/config/site";
import { formatDate, getPublishedPosts, readingTimeLabel } from "@/lib/blog";
import { jsonLd } from "@/lib/jsonld";

const title = "Блог об обучении и адаптации сотрудников | " + site.name;
const description =
  "Разбираю адаптацию сотрудников, корпоративное обучение, базы знаний, автоматизацию и AI без лишней теории. Блог Данила Мироновича.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: siteUrl + "/blog" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: siteUrl + "/blog",
    siteName: site.name,
    title,
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: site.name, type: "image/png" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  robots: { index: true, follow: true },
};

export default function BlogPage() {
  const posts = getPublishedPosts();
  const [featured, ...rest] = posts;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": siteUrl + "/blog#blog",
    url: siteUrl + "/blog",
    name: "Блог " + site.name,
    description,
    inLanguage: "ru-RU",
    isPartOf: { "@id": siteUrl + "/#website" },
    author: { "@type": "Person", "@id": siteUrl + "/#person", name: site.person, url: siteUrl + "/about" },
    ...(posts.length > 0
      ? {
          blogPost: posts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: siteUrl + "/blog/" + p.slug,
            datePublished: p.publishDate,
            ...(p.cover ? { image: siteUrl + p.cover.src } : {}),
          })),
        }
      : {}),
  };

  return (
    <>
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-graphite px-[22px] py-16 min-[560px]:py-24">
          <p
            aria-hidden
            className="pointer-events-none absolute -right-4 -top-4 select-none whitespace-nowrap font-display text-[clamp(120px,26vw,300px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream/5"
          >
            Journal
          </p>

          <div className="relative mx-auto max-w-[1080px]">
            <p className="m-0 mb-10 text-[11px] uppercase tracking-[0.22em] text-signal min-[560px]:mb-14">
              Mironovich Journal / 2026
            </p>
            <h1 className="m-0 mb-6 font-display text-[clamp(44px,10vw,104px)] font-extrabold uppercase leading-[0.94] tracking-[-0.025em] text-cream">
              Обучение.
              <br />
              Люди.
              <br />
              Системы.
            </h1>
            <p className="m-0 max-w-[48ch] text-pretty text-[clamp(16px,3.4vw,19px)] leading-[1.6] text-stone">
              Практические разборы адаптации сотрудников, корпоративного обучения, управления знаниями, автоматизации
              и AI.
            </p>
          </div>
        </section>

        {posts.length > 0 ? (
          <>
            {/* Featured article — not a card: DOM is [image, text] so mobile shows image → title → excerpt;
                grid-template-areas remaps it to text-left/image-right at 860px+. */}
            <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
              <div className="mx-auto max-w-[1080px]">
                <p className="m-0 mb-8 text-[11px] uppercase tracking-[0.22em] text-maroon min-[560px]:mb-10">
                  01 / Читать сейчас
                </p>

                <div className="grid gap-8 min-[860px]:grid-cols-[1.05fr_0.95fr] min-[860px]:items-center min-[860px]:gap-16 min-[860px]:[grid-template-areas:'text_image']">
                  {featured.cover && (
                    <Link href={"/blog/" + featured.slug} className="block min-[860px]:[grid-area:image]">
                      <Image
                        src={featured.cover.src}
                        alt={featured.cover.alt}
                        width={featured.cover.width}
                        height={featured.cover.height}
                        sizes="(max-width: 860px) 100vw, 50vw"
                        priority
                        className="block aspect-[4/3] w-full object-cover"
                      />
                    </Link>
                  )}

                  <div className="min-[860px]:[grid-area:text]">
                    <p className="m-0 mb-3 text-[11px] uppercase tracking-[0.2em] text-signal">{featured.category}</p>
                    <h2 className="m-0 mb-4 text-balance font-display text-[clamp(28px,5vw,44px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-graphite">
                      <Link href={"/blog/" + featured.slug} className="transition-colors hover:text-maroon">
                        {featured.title}
                      </Link>
                    </h2>
                    <p className="m-0 mb-6 max-w-[58ch] text-pretty text-[16px] leading-[1.7] text-graphite/70">
                      {featured.excerpt}
                    </p>
                    <p className="m-0 mb-6 text-[13px] text-graphite/50">
                      <time dateTime={featured.publishDate}>{formatDate(featured.publishDate)}</time>
                      <span aria-hidden> · </span>
                      {readingTimeLabel(featured.readingTime)}
                    </p>
                    <Link
                      href={"/blog/" + featured.slug}
                      className="text-[15px] uppercase tracking-[0.06em] text-maroon underline underline-offset-4 transition-colors hover:text-signal"
                    >
                      Читать →
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* Remaining articles — editorial list, no cards. Thumbnail is small and desktop-only; title carries the scan. */}
            {rest.length > 0 && (
              <section className="bg-graphite px-[22px] py-16 min-[560px]:py-24">
                <div className="mx-auto max-w-[1080px]">
                  <p className="m-0 mb-10 text-[11px] uppercase tracking-[0.22em] text-stone min-[560px]:mb-14">
                    Ещё материалы
                  </p>

                  <ol className="m-0 flex list-none flex-col border-t border-cream/15 p-0">
                    {rest.map((p, i) => (
                      <li key={p.slug} className="grid grid-cols-1 gap-5 border-b border-cream/15 py-9 min-[640px]:grid-cols-[88px_1fr] min-[640px]:gap-8">
                        <span className="font-display text-[18px] font-extrabold text-signal">
                          № {String(i + 2).padStart(2, "0")}
                        </span>

                        <div className="grid gap-5 min-[700px]:grid-cols-[140px_1fr] min-[700px]:items-start">
                          {p.cover && (
                            <Link href={"/blog/" + p.slug} aria-hidden tabIndex={-1} className="hidden min-[700px]:block">
                              <Image
                                src={p.cover.src}
                                alt=""
                                width={p.cover.width}
                                height={p.cover.height}
                                sizes="140px"
                                className="block aspect-[4/3] w-full object-cover opacity-90 transition-opacity hover:opacity-100"
                              />
                            </Link>
                          )}
                          <div>
                            <p className="m-0 mb-2 text-[11px] uppercase tracking-[0.2em] text-signal">{p.category}</p>
                            <h3 className="m-0 mb-2.5 max-w-[32ch] text-balance font-display text-[clamp(21px,3.4vw,27px)] font-extrabold uppercase leading-[1.1] tracking-[-0.015em] text-cream">
                              <Link href={"/blog/" + p.slug} className="transition-colors hover:text-signal">
                                {p.title}
                              </Link>
                            </h3>
                            <p className="m-0 mb-3 max-w-[56ch] text-pretty text-[15px] leading-[1.6] text-stone">{p.excerpt}</p>
                            <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-stone/70">
                              <span>
                                <time dateTime={p.publishDate}>{formatDate(p.publishDate)}</time>
                                <span aria-hidden> · </span>
                                {readingTimeLabel(p.readingTime)}
                              </span>
                              <Link
                                href={"/blog/" + p.slug}
                                className="text-cream underline underline-offset-4 transition-colors hover:text-signal"
                              >
                                Читать →
                              </Link>
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
            <div className="mx-auto max-w-[1080px]">
              <div className="max-w-[560px] border-l-2 border-signal pl-5">
                <p className="m-0 mb-2 font-display text-[clamp(20px,4vw,24px)] font-extrabold uppercase leading-[1.2] text-graphite">
                  Здесь появятся статьи.
                </p>
                <p className="m-0 mb-5 text-pretty text-[15px] leading-[1.65] text-graphite/60">
                  Опубликованных материалов пока нет. Если нужна система обучения или адаптации сотрудников, можно не
                  ждать статей и просто описать задачу.
                </p>
                <CtaLink
                  href="/#contact"
                  location="blog"
                  className="text-[15px] uppercase tracking-[0.04em] text-maroon underline underline-offset-4 hover:text-signal"
                >
                  Обсудить систему обучения →
                </CtaLink>
              </div>
            </div>
          </section>
        )}

        <section className="bg-cream px-[22px] py-10">
          <p className="m-0 mx-auto max-w-[1080px] text-[14px] leading-[1.6] text-graphite/60">
            Блог ведёт {site.person}.{" "}
            <Link href="/about" className="whitespace-nowrap text-maroon underline underline-offset-4 hover:text-signal">
              Обо мне →
            </Link>
          </p>
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
