import SectionLabel from "./SectionLabel";
import CtaLink from "./CtaLink";
import { directions } from "@/config/directions";

export default function Services() {
  return (
    <section
      id="solutions"
      className="bg-graphite px-[22px] py-12 min-[560px]:py-16"
    >
      <span id="services" aria-hidden className="sr-only" />
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel
          index="01"
          label="Пять решений"
          note="Выберите свою задачу"
        />
        <h2 className="m-0 mb-5 font-display text-[clamp(30px,5vw,48px)] font-extrabold uppercase leading-[1.05] text-cream">
          Что нужно вашему бизнесу?
        </h2>
        <p className="mb-8 max-w-[64ch] text-[16px] leading-relaxed text-cream/80">
          Выберите задачу, похожую на вашу. Цена — ориентир для первого этапа.
        </p>
        <ol className="m-0 list-none border-t border-cream/25 p-0">
          {directions.filter((d) => d.solution).map((d, i) => (
            <li
              key={d.id}
              data-direction={d.id}
              className="grid gap-3 border-b border-cream/20 py-6 min-[760px]:grid-cols-[2rem_minmax(0,1fr)_13rem] min-[760px]:gap-x-5 min-[1000px]:py-7"
            >
              <span aria-hidden className="font-display text-sm text-stone">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="m-0 font-display text-[clamp(24px,2.4vw,30px)] font-extrabold uppercase leading-[1.1] text-cream">
                  {d.title}
                </h3>
                <p className="mb-1 mt-3 max-w-[66ch] text-[14px] leading-relaxed text-stone">
                  {d.problem}
                </p>
                <p className="m-0 max-w-[66ch] text-[14px] leading-relaxed text-cream/90">
                  {d.result}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 min-[760px]:flex-col min-[760px]:items-start min-[760px]:justify-start">
                <p className="m-0 font-display text-[22px] font-bold leading-snug text-cream">
                  {d.price}
                </p>
                <CtaLink
                  href={d.href}
                  location="direction_list"
                  solution={d.solution}
                  service={d.service}
                  className="inline-flex min-h-[44px] items-center gap-3 text-[14px] text-cream underline decoration-signal underline-offset-4 hover:text-signal"
                >
                  Подробнее<span className="sr-only">: {d.title}</span>{" "}
                  <span aria-hidden>→</span>
                </CtaLink>
              </div>
            </li>
          ))}
        </ol>
        <p className="mb-0 mt-6 max-w-[64ch] text-[13px] leading-relaxed text-stone">
          Это примеры направлений и ориентиры бюджета проекта, а не товары интернет-магазина.
          Обсуждаем задачу, согласуем объём, стоимость и отдельный договор до старта.
          Онлайн-оплата на сайте предусмотрена только для цифрового продукта сотрудников.
        </p>
      </div>
    </section>
  );
}
