import CtaLink from "./CtaLink";
import { productBySlug } from "@/content/products";
import { rub } from "@/config/solutions";

const cardClass =
  "flex min-w-0 flex-col border border-cream/20 bg-[#15151a] p-5 transition-colors hover:border-cream min-[560px]:p-6";

export default function Hero() {
  const career = productBySlug("ai-career")!;

  return (
    <section
      id="hero"
      className="bg-graphite px-[22px] pb-10 pt-8 min-[560px]:pb-12 min-[560px]:pt-12"
    >
      <div className="mx-auto grid max-w-[1080px] gap-8 min-[960px]:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] min-[960px]:items-center min-[960px]:gap-12">
        <div>
          <p className="m-0 mb-5 text-[11px] uppercase tracking-[0.18em] text-stone">
            MIRONOVICH.PRO <span className="text-signal">/</span> Технологии и ИИ
          </p>
          <h1 className="m-0 max-w-[16ch] text-balance font-display text-[clamp(36px,5vw,62px)] font-extrabold uppercase leading-[1.02] tracking-[-0.02em] text-cream">
            Технологии для бизнеса.{" "}
            <span className="text-signal">ИИ для сотрудников.</span>
          </h1>
          <p className="mb-0 mt-5 max-w-[46ch] text-pretty text-[16px] leading-[1.6] text-cream/80">
            Компаниям помогаю выбирать и внедрять цифровые решения. Специалистам — применять ИИ в работе и развивать навыки.
          </p>
        </div>

        <div className="grid gap-3 min-[600px]:grid-cols-2 min-[960px]:grid-cols-1" aria-label="Выберите, для кого вы ищете решение">
          <article className={cardClass + " border-l-2 border-l-signal"}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.1em] text-stone">
              <span>Для компаний</span>
              <span className="text-cream">Первое обсуждение бесплатно</span>
            </div>
            <h2 className="m-0 font-display text-[clamp(23px,2.2vw,29px)] font-extrabold uppercase leading-[1.08] text-cream">
              Нужно улучшить процесс?
            </h2>
            <p className="mb-5 mt-3 text-[14px] leading-relaxed text-stone">
              Разберём задачу, оценим варианты и определим первый шаг. Готовое ТЗ не нужно.
            </p>
            <CtaLink
              href="#contact"
              location="hero"
              className="mt-auto inline-flex min-h-[48px] items-center justify-center gap-3 bg-signal px-4 text-center text-[13px] font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323]"
            >
              Запросить консультацию <span aria-hidden>→</span>
            </CtaLink>
            <CtaLink
              href="/tools/labor-cost"
              location="hero_calculator"
              tool="labor"
              className="mt-3 inline-flex min-h-[40px] items-center gap-2 text-[13px] text-cream underline decoration-cream/30 underline-offset-4 transition-colors hover:text-signal"
            >
              Рассчитать стоимость ручного труда <span aria-hidden>→</span>
            </CtaLink>
          </article>

          <article className={cardClass + " border-l-2 border-l-cream/50"}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.1em] text-stone">
              <span>Для сотрудников</span>
              <span className="text-cream">Готовится к запуску</span>
            </div>
            <h2 className="m-0 font-display text-[clamp(23px,2.2vw,29px)] font-extrabold uppercase leading-[1.08] text-cream">
              {career.title}
            </h2>
            <p className="mb-4 mt-3 text-[14px] leading-relaxed text-stone">
              Разберитесь, где ИИ поможет в работе, какие навыки развивать и что делать в ближайшие 30 дней.
            </p>
            <p className="mb-4 mt-auto text-[15px] text-cream">
              {rub(career.plannedPrice)}{" "}
              <span className="text-[12px] text-stone">цена после запуска</span>
            </p>
            <CtaLink
              href="/products/ai-career"
              location="hero_product"
              product="ai-career"
              className="inline-flex min-h-[48px] items-center justify-center gap-3 border border-cream/35 px-4 text-center text-[13px] font-medium uppercase tracking-[0.04em] text-cream transition-colors hover:border-signal hover:text-signal"
            >
              Посмотреть программу <span aria-hidden>→</span>
            </CtaLink>
          </article>
        </div>
      </div>
    </section>
  );
}
