import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import Link from "next/link";
import CtaLink from "@/components/CtaLink";
import Services from "@/components/Services";
import ContactSection from "@/components/ContactSection";
import { directions } from "@/config/directions";
import { siteUrl } from "@/config/site";
import { pageMetadata, breadcrumbList } from "@/lib/seo";
import { jsonLd } from "@/lib/jsonld";
const title = "Решения для сотрудников, продаж и филиалов — MIRONOVICH.PRO";
const description =
  "Пять решений для бизнеса: обучение, мотивация команды, отчётность, контроль филиалов и обработка клиентов. Объём первого этапа и стартовые цены.";
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
        itemListElement: directions.filter((d) => d.solution).map((s, i) => ({
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
          className="bg-graphite px-[22px] pb-5 pt-7 min-[560px]:pt-10"
        >
          <div className="mx-auto max-w-[1080px]">
            <Breadcrumbs items={crumbs} />
            <h1 className="mb-5 mt-7 font-display text-[clamp(38px,7vw,76px)] font-extrabold uppercase leading-tight text-cream">
              Цифровые системы для бизнеса<span className="text-signal">.</span>
            </h1>
            <div className="mt-8 grid gap-6 border-l-2 border-signal bg-[#15151a] p-6 min-[760px]:grid-cols-[minmax(0,1fr)_auto] min-[760px]:items-center min-[760px]:p-8">
              <div>
                <h2 className="m-0 max-w-[24ch] font-display text-[clamp(25px,3vw,34px)] font-extrabold uppercase leading-[1.1] text-cream">
                  Хотите, чтобы бизнес работал проще и быстрее?
                </h2>
                <p className="mb-0 mt-3 max-w-[56ch] text-[15px] leading-relaxed text-cream/75">
                  Не знаете, что автоматизировать и с чего начать? На бесплатном разборе обсудим вашу задачу и выберем разумный первый шаг — без обязательства заказывать разработку. Онлайн-оплата корпоративных услуг через сайт не предусмотрена: стоимость и состав согласуются отдельно.
                </p>
              </div>
              <div className="flex flex-col gap-3 min-[760px]:min-w-[220px]">
                <CtaLink
                  href="/contact"
                  location="solutions_index"
                  className="inline-flex min-h-[48px] items-center justify-center bg-signal px-5 text-center text-[13px] font-medium uppercase tracking-[0.035em] text-white hover:bg-[#b82323]"
                >
                  Получить бесплатный разбор →
                </CtaLink>
                <Link href="/tools/labor-cost" className="inline-flex min-h-[40px] items-center justify-center text-center text-[13px] text-cream underline decoration-cream/35 underline-offset-4 hover:text-signal">
                  Рассчитать ручной труд →
                </Link>
              </div>
            </div>
          </div>
        </section>
        <Services />
        <section className="bg-graphite px-[22px] pb-12">
          <div className="mx-auto max-w-[1080px] border-t border-cream/20 pt-6 text-[14px] leading-relaxed text-cream/80">
            Нужен не отдельный проект, а управление IT или помощь с подрядчиками?{" "}
            <Link href="/services" className="text-cream underline underline-offset-4 hover:text-signal">
              Посмотреть услуги и внешний CTO
            </Link>
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
