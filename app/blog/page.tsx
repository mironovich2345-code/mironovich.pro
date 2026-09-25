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

const hairline = {
  backgroundImage: "linear-gradient(90deg, #3f424d, transparent)",
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% 1px",
} as const;

export default function BlogPage() {
  const posts = getPublishedPosts();

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
      <main className="mx-auto max-w-[1080px] px-[22px] pb-12 pt-8 min-[560px]:pt-12">
        <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">Блог</p>
        <h1 className="m-0 mb-5 max-w-[20ch] text-balance text-[clamp(31px,7vw,56px)] font-medium leading-[1.06] tracking-[-0.035em]">
          Об обучении сотрудников, процессах и системах
        </h1>
        <p className="m-0 max-w-[52ch] text-pretty text-[clamp(15.5px,4vw,19px)] leading-[1.55] text-neutral-400">
          Разбираю адаптацию сотрудников, корпоративное обучение, базы знаний, автоматизацию и AI без лишней теории.
        </p>

        {posts.length > 0 ? (
          <ol className="m-0 mt-12 flex list-none flex-col p-0 min-[560px]:mt-16">
            {posts.map((p) => (
              <li
                key={p.slug}
                className="grid gap-x-11 gap-y-4 pb-11 pt-9 min-[860px]:grid-rows-[auto_1fr] min-[860px]:[grid-template-columns:220px_minmax(0,1fr)]"
                style={hairline}
              >
                <div className="flex flex-col gap-1.5 min-[860px]:col-start-1 min-[860px]:row-start-1">
                  <p className="m-0 text-[11px] uppercase tracking-[0.2em] text-accent-400">{p.category}</p>
                  <p className="m-0 text-[13px] text-neutral-500">
                    <time dateTime={p.publishDate}>{formatDate(p.publishDate)}</time>
                    <span aria-hidden> · </span>
                    {readingTimeLabel(p.readingTime)}
                  </p>
                </div>

                {p.cover && (
                  // decorative here: the title and the link carry the meaning. A slim crop on
                  // phones, the whole scheme as a small thumbnail beside the text on desktop.
                  <Link
                    href={"/blog/" + p.slug}
                    aria-hidden
                    tabIndex={-1}
                    className="block max-w-[420px] min-[860px]:col-start-1 min-[860px]:row-start-2 min-[860px]:max-w-none"
                  >
                    <Image
                      src={p.cover.src}
                      alt=""
                      width={p.cover.width}
                      height={p.cover.height}
                      sizes="(max-width: 860px) 420px, 220px"
                      className="block aspect-[21/9] w-full rounded-md object-cover object-top opacity-90 shadow-[0_0_0_1px_#292b31] transition-opacity hover:opacity-100 min-[860px]:aspect-[4/3]"
                    />
                  </Link>
                )}

                <article className="min-[860px]:col-start-2 min-[860px]:row-span-2 min-[860px]:row-start-1">
                  <h2 className="m-0 mb-3 max-w-[28ch] text-balance text-[clamp(23px,5vw,32px)] font-medium leading-[1.16] tracking-[-0.03em]">
                    <Link href={"/blog/" + p.slug} className="transition-colors hover:text-accent-300">
                      {p.title}
                    </Link>
                  </h2>
                  <p className="m-0 mb-5 max-w-[56ch] text-pretty text-[16px] leading-[1.65] text-neutral-400">{p.excerpt}</p>
                  <Link
                    href={"/blog/" + p.slug}
                    aria-label={"Читать: " + p.title}
                    className="text-[15px] text-accent-300 transition-colors hover:text-accent-100"
                  >
                    Читать →
                  </Link>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <section className="mt-12 max-w-[560px] border-l-2 border-accent-700 pl-[18px] min-[560px]:mt-16">
            <p className="m-0 mb-2 text-[clamp(18px,4vw,22px)] leading-[1.35] tracking-[-0.02em] text-ink">
              Здесь появятся статьи.
            </p>
            <p className="m-0 mb-5 text-pretty text-[15px] leading-[1.65] text-neutral-500">
              Опубликованных материалов пока нет. Если нужна система обучения или адаптации сотрудников, можно не ждать
              статей и просто описать задачу.
            </p>
            <CtaLink
              href="/#contact"
              location="blog"
              className="text-[15px] text-accent-300 underline underline-offset-[3px] hover:text-accent-100"
            >
              Обсудить систему обучения →
            </CtaLink>
          </section>
        )}

        <p className="mt-14 max-w-[52ch] text-[14px] leading-[1.6] text-neutral-500">
          Блог ведёт {site.person}.{" "}
          <Link href="/about" className="whitespace-nowrap text-accent-300 underline underline-offset-[3px] hover:text-accent-100">
            Обо мне →
          </Link>
        </p>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
