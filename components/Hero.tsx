import LeadForm from "./LeadForm";

/**
 * First screen: the headline on the left (≈62%), the lead form on the right
 * (≈38%); on phones the headline, subtitle and form stack in that order.
 *
 * Headline size. The four lines are set in the display face at the largest size
 * at which the longest line, «РЕЗУЛЬТАТА.», still fits the column: that line is
 * 5.44em wide (measured in Roboto Condensed ExtraBold with -0.02em tracking), so
 * 18cqi of the column (≈ width / 5.55) always fits with a small margin. On wide
 * screens it is also capped by the viewport height so headline and form stay on
 * the first screen. No line can wrap, overflow or scroll sideways.
 *
 * The ghost wordmark is desktop-only texture behind everything at 4% opacity.
 * The header CTA points here (#hero-form); the lower «Обсудить задачу» section
 * keeps its own form.
 */
export default function Hero() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-graphite px-[22px] pb-12 pt-7 min-[560px]:pb-16 min-[560px]:pt-12 min-[960px]:pb-14 min-[960px]:pt-10"
    >
      <p
        aria-hidden
        className="pointer-events-none absolute -right-6 top-2 hidden select-none whitespace-nowrap font-display text-[clamp(140px,22vw,320px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream/[0.04] min-[960px]:block"
      >
        Mironovich
      </p>

      <div className="relative mx-auto grid max-w-[1080px] gap-10 min-[960px]:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] min-[960px]:items-center min-[960px]:gap-14">
        <div className="flex min-w-0 flex-col gap-5 [container-type:inline-size] min-[560px]:gap-8">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-stone">
            Автоматизация <span className="text-signal">·</span> Приложения <span className="text-signal">·</span> ИИ
          </p>

          <h1 className="m-0 whitespace-nowrap font-display text-[length:18cqi] font-extrabold uppercase leading-[0.92] tracking-[-0.02em] text-cream min-[960px]:text-[length:min(18cqi,14.5vh)]">
            <span className="block">Меньше</span>{" "}
            <span className="block">рутины.</span>{" "}
            <span className="block">Больше</span>{" "}
            <span className="block">
              результата<span className="text-signal">.</span>
            </span>
          </h1>

          <p className="m-0 max-w-[40ch] text-pretty text-[17px] leading-[1.5] text-cream/80 min-[560px]:text-[19px]">
            Автоматизация процессов, разработка приложений и внедрение ИИ для бизнеса
          </p>
        </div>

        <div id="hero-form" className="min-w-0 scroll-mt-24 border-t border-cream/15 pt-8 min-[960px]:border-l min-[960px]:border-t-0 min-[960px]:pl-10 min-[960px]:pt-0">
          <h2 className="m-0 mb-5 font-display text-[26px] font-extrabold uppercase leading-[1] tracking-[-0.01em] text-cream min-[960px]:text-[28px]">
            Обсудим вашу задачу?
          </h2>
          <LeadForm variant="compact" idPrefix="hero-lead" submitLabel="Отправить заявку" />
        </div>
      </div>
    </section>
  );
}
