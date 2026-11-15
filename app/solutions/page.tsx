import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import Services from "@/components/Services";
import CtoOffer from "@/components/CtoOffer";
import OtherServices from "@/components/OtherServices";
import ContactSection from "@/components/ContactSection";
import { solutions, solutionHref } from "@/config/solutions";
import { siteUrl } from "@/config/site";
import { pageMetadata, breadcrumbList } from "@/lib/seo";
import { jsonLd } from "@/lib/jsonld";
const title = "Решения для сотрудников, продаж и филиалов — MIRONOVICH.PRO";
const description =
  "Пять направлений: корпоративная академия, KPI, управленческая аналитика, стандарты филиалов и ИИ для работы с клиентами. Состав и стартовая цена пилота.";
export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: "/solutions",
});
const crumbs = [
  { name: "Главная", href: "/" },
  { name: "Решения", href: "/solutions" },
];
export default function Page() {
  const graph = [
    {
      "@type": "CollectionPage",
      url: siteUrl + "/solutions",
      name: title,
      description,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: solutions.map((s, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: s.title,
          url: siteUrl + solutionHref(s),
        })),
      },
    },
    breadcrumbList(crumbs),
  ];
  return (
    <>
      <main id="main">
        <section
          id="hero"
          className="bg-graphite px-[22px] pb-5 pt-7 min-[560px]:pt-10"
        >
          <div className="mx-auto max-w-[1080px]">
            <Breadcrumbs items={crumbs} />
            <h1 className="mb-5 mt-7 font-display text-[clamp(38px,7vw,76px)] font-extrabold uppercase leading-tight text-cream">
              Цифровые системы для бизнеса<span className="text-signal">.</span>
            </h1>
          </div>
        </section>
        <Services />
        <CtoOffer />
        <OtherServices />
        <ContactSection />
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({ "@context": "https://schema.org", "@graph": graph }),
        }}
      />
    </>
  );
}
