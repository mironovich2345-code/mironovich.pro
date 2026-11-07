import type { ReactNode } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import Faq from "@/components/Faq";
import { breadcrumbList } from "@/lib/seo";
import { jsonLd } from "@/lib/jsonld";
import { siteUrl } from "@/config/site";

export default function ToolPage({ path, title, description, faq, children }: { path: string; title: string; description: string; faq: [string, string][]; children: ReactNode }) {
  const crumbs = [{ name: "Главная", href: "/" }, { name: "Инструменты", href: "/tools" }, ...(path === "/tools" ? [] : [{ name: title, href: path }])];
  const structured = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": siteUrl + path + "#webpage", url: siteUrl + path, name: title, description, inLanguage: "ru-RU", isPartOf: { "@id": siteUrl + "/#website" } },
    breadcrumbList(crumbs),
    { "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ] };
  return <main id="main">
    <section id="hero" className="bg-graphite px-[22px] pb-12 pt-7 min-[560px]:pb-16 min-[560px]:pt-10">
      <div className="mx-auto max-w-[1080px]">
        <Breadcrumbs items={crumbs} />
        <p className="mb-5 mt-8 text-[11px] uppercase tracking-[0.18em] text-signal">MIRONOVICH / Бесплатные инструменты</p>
        <h1 className="m-0 max-w-[24ch] text-balance font-display text-[clamp(32px,5.5vw,72px)] font-extrabold uppercase leading-[1.02] tracking-[-0.02em] text-cream">{title}<span className="text-signal">.</span></h1>
        <p className="mb-0 mt-6 max-w-[65ch] text-pretty text-[17px] leading-[1.65] text-cream/80">{description}</p>
      </div>
    </section>
    <section className="bg-graphite px-[22px] pb-16 min-[560px]:pb-24"><div className="mx-auto max-w-[1080px]">{children}</div></section>
    <Faq items={faq} title="Как устроен расчёт" index="03" continued={false} />
    <section className="bg-graphite px-[22px] py-10"><div className="mx-auto flex max-w-[1080px] flex-wrap gap-x-8 gap-y-2 text-sm text-stone"><Link href="/tools" className="inline-flex min-h-[44px] items-center underline underline-offset-4">Все инструменты</Link><Link href="/services/development" className="inline-flex min-h-[44px] items-center underline underline-offset-4">Разработка и автоматизация</Link><Link href="/services/support" className="inline-flex min-h-[44px] items-center underline underline-offset-4">Сопровождение</Link></div></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
  </main>;
}
