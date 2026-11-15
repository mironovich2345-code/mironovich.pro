import CtaLink from "./CtaLink";
import { productBySlug } from "@/content/products";
import { rub } from "@/config/solutions";

const cardClass =
  "group flex min-w-0 flex-col border border-cream/25 p-5 transition-colors hover:border-cream min-[560px]:p-6";
export default function Hero() {
  const career = productBySlug("ai-career")!;
  return (
    <section
      id="hero"
      className="bg-graphite px-[22px] pb-10 pt-7 min-[560px]:pb-12 min-[560px]:pt-12"
    >
      <div className="mx-auto grid max-w-[1080px] gap-8 min-[960px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] min-[960px]:items-start min-[960px]:gap-12">
        <div>
          <p className="m-0 mb-5 text-[11px] uppercase tracking-[0.18em] text-stone">
            Данил Миронович <span className="text-signal">/</span> Разработка и
            внедрение
          </p>
          <h1 className="m-0 font-display text-[clamp(34px,5vw,60px)] font-extrabold uppercase leading-[1.02] tracking-[-0.02em] text-cream">
            Разрабатываю системы для управления сотрудниками, продажами и{" "}
            <span className="text-signal">филиалами</span>
          </h1>
          <p className="mb-6 mt-6 max-w-[48ch] text-[16px] leading-[1.6] text-cream/80">
            Помогаю обучать команду, видеть результаты и наводить порядок в
            работе. От первого обсуждения до запуска системы.
          </p>
          <CtaLink
            href="#contact"
            location="hero"
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-6 bg-signal px-6 text-[14px] font-medium text-white hover:bg-[#b82323] min-[480px]:w-auto"
          >
            Обсудить проект <span aria-hidden>→</span>
          </CtaLink>
          <p className="mb-0 mt-3 text-[12px] leading-relaxed text-stone">
            Первое обсуждение бесплатно. Готовое ТЗ не требуется.
          </p>
        </div>
        <div
          className="grid gap-3 min-[600px]:grid-cols-2 min-[960px]:grid-cols-1"
          aria-label="Для бизнеса и сотрудников"
        >
          <CtaLink
            href="/tools/labor-cost"
            location="hero_calculator"
            tool="labor"
            className={cardClass}
          >
            <span className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.1em] text-stone">
              <span>Для бизнеса</span>
              <span className="text-cream">Бесплатно</span>
            </span>
            <h2 className="m-0 font-display text-[clamp(24px,2.4vw,30px)] font-extrabold uppercase leading-[1.1] text-cream">
              Сколько стоит ручной труд?
            </h2>
            <p className="mb-4 mt-3 text-[14px] leading-relaxed text-stone">
              Посчитайте, сколько времени и денег уходит на повторяющиеся
              операции
            </p>
            <span className="mt-auto inline-flex min-h-[32px] items-center gap-4 text-[14px] text-cream underline decoration-signal underline-offset-4">
              Рассчитать <span aria-hidden>→</span>
            </span>
          </CtaLink>
          <CtaLink
            href="/products/ai-career"
            location="hero_product"
            product="ai-career"
            className={cardClass + " border-l-2 border-l-signal"}
          >
            <span className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.1em] text-stone">
              <span>Для сотрудников</span>
              <span className="text-cream">Готовится</span>
            </span>
            <h2 className="m-0 font-display text-[clamp(24px,2.4vw,30px)] font-extrabold uppercase leading-[1.1] text-cream">
              {career.title}
            </h2>
            <p className="mb-3 mt-3 text-[14px] leading-relaxed text-stone">
              Разберите свои задачи, научитесь применять ИИ и получите план
              развития на 30 дней
            </p>
            <p className="mb-3 mt-0 text-[12px] text-stone">
              {rub(career.plannedPrice)} · планируемая цена
            </p>
            <span className="mt-auto inline-flex min-h-[32px] items-center gap-4 text-[14px] text-cream underline decoration-signal underline-offset-4">
              О программе <span aria-hidden>→</span>
            </span>
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
