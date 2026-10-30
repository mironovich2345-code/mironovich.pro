import CtaLink from "./CtaLink";

/**
 * Deliberately short: kicker, H1, one-line subtitle, one CTA. Everything else
 * (directions, the free first conversation, background) is told by the blocks
 * below. Paddings are tight so the next section peeks in on 390×844 and 375×667.
 * The ghost wordmark is desktop-only texture.
 */
export default function Hero() {
  return (
    <section id="hero" className="relative overflow-hidden bg-graphite px-[22px] pb-12 pt-7 min-[560px]:pb-16 min-[560px]:pt-12">
      <p
        aria-hidden
        className="pointer-events-none absolute -right-6 top-2 hidden select-none whitespace-nowrap font-display text-[clamp(140px,22vw,320px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream/[0.04] min-[860px]:block"
      >
        Mironovich
      </p>

      <div className="relative mx-auto flex max-w-[1080px] flex-col gap-5 min-[560px]:gap-9">
        <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-stone">
          Автоматизация <span className="text-signal">·</span> Приложения <span className="text-signal">·</span> ИИ
        </p>

        <h1 className="m-0 font-display text-[clamp(40px,6.4vw,88px)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-cream">
          <span className="block">Меньше рутины.</span>{" "}
          <span className="block">
            Больше результата<span className="text-signal">.</span>
          </span>
        </h1>

        <div className="flex flex-col gap-6 min-[860px]:flex-row min-[860px]:items-end min-[860px]:justify-between min-[860px]:gap-12 min-[860px]:border-t min-[860px]:border-cream/15 min-[860px]:pt-8">
          <p className="m-0 max-w-[40ch] text-pretty text-[17px] leading-[1.5] text-cream/80 min-[560px]:text-[19px]">
            Автоматизация процессов, разработка приложений и внедрение ИИ для бизнеса
          </p>

          <CtaLink
            href="#contact"
            location="hero"
            className="inline-flex min-h-[56px] items-center justify-center whitespace-nowrap bg-signal px-5 text-center text-[14px] font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] min-[400px]:px-8 min-[400px]:text-[15px] min-[400px]:tracking-[0.06em]"
          >
            Обсудить задачу бесплатно
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
