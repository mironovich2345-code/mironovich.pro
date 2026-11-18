import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtoOffer from "@/components/CtoOffer";
import ContactSection from "@/components/ContactSection";
import { allServices } from "@/config/services";
import { siteUrl } from "@/config/site";
import { pageMetadata, breadcrumbList } from "@/lib/seo";
import { jsonLd } from "@/lib/jsonld";

const title = "Услуги: разработка, внедрение и внешний CTO — MIRONOVICH.PRO";
const description =
  "Внешний технический директор, разработка, автоматизация, экспертиза и сопровождение. Выберите конкретную услугу или формат управления.";
export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: "/services",
});
const crumbs = [
  { name: "Главная", href: "/" },
  { name: "Услуги", href: "/services" },
];
export default function Page() {
  const graph = [
    {
      "@type": "CollectionPage",
      url: siteUrl + "/services",
      name: title,
      description,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: allServices.map((s, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: s.title,
          url: siteUrl + s.href,
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
          className="bg-graphite px-[22px] pb-14 pt-7 min-[560px]:pt-10"
        >
          <div className="mx-auto max-w-[1080px]">
            <Breadcrumbs items={crumbs} />
            <h1 className="mb-6 mt-7 font-display text-[clamp(38px,7vw,76px)] font-extrabold uppercase leading-tight text-cream">
              Разработка, внедрение и техническое управление
              <span className="text-signal">.</span>
            </h1>
            <p className="max-w-[64ch] text-[17px] leading-relaxed text-cream/80">
              Конкретную систему можно заказать как проект. Управление
              несколькими системами и подрядчиками — отдельный формат внешнего
              CTO. Для точечной задачи есть дополнительные услуги.
            </p>
            <Link
              href="/solutions"
              className="mt-6 inline-flex min-h-[52px] items-center bg-signal px-6 text-white"
            >
              Выбрать задачу и посмотреть цены →
            </Link>
          </div>
        </section>
        <CtoOffer />
        <section className="bg-cream px-[22px] pb-14">
          <div className="mx-auto max-w-[1080px]">
            <h2 className="m-0 mb-5 font-display text-[28px] font-extrabold uppercase text-graphite">
              Отдельные услуги
            </h2>
            <p className="text-[15px] leading-relaxed text-graphite/75">
              Если нужна одна конкретная работа: разработка, доработка, сопровождение,
              обучение команды или независимая экспертиза.
            </p>
            <nav
              aria-label="Отдельные услуги"
              className="flex flex-wrap gap-x-8 gap-y-2"
            >
              {allServices.filter((s) => s.slug !== "cto").map((s) => (
                <Link
                  key={s.slug}
                  href={s.href}
                  className="inline-flex min-h-[44px] items-center text-[15px] text-maroon underline underline-offset-4"
                >
                  {s.title} →
                </Link>
              ))}
            </nav>
          </div>
        </section>
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
