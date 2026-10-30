import SectionLabel from "./SectionLabel";

export type Scenario = { steps: string[]; change: string };

const homeScenarios: Scenario[] = [
  {
    steps: ["Данные из нескольких источников", "Единая панель руководителя"],
    change: "Цифры собираются сами: руководитель смотрит, а не сводит.",
  },
  {
    steps: ["Заявка", "Распределение", "Уведомление", "Контроль"],
    change: "Заявки не теряются, просрочки видны сразу.",
  },
  {
    steps: ["Разрозненные инструкции", "Система знаний и обучения"],
    change: "Новичок учится по маршруту, а не по памяти наставника.",
  },
  {
    steps: ["Таблицы и чаты", "Внутреннее приложение"],
    change: "Одно место для процесса вместо поиска по перепискам.",
  },
];

export default function Scenarios({
  items = homeScenarios,
  index = "03",
  title = "Как это может выглядеть",
  intro = "Это типовые схемы решений, а не описания клиентских проектов. Конкретная схема складывается после разбора вашего процесса.",
}: {
  items?: Scenario[];
  index?: string;
  title?: string;
  intro?: string;
}) {
  return (
    <section id="scenarios" className="bg-maroon px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel index={index} label="Сценарии" note="Типовые схемы решений" tone="maroon" />

        <div className="mb-12 grid gap-6 min-[860px]:mb-16 min-[860px]:grid-cols-[1fr_1fr] min-[860px]:items-end min-[860px]:gap-16">
          <h2 className="m-0 max-w-[16ch] text-balance font-display text-[clamp(30px,5.8vw,54px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-cream">
            {title}
          </h2>
          <p className="m-0 max-w-[46ch] text-pretty text-[15px] leading-[1.6] text-cream/75">{intro}</p>
        </div>

        <ol className="m-0 grid list-none grid-cols-1 border-t border-cream/15 p-0 min-[860px]:grid-cols-2">
          {items.map((s, i) => (
            <li
              key={s.change}
              className={
                "flex flex-col gap-5 border-b border-cream/15 py-8 min-[860px]:py-10 " +
                (i % 2 === 0 ? "min-[860px]:border-r min-[860px]:border-cream/15 min-[860px]:pr-10" : "min-[860px]:pl-10")
              }
            >
              <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-stone">Типовой сценарий</p>
              {/* inline text, not flex: a long step wraps naturally and the arrow stays next to it */}
              <p className="m-0 text-balance font-display text-[clamp(19px,2.4vw,24px)] font-extrabold uppercase leading-[1.3] tracking-[-0.01em] text-cream">
                {s.steps.map((step, j) => (
                  <span key={step}>
                    {step}
                    {/* the spaces are the line-break opportunities between steps */}
                    {j < s.steps.length - 1 && <> <span aria-hidden className="text-signal">→</span> </>}
                  </span>
                ))}
              </p>
              <p className="m-0 max-w-[44ch] text-pretty text-[15px] leading-[1.6] text-cream/80">
                <span className="text-cream/60">Что меняется: </span>
                {s.change}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
