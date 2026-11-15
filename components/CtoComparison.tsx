import CtaLink from "./CtaLink";
import SectionLabel from "./SectionLabel";
import { ctoOffer } from "@/config/commercial";
import { comparisonCriteria, ctoComparison } from "@/config/cto-comparison";
import { rub } from "@/config/solutions";

export default function CtoComparison() {
  return (
    <section id="cto" className="bg-graphite px-[22px] py-12 min-[560px]:py-16">
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel
          index="03"
          label="Внешний CTO"
          note="Как выбрать формат работы"
        />
        <div className="grid gap-5 min-[860px]:grid-cols-[1.3fr_1fr] min-[860px]:gap-12">
          <div>
            <h2 className="m-0 max-w-[22ch] font-display text-[clamp(30px,5vw,48px)] font-extrabold uppercase leading-[1.05] text-cream">
              Кому доверить техническую часть?
            </h2>
            <p className="mb-0 mt-5 max-w-[58ch] text-[15px] leading-relaxed text-stone">
              Ниже — типичные роли по договору. Программист или агентство также
              могут брать на себя управление: это зависит от команды и
              договорённостей.
            </p>
          </div>
          <div className="border-l-2 border-signal pl-5">
            <p className="m-0 font-display text-[clamp(28px,3vw,36px)] font-bold text-cream">
              {rub(ctoOffer.monthlyPrice)}/мес.
            </p>
            <p className="mb-2 mt-2 text-[17px] text-cream">
              До {ctoOffer.hours} часов
            </p>
            <p className="m-0 max-w-[44ch] text-[14px] leading-relaxed text-stone">
              Технологическая стратегия, приоритеты и бюджет, контроль
              подрядчиков, техническая приёмка и регулярная отчётность.
            </p>
          </div>
        </div>
        <table className="mt-8 hidden w-full table-fixed border-collapse text-left text-[14px] leading-relaxed min-[760px]:table">
          <caption className="sr-only">
            Сравнение типичных договорных ролей
          </caption>
          <thead>
            <tr className="border-b border-cream/25">
              <th
                scope="col"
                className="w-[20%] py-4 pr-5 font-normal text-stone"
              >
                Формат работы
              </th>
              {ctoComparison.map((r) => (
                <th
                  key={r.id}
                  scope="col"
                  className={
                    "px-4 py-4 font-display text-[24px] font-bold leading-tight " +
                    (r.id === "cto"
                      ? "bg-cream/[0.05] text-cream"
                      : "text-cream")
                  }
                >
                  {r.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonCriteria.map((criterion, i) => (
              <tr key={criterion} className="border-b border-cream/15">
                <th scope="row" className="py-4 pr-5 font-normal text-stone">
                  {criterion}
                </th>
                {ctoComparison.map((r) => (
                  <td
                    key={r.id}
                    className={
                      "px-4 py-4 align-top text-cream/90 " +
                      (r.id === "cto" ? "bg-cream/[0.05]" : "")
                    }
                  >
                    {r.values[i]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-7 divide-y divide-cream/20 border-y border-cream/20 min-[760px]:hidden">
          {ctoComparison.map((r) => (
            <details key={r.id} open={r.id === "cto"} className="group py-1">
              <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-4 font-display text-[24px] font-bold text-cream [&::-webkit-details-marker]:hidden">
                {r.title}
                <span aria-hidden className="text-signal group-open:rotate-45">
                  +
                </span>
              </summary>
              <dl className="mb-5 mt-0 space-y-4 text-[14px] leading-relaxed">
                {comparisonCriteria.map((criterion, i) => (
                  <div key={criterion}>
                    <dt className="text-stone">{criterion}</dt>
                    <dd className="m-0 mt-1 text-cream">{r.values[i]}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
        <div className="mt-6 grid items-start gap-5 min-[760px]:grid-cols-[1.3fr_1fr] min-[760px]:gap-12">
          <p className="m-0 max-w-[68ch] text-[13px] leading-relaxed text-stone">
            Задачи и распределение времени фиксируем заранее. Разработка
            системы, лицензии и работа подрядчиков оплачиваются отдельно. Без
            дежурства 24/7 и неограниченной разработки.
          </p>
          <CtaLink
            href="/services/cto"
            location="cto_comparison"
            service="cto"
            className="inline-flex min-h-[48px] items-center justify-between gap-4 border border-cream/35 px-5 text-[14px] text-cream hover:border-cream"
          >
            Состав работы CTO <span aria-hidden>→</span>
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
