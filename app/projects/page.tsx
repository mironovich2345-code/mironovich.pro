import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaLink from "@/components/CtaLink";
import ProjectsByStatus from "@/components/ProjectsByStatus";
import { services } from "@/config/services";
import { contactHref, projectsPublished, siteUrl } from "@/config/site";
import { PROJECT_STATUSES, projects } from "@/content/projects";
import { jsonLd } from "@/lib/jsonld";
import { breadcrumbList, pageMetadata } from "@/lib/seo";

const title = "Проекты и демонстрации — MIRONOVICH";
const description =
  "Реализованные проекты, работы в процессе и демонстрации по автоматизации процессов, разработке приложений и обучению сотрудников.";

// Without confirmed entries the page exists but stays out of the index and the sitemap.
export const metadata: Metadata = pageMetadata({ title, description, path: "/projects", noindex: !projectsPublished });

const crumbs = [
  { name: "Главная", href: "/" },
  { name: "Проекты", href: "/projects" },
];

const ctaClass =
  "inline-flex min-h-[56px] items-center justify-center whitespace-nowrap bg-signal px-5 text-center text-[14px] font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] min-[400px]:px-8 min-[400px]:text-[15px] min-[400px]:tracking-[0.06em]";

export default function ProjectsPage() {
  const url = siteUrl + "/projects";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": url + "#webpage",
        url,
        name: title,
        description,
        inLanguage: "ru-RU",
        isPartOf: { "@id": siteUrl + "/#website" },
        breadcrumb: { "@id": url + "#breadcrumb" },
        ...(projectsPublished
          ? {
              mainEntity: {
                "@type": "ItemList",
                itemListElement: projects.map((p, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  item: {
                    "@type": "CreativeWork",
                    name: p.title,
                    creativeWorkStatus: PROJECT_STATUSES.find((s) => s.value === p.status)!.label,
                    description: p.built,
                    creator: { "@id": siteUrl + "/#person" },
                    ...(p.caseStudy ? { url: url + "/" + p.slug } : {}),
                  },
                })),
              },
            }
          : {}),
      },
      { ...breadcrumbList(crumbs), "@id": url + "#breadcrumb" },
    ],
  };

  return (
    <>
      <main id="main">
        <section id="hero" className="bg-graphite px-[22px] pb-12 pt-6 min-[560px]:pb-16 min-[560px]:pt-10">
          <div className="mx-auto flex max-w-[1080px] flex-col gap-5 min-[560px]:gap-8">
            <Breadcrumbs items={crumbs} />
            <h1 className="m-0 font-display text-[clamp(40px,7vw,88px)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-cream">
              Проекты<span className="text-signal">.</span>
            </h1>
            <div className="flex flex-col gap-4 min-[860px]:flex-row min-[860px]:items-end min-[860px]:justify-between min-[860px]:gap-12">
              <p className="m-0 max-w-[50ch] text-pretty text-[16px] leading-[1.55] text-cream/80 min-[560px]:text-[18px]">
                У каждой работы указан статус: что уже используется, что в разработке, а что сделано как демонстрация.
              </p>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {PROJECT_STATUSES.map((s) => (
                  <li key={s.value} className="border border-cream/25 px-3 py-1.5 text-[12px] uppercase tracking-[0.12em] text-cream/80">
                    {s.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
          <div className="mx-auto max-w-[1080px]">
            {projectsPublished ? (
              <ProjectsByStatus projects={projects} />
            ) : (
              <div className="grid gap-10 min-[860px]:grid-cols-[1.1fr_1fr] min-[860px]:gap-16">
                <div className="border-l-2 border-signal pl-5">
                  <h2 className="m-0 mb-4 font-display text-[clamp(26px,4vw,40px)] font-extrabold uppercase leading-[1.05] text-graphite">
                    Раздел готовится
                  </h2>
                  <p className="m-0 max-w-[48ch] text-pretty text-[16px] leading-[1.65] text-graphite/75">
                    Здесь появятся работы, которые можно показать публично. Конфиденциальные проекты и данные клиентов не
                    публикуются. Пока можно посмотреть, как устроены направления, или сразу обсудить задачу.
                  </p>
                </div>
                <ul className="m-0 flex list-none flex-col border-t border-graphite/15 p-0">
                  {services.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={s.href}
                        className="flex min-h-[56px] items-center justify-between gap-4 border-b border-graphite/15 py-3 text-[16px] uppercase tracking-[0.04em] text-graphite transition-colors hover:text-maroon"
                      >
                        {s.title} <span aria-hidden>→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section className="bg-maroon px-[22px] py-16 min-[560px]:py-20">
          <div className="mx-auto flex max-w-[1080px] flex-col gap-6 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
            <h2 className="m-0 max-w-[20ch] text-balance font-display text-[clamp(28px,4.6vw,44px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-cream">
              Похожая задача? Обсудим.
            </h2>
            <CtaLink href={contactHref} location="projects" className={ctaClass}>
              Обсудить задачу бесплатно
            </CtaLink>
          </div>
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
