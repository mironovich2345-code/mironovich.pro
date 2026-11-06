import ToolCard from "./ToolCard";
import FitDisplay from "./FitDisplay";
import { tools } from "@/config/tools";

/** Existing editorial split: positioning left, two upcoming tools right.
 * FitDisplay preserves the oversized typography without clipping long words.
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
            Технологии <span className="text-signal">·</span> Управление <span className="text-signal">·</span> Развитие
          </p>

          <FitDisplay as="h1" className="m-0 whitespace-nowrap font-display [--display-size:13.8cqi] text-[length:calc(var(--display-size)*var(--display-fit,1))] font-extrabold uppercase leading-[0.96] tracking-[-0.02em] text-cream min-[960px]:[--display-size:min(13.8cqi,13vh)]">
            <span className="block">Ваш внешний</span>{" "}
            <span className="block text-signal">технологический</span>{" "}
            <span className="block">директор<span className="text-signal">.</span></span>
          </FitDisplay>

          <p className="m-0 max-w-[40ch] text-pretty text-[17px] leading-[1.5] text-cream/80 min-[560px]:text-[19px]">
            Помогаю бизнесу выбирать, внедрять и сопровождать технологии. Оцениваю идеи, стоимость разработки и подрядчиков. Беру реализацию и техническое управление под контроль.
          </p>
        </div>

        <div className="grid min-w-0 gap-4 min-[960px]:border-l min-[960px]:border-cream/15 min-[960px]:pl-8">
          {tools.map((tool) => <ToolCard key={tool.slug} tool={tool} />)}
        </div>
      </div>
    </section>
  );
}
