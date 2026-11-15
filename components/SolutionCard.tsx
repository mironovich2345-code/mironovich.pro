import CtaLink from "./CtaLink";
import {
  entryPrice,
  rub,
  solutionHref,
  type Solution,
} from "@/config/solutions";

export default function SolutionCard({
  solution: s,
  index,
}: {
  solution: Solution;
  index: number;
}) {
  return (
    <article
      data-solution={s.slug}
      className="flex min-w-0 flex-col border-t border-cream/20 py-8 min-[860px]:py-10"
    >
      <p className="m-0 mb-4 text-[11px] uppercase tracking-[0.16em] text-stone">
        {String(index + 1).padStart(2, "0")} / {s.short}
      </p>
      <h3 className="m-0 font-display text-[clamp(27px,3vw,36px)] font-extrabold uppercase leading-[1.06] text-cream">
        {s.title}
      </h3>
      <div className="mt-4">
        <p className="m-0 font-display text-[27px] font-bold text-cream">
          {entryPrice(s)}
        </p>
        {s.full && (
          <p className="mb-0 mt-2 text-[14px] text-stone">
            Полный проект от {rub(s.full)}
          </p>
        )}
      </div>
      <p className="mb-4 mt-5 text-[15px] leading-relaxed text-cream/80">
        {s.problem}
      </p>
      <p className="m-0 text-[15px] leading-relaxed text-cream">
        <span className="text-stone">Что разрабатываю: </span>
        {s.build}
      </p>
      <p className="mb-6 mt-4 text-[14px] leading-relaxed text-stone">
        <span className="text-cream">Для кого: </span>
        {s.audience}
      </p>
      <div className="mt-auto border-t border-cream/15 pt-5">
        <p className="mb-1 mt-3 text-[13px] leading-relaxed text-stone">
          Предварительный ориентир. Состав и оценку фиксируем после разбора
          задачи.
        </p>
        <p className="mb-1 mt-2 text-[13px] text-stone">
          {s.slug === "management-analytics"
            ? "Кейс CLUB OPS: разрешённый интерфейс, live demo готовится."
            : "Публичное live demo готовится."}
        </p>
        <CtaLink
          href={solutionHref(s)}
          location="solution_card"
          solution={s.slug}
          className="inline-flex min-h-[48px] items-center gap-2 text-[14px] text-cream underline decoration-signal underline-offset-4 hover:text-signal"
        >
          Состав пилота и примеры →
        </CtaLink>
      </div>
    </article>
  );
}
