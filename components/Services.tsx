import SectionLabel from "./SectionLabel";
import SolutionCard from "./SolutionCard";
import { solutions } from "@/config/solutions";

export default function Services() {
  return (
    <section
      id="solutions"
      className="bg-graphite px-[22px] py-14 min-[560px]:py-20"
    >
      <span id="services" aria-hidden className="sr-only" />
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel
          index="01"
          label="Пять решений"
          note="От задачи до работающего инструмента"
        />
        <h2 className="m-0 mb-6 max-w-[22ch] font-display text-[clamp(32px,5.8vw,54px)] font-extrabold uppercase leading-[1.03] text-cream">
          Выберите задачу своей компании
        </h2>
        <p className="mb-10 max-w-[64ch] text-[16px] leading-relaxed text-cream/80">
          Сначала ограниченный пилот и критерии приёмки. Затем — развитие
          системы по результатам проверки. Ниже указана стоимость разработки,
          отдельно от цифровых продуктов.
        </p>
        <div className="grid gap-x-12 min-[860px]:grid-cols-2">
          {solutions.map((s, i) => (
            <SolutionCard key={s.slug} solution={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
