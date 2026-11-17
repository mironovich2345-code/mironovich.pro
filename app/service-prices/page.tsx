import type { Metadata } from "next";
import Link from "next/link";
import MerchantInfoPage from "@/components/MerchantInfoPage";
import { solutions, solutionHref, rub } from "@/config/solutions";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Услуги и цены — MIRONOVICH.PRO",
  description: "Реальные предложения: внешний CTO от 150 000 ₽ в месяц и пять направлений разработки с пилотными тарифами.",
  path: "/service-prices",
});

export default function ServicePrices() {
  return <MerchantInfoPage path="/service-prices" title="Услуги и цены" lead="Работаю с компаниями над разработкой приложений, управленческими системами и техническими решениями. Ниже — реальные направления, доступные для обсуждения и заказа, и открытые стартовые тарифы. Итоговая цена, объём и срок закрепляются письменно до оплаты."
      sections={[{heading:"Внешний технологический директор",paragraphs:[
        "150 000 ₽ в месяц, до 30 часов. Технологические приоритеты, оценка смет и подрядчиков, управление задачами разработки, контроль качества и приёмка.",
        "Это отдельный формат сопровождения, а не готовый цифровой товар. Срок начала, список задач и порядок коммуникаций согласовываются с заказчиком.",
      ]}] }>
    <section className="bg-cream px-[22px] pb-20 pt-5 text-graphite">
      <div className="mx-auto max-w-[940px]">
        <h2 className="mb-7 font-display text-3xl font-extrabold uppercase">Пилотные проекты и MVP</h2>
        <div className="grid gap-6 min-[700px]:grid-cols-2">
          {solutions.map(s=><article key={s.slug} className="border-t-2 border-graphite pt-5">
            <h3 className="mb-2 text-xl font-semibold"><Link href={solutionHref(s)} className="underline underline-offset-4">{s.title}</Link></h3>
            <p className="my-2 text-2xl font-bold">от {rub(s.pilot)}</p>
            <p className="my-2 text-[15px] leading-relaxed text-graphite/85">{s.pilotScope}</p>
            <p className="my-2 text-sm text-graphite/70">{s.exclusions}</p>
            <Link href={solutionHref(s)} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold underline underline-offset-4">Состав и ограничения</Link>
          </article>)}
        </div>
        <p className="mt-8 max-w-[80ch] text-sm leading-relaxed text-graphite/75">Цена «от» — минимальный ориентир для ограниченного объёма. Точный состав работ, доступность подключений, стоимость дополнительных модулей, срок и порядок оплаты согласовываются до заключения договора. Нет автоматического списания за консультацию или заявку.</p>
        <Link href="/contact" className="mt-6 inline-flex min-h-[48px] items-center bg-signal px-6 text-sm font-semibold text-white">Обсудить задачу бесплатно</Link>
      </div>
    </section>
  </MerchantInfoPage>;
}
