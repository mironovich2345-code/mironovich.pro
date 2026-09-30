import CtaLink from "./CtaLink";

export default function Hero() {
  return (
    <section id="hero" className="relative overflow-hidden bg-graphite px-[22px] pb-16 pt-8 min-[560px]:pb-24 min-[560px]:pt-12">
      {/* Oversized ghost wordmark — pure typographic texture, not a badge or icon. */}
      <p
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 select-none whitespace-nowrap font-display text-[clamp(140px,28vw,360px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream/5"
      >
        Mironovich
      </p>

      <div className="relative mx-auto flex max-w-[1080px] flex-col gap-10 min-[560px]:gap-14">
        <div className="flex items-start justify-between gap-6 text-[11px] uppercase tracking-[0.22em] text-stone">
          <p className="m-0">
            Mironovich <span className="text-signal">/</span> Employee Training Systems
          </p>
          <p className="m-0 hidden min-[560px]:block">Mironovich / 2026</p>
        </div>

        <h1 className="m-0 max-w-[13ch] font-display text-[clamp(42px,9.5vw,128px)] font-extrabold uppercase leading-[0.92] tracking-[-0.02em] text-cream">
          Обучение
          <br />
          не должно
          <br />
          держаться
          <br />
          на одном
          <br />
          человеке<span className="text-signal">.</span>
        </h1>

        <div className="grid gap-8 border-t border-cream/15 pt-8 min-[760px]:grid-cols-[1fr_auto] min-[760px]:items-end">
          <p className="m-0 max-w-[46ch] text-pretty text-[15.5px] leading-[1.6] text-stone min-[560px]:text-[17px]">
            Системы обучения сотрудников: база знаний, тестирование, аттестация, контроль прогресса, автоматизация и AI.
          </p>
          <div className="flex flex-col items-start gap-3 min-[760px]:items-end">
            <CtaLink
              href="#contact"
              location="hero"
              className="inline-flex min-h-[56px] items-center justify-center bg-signal px-9 text-[15px] font-medium uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#b82323]"
            >
              Разобрать систему обучения
            </CtaLink>
            <a
              href="#system"
              className="text-[13px] text-stone underline decoration-stone/40 underline-offset-4 transition-colors hover:text-cream"
            >
              Из чего состоит система ↓
            </a>
          </div>
        </div>

        {/* Mobile: trimmed to 3 directions so the tag row doesn't wrap into a paragraph. */}
        <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 border-t border-cream/10 p-0 pt-6 text-[11px] uppercase tracking-[0.16em] text-stone/80 min-[640px]:hidden">
          <li>Адаптация</li>
          <li>База знаний</li>
          <li>Контроль</li>
        </ul>
        <ul className="m-0 hidden list-none flex-wrap gap-x-8 gap-y-2 border-t border-cream/10 p-0 pt-6 text-[11px] uppercase tracking-[0.16em] text-stone/80 min-[640px]:flex">
          <li>Адаптация</li>
          <li>Корпоративная академия</li>
          <li>База знаний</li>
          <li>Аттестации</li>
          <li>Контроль прогресса</li>
        </ul>
      </div>
    </section>
  );
}
