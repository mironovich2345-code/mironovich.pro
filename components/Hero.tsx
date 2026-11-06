import CtaLink from "./CtaLink";
import FitDisplay from "./FitDisplay";
import { contactHref } from "@/config/site";

/**
 * First screen: the four-line headline and subtitle on the left (≈62%), one large
 * accent button to the contact page on the right; on phones the button follows
 * the subtitle. The form itself lives on /contact (and in the lower section).
 *
 * Headline size. The longest line, «РЕЗУЛЬТАТА.», is 5.44em wide in the display
 * face (Roboto Condensed ExtraBold, -0.02em tracking), so 18cqi of the column
 * (≈ width / 5.55) always fits with a small margin. On wide screens it is also
 * capped by the viewport height so the first screen holds the whole composition.
 *
 * The button is a tall block anchored to the bottom of the text column, so the
 * right column reads as part of the composition rather than empty space.
 * The ghost wordmark is desktop-only texture at 4% opacity.
 */
export default function Hero() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-graphite px-[22px] pb-12 pt-7 min-[560px]:pb-16 min-[560px]:pt-12 min-[960px]:pb-16 min-[960px]:pt-12"
    >
      <p
        aria-hidden
        className="pointer-events-none absolute -right-6 top-2 hidden select-none whitespace-nowrap font-display text-[clamp(140px,22vw,320px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream/[0.04] min-[960px]:block"
      >
        Mironovich
      </p>

      <div className="relative mx-auto grid max-w-[1080px] gap-8 min-[960px]:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)] min-[960px]:items-end min-[960px]:gap-14">
        <div className="flex min-w-0 flex-col gap-5 [container-type:inline-size] min-[560px]:gap-8">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-stone">
            Автоматизация <span className="text-signal">·</span> Приложения <span className="text-signal">·</span> ИИ
          </p>

          <FitDisplay as="h1" className="m-0 whitespace-nowrap font-display [--display-size:18cqi] text-[length:calc(var(--display-size)*var(--display-fit,1))] font-extrabold uppercase leading-[0.92] tracking-[-0.02em] text-cream min-[960px]:[--display-size:min(18cqi,14.5vh)]">
            <span className="block">Меньше</span>{" "}
            <span className="block">рутины.</span>{" "}
            <span className="block">Больше</span>{" "}
            <span className="block">
              результата<span className="text-signal">.</span>
            </span>
          </FitDisplay>

          <p className="m-0 max-w-[40ch] text-pretty text-[17px] leading-[1.5] text-cream/80 min-[560px]:text-[19px]">
            Автоматизация процессов, разработка приложений и внедрение ИИ для бизнеса
          </p>
        </div>

        <div className="min-w-0 min-[960px]:border-l min-[960px]:border-cream/15 min-[960px]:pl-10">
          <p className="m-0 mb-4 hidden text-[11px] uppercase tracking-[0.22em] text-stone min-[960px]:block">
            Первичное обсуждение <span className="text-signal">—</span> бесплатно
          </p>
          <CtaLink
            href={contactHref}
            location="hero"
            className="group flex min-h-[64px] w-full items-center justify-between gap-4 bg-signal px-6 font-display text-[22px] font-extrabold uppercase leading-none tracking-[0.01em] text-white transition-colors hover:bg-[#b82323] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream min-[560px]:min-h-[72px] min-[560px]:text-[26px] min-[960px]:min-h-[clamp(180px,24vh,240px)] min-[960px]:flex-col min-[960px]:items-start min-[960px]:justify-between min-[960px]:p-8 min-[960px]:text-[clamp(30px,2.6vw,38px)]"
          >
            <span>Обсудить задачу</span>
            <span aria-hidden className="text-[1.1em] leading-none transition-transform group-hover:translate-x-1 min-[960px]:self-end">
              →
            </span>
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
