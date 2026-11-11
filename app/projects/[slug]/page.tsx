import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaLink from "@/components/CtaLink";
import ProjectCard from "@/components/ProjectCard";
import { contactHref, site, siteUrl } from "@/config/site";
import { projectBySlug, projectsWithCase } from "@/content/projects";
import { jsonLd } from "@/lib/jsonld";
import { breadcrumbList, pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

// Case pages exist only for projects that carry a caseStudy; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return projectsWithCase().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p?.caseStudy) return {};
  return pageMetadata({ title: p.title + " — проект MIRONOVICH", description: p.task, path: "/projects/" + p.slug });
}

export default async function CasePage({ params }: Props) {
  const { slug } = await params;
  const p = projectBySlug(slug);
  if (!p?.caseStudy) notFound();

  const url = siteUrl + "/projects/" + p.slug;
  const crumbs = [
    { name: "Главная", href: "/" },
    { name: "Проекты", href: "/projects" },
    { name: p.title, href: "/projects/" + p.slug },
  ];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": url + "#article",
        headline: p.title,
        description: p.task,
        url,
        inLanguage: "ru-RU",
        datePublished: p.caseStudy.publishDate,
        author: { "@type": "Person", "@id": siteUrl + "/#person", name: site.person, url: siteUrl + "/about" },
      },
      { ...breadcrumbList(crumbs), "@id": url + "#breadcrumb" },
    ],
  };

  return (
    <>
      <main id="main">
        <section className="bg-graphite px-[22px] pb-12 pt-6 min-[560px]:pb-16 min-[560px]:pt-10">
          <div className="mx-auto flex max-w-[780px] flex-col gap-6">
            <Breadcrumbs items={crumbs} />
            <h1 className="m-0 text-balance font-display text-[clamp(32px,6vw,60px)] font-extrabold uppercase leading-[1.02] tracking-[-0.02em] text-cream">
              {p.title}
            </h1>
          </div>
        </section>
        <section className="bg-cream px-[22px] py-14 min-[560px]:py-20">
          <div className="mx-auto max-w-[780px]">
            <ProjectCard project={{ ...p, caseStudy: undefined }} />
            <div className="mt-10 flex flex-col gap-10">
              {p.caseStudy.sections.map((s) => (
                <section key={s.heading}>
                  <h2 className="m-0 mb-3 font-display text-[clamp(22px,3vw,30px)] font-extrabold uppercase leading-[1.1] text-graphite">{s.heading}</h2>
                  <p className="m-0 whitespace-pre-line [overflow-wrap:anywhere] text-pretty text-[16.5px] leading-[1.75] text-graphite/80">{s.text}</p>
                </section>
              ))}
            </div>
            <div className="mt-14 border-t border-graphite/15 pt-8">
              <CtaLink href={contactHref} location="projects" className="inline-flex min-h-[56px] items-center justify-center bg-signal px-8 text-[15px] font-medium uppercase tracking-[0.06em] text-white hover:bg-[#b82323]">
                Обсудить похожую задачу
              </CtaLink>
            </div>
          </div>
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
