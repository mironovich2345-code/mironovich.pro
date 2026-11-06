import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import ContactSection from "@/components/ContactSection";
import CtaLink from "@/components/CtaLink";
import StickyCta from "@/components/StickyCta";
import { serviceId, services } from "@/config/services";
import { siteUrl } from "@/config/site";
import { jsonLd } from "@/lib/jsonld";
import { breadcrumbList, pageMetadata } from "@/lib/seo";

const title = "Внешний CTO, разработка и сопровождение — услуги MIRONOVICH";
const description =
  "Четыре направления: внешний CTO, разработка и автоматизация, техническое сопровождение и независимая экспертиза. Выбор формата работы под задачу бизнеса.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/services" });

const crumbs = [
  { name: "Главная", href: "/" },
  { name: "Услуги", href: "/services" },
];

const ctaClass =
  "inline-flex min-h-[56px] items-center justify-center whitespace-nowrap bg-signal px-5 text-center text-[14px] font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] min-[400px]:px-8 min-[400px]:text-[15px] min-[400px]:tracking-[0.06em]";

/**
 * Catalogue of the four directions. Deliberately different from the homepage
 * services block: it answers «which one fits me» (fit + example tasks) and sends
 * the visitor on to the full page, instead of repeating what each one includes.
 */
export default function ServicesIndex() {
  const url = siteUrl + "/services";
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
        mainEntity: {
          "@type": "ItemList",
          itemListElement: services.map((s, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: siteUrl + s.href,
            item: { "@type": "Service", "@id": serviceId(siteUrl, s.slug), name: s.title, url: siteUrl + s.href },
          })),
        },
      },
      { ...breadcrumbList(crumbs), "@id": url + "#breadcrumb" },
    ],
  };

  return (
    <>
      <main id="main">
        <section id="hero" className="relative overflow-hidden bg-graphite px-[22px] pb-12 pt-6 min-[560px]:pb-16 min-[560px]:pt-10">
          <p
            aria-hidden
            className="pointer-events-none absolute -right-6 bottom-[-0.12em] hidden select-none whitespace-nowrap font-display text-[clamp(140px,20vw,300px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream/[0.04] min-[860px]:block"
          >
            Services
          </p>
          <div className="relative mx-auto flex max-w-[1080px] flex-col gap-5 min-[560px]:gap-8">
            <Breadcrumbs items={crumbs} />
            <h1 className="m-0 max-w-[16ch] text-balance font-display text-[clamp(36px,6.4vw,84px)] font-extrabold uppercase leading-[0.96] tracking-[-0.02em] text-cream">
              Технологический партнёр для бизнеса<span className="text-signal">.</span>
            </h1>
            <div className="flex flex-col gap-6 min-[860px]:flex-row min-[860px]:items-end min-[860px]:justify-between min-[860px]:gap-12 min-[860px]:border-t min-[860px]:border-cream/15 min-[860px]:pt-8">
              <p className="m-0 max-w-[50ch] text-pretty text-[16px] leading-[1.55] text-cream/80 min-[560px]:text-[18px]">
                Помогаю выбрать решение, организовать реализацию и сопровождать продукт. Внешний CTO — это технологический руководитель, который подключается к задачам бизнеса в согласованном объёме.
              </p>
              <CtaLink href="#contact" location="services_index" className={ctaClass}>
                Обсудить задачу бесплатно
              </CtaLink>
            </div>
          </div>
        </section>

        <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
          <div className="mx-auto max-w-[1080px]">
            <ol className="m-0 flex list-none flex-col border-t border-graphite/15 p-0">
              {services.map((s) => (
                <li key={s.slug} className="border-b border-graphite/15">
                  <Link
                    href={s.href}
                    className="group grid grid-cols-1 gap-5 py-10 min-[860px]:grid-cols-[120px_1.1fr_1fr] min-[860px]:gap-10 min-[860px]:py-12"
                  >
                    <span className="font-display text-[clamp(44px,6vw,72px)] font-extrabold leading-none tracking-[-0.02em] text-signal">
                      {s.index}
                    </span>
                    <div>
                      <p className="m-0 mb-2 text-[11px] uppercase tracking-[0.18em] text-graphite/65">{s.label}</p>
                      <h2 className="m-0 mb-4 text-balance font-display text-[clamp(26px,3.6vw,40px)] font-extrabold uppercase leading-[1.05] tracking-[-0.015em] text-graphite transition-colors group-hover:text-maroon">
                        {s.title}
                      </h2>
                      <p className="m-0 max-w-[46ch] text-pretty text-[16px] leading-[1.6] text-graphite/75">{s.fit}</p>
                    </div>
                    <div className="flex flex-col justify-between gap-6">
                      <div>
                        <p className="m-0 mb-3 text-[11px] uppercase tracking-[0.16em] text-graphite/65">Например</p>
                        <ul className="m-0 flex list-none flex-col gap-2 p-0">
                          {s.examples.map((e) => (
                            <li key={e} className="flex gap-3 text-[15px] leading-[1.45] text-graphite">
                              <span aria-hidden className="text-signal">—</span>
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <span className="inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.1em] text-maroon underline decoration-maroon/30 underline-offset-4 transition-colors group-hover:text-signal">
                        Подробнее о направлении →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-maroon px-[22px] py-16 min-[560px]:py-20">
          <div className="mx-auto grid max-w-[1080px] gap-8 min-[860px]:grid-cols-[1.1fr_1fr] min-[860px]:items-end min-[860px]:gap-16">
            <div>
              <h2 className="m-0 mb-5 max-w-[18ch] text-balance font-display text-[clamp(28px,4.6vw,44px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-cream">
                Задача на стыке направлений?
              </h2>
              <p className="m-0 max-w-[50ch] text-pretty text-[16px] leading-[1.6] text-cream/80">
                Например, сначала нужно оценить чужой продукт, затем принять его на сопровождение и спланировать доработки. Формат работы определим после обсуждения.
              </p>
            </div>
            <div className="flex flex-col gap-3 border-t border-cream/15 pt-6 text-[14.5px] leading-[1.6] text-cream/80 min-[860px]:border-l min-[860px]:border-t-0 min-[860px]:pl-8 min-[860px]:pt-0">
              <p className="m-0">
                <span className="text-cream">Первичное обсуждение — бесплатно.</span> Возможные варианты решения и
                следующие шаги.
              </p>
              <p className="m-0">
                <span className="text-cream">Технический разбор — платно.</span> Аудит, экспертиза и регулярное участие — отдельные форматы; объём и стоимость согласуются заранее.
              </p>
            </div>
          </div>
        </section>

        <ContactSection index="01" />
      </main>
      <StickyCta />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
