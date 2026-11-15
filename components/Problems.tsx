import Link from "next/link";
import SectionLabel from "./SectionLabel";

const items: { situation: string; cost: string; solution: string; href: string; label: string }[] = [
  { situation: "Новичок зависит от наставника", cost: "Материалы в чатах, прогресс и готовность к работе не видны.", solution: "Собрать обучение и аттестацию в одном приложении.", href: "/solutions/corporate-academy", label: "Корпоративная академия" },
  { situation: "Показатели собирают вручную", cost: "Руководитель сравнивает таблицы вместо работы с отклонениями.", solution: "Начать с источников, определений и одного отчёта.", href: "/solutions/management-analytics", label: "Управленческая аналитика" },
  { situation: "Филиалы работают по-разному", cost: "Требования есть, а ответственные и статус исправлений теряются.", solution: "Согласовать эталон, проверку и порядок исправлений.", href: "/solutions/branch-standards", label: "Контроль стандартов" },
];

export default function Problems() {
  return (
    <section id="problems" className="bg-cream px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel index="03" label="Когда подключаюсь" note="Ситуация → решение" tone="light" />

        <h2 className="m-0 mb-12 max-w-[20ch] text-balance font-display text-[clamp(30px,5.8vw,54px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-graphite min-[560px]:mb-16">
          Где ручное управление мешает росту
        </h2>

        <ol className="m-0 flex list-none flex-col border-t border-graphite/15 p-0">
          {items.map((it, i) => {
            return (
              <li
                key={it.situation}
                className="grid grid-cols-[44px_1fr] gap-x-4 gap-y-4 border-b border-graphite/15 py-7 min-[860px]:grid-cols-[72px_1.1fr_1fr_1fr] min-[860px]:gap-x-8 min-[860px]:py-9"
              >
                <span className="font-display text-[clamp(24px,3vw,36px)] font-extrabold leading-none tracking-[-0.02em] text-graphite/50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="m-0 text-balance text-[clamp(19px,2.4vw,23px)] font-medium leading-[1.25] tracking-[-0.01em] text-graphite">
                  {it.situation}
                </h3>
                <div className="col-start-2 min-[860px]:col-start-auto">
                  <p className="m-0 mb-1.5 text-[11px] uppercase tracking-[0.16em] text-graphite/65">Чем оборачивается</p>
                  <p className="m-0 text-pretty text-[15px] leading-[1.55] text-graphite/75">{it.cost}</p>
                </div>
                <div className="col-start-2 min-[860px]:col-start-auto">
                  <p className="m-0 mb-1.5 text-[11px] uppercase tracking-[0.16em] text-maroon">Что можно сделать</p>
                  <p className="m-0 mb-2 text-pretty text-[15px] font-medium leading-[1.55] text-graphite">{it.solution}</p>
                  <Link
                    href={it.href}
                    className="inline-flex min-h-[32px] items-center text-[13px] uppercase tracking-[0.08em] text-maroon underline decoration-maroon/30 underline-offset-4 transition-colors hover:text-signal"
                  >
                    {it.label} →
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="m-0 mt-12 max-w-[56ch] border-l-2 border-signal pl-5 text-pretty text-[clamp(18px,2.6vw,22px)] leading-[1.45] tracking-[-0.01em] text-graphite min-[560px]:mt-16">
          Не каждая задача требует разработки. Иногда достаточно правильно настроить то, что уже есть, — это
          выясняется на первом обсуждении.
        </p>
      </div>
    </section>
  );
}
