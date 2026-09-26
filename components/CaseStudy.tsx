import DashboardMockup from "./DashboardMockup";
import Reveal from "./Reveal";

const steps = [
  {
    label: "Проблема",
    body: "Обучение, адаптация, база знаний, планы, результаты сотрудников и документы находились в разных процессах и сервисах. Руководителям приходилось вручную передавать знания и контролировать прохождение.",
  },
  {
    label: "Решение",
    body: "Спроектирована единая внутренняя система для сотрудников и руководителей.",
  },
];

// Design parameters of the system as built — deliberately not outcomes: no measured results exist to report.
const parameters = [
  { value: "3 дня", label: "базовая адаптация сотрудника" },
  { value: "около 15 минут", label: "за смену — обучение встроено в рабочий процесс" },
  { value: "Тестирование", label: "предусмотрено после модулей" },
  { value: "Итоговая аттестация", label: "в конце обучения" },
];

const inside = [
  "адаптация новичков",
  "обучение",
  "база знаний",
  "тестирование",
  "результаты сотрудников",
  "карьерное развитие",
  "планы на день",
  "управленческий контроль",
  "дальнейшие AI-инструменты",
];

export default function CaseStudy() {
  return (
    <section id="case" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] py-10 min-[560px]:py-14">
      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">04 — Пример проекта</p>
      <h2 className="m-0 mb-2.5 max-w-[24ch] text-balance text-[clamp(25px,5.8vw,40px)] font-medium leading-[1.12] tracking-[-0.03em]">
        Как разрозненные процессы обучения превращаются в единую систему
      </h2>
      <p className="m-0 mb-7 text-[13px] uppercase tracking-[0.1em] text-neutral-400">Проект для сети фитнес-клубов</p>

      <div className="grid items-start gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="flex flex-col gap-[22px]">
          {steps.map((s, i) => (
            <div key={s.label} className="flex flex-col gap-[22px]">
              <Reveal delay={i * 0.06}>
                <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-neutral-600">{s.label}</p>
                <p className="m-0 text-pretty text-[15px] leading-[1.6] text-neutral-300">{s.body}</p>
              </Reveal>
              <div aria-hidden className="h-px" style={{ background: "linear-gradient(90deg, #292b31, transparent)" }} />
            </div>
          ))}

          <Reveal delay={0.12}>
            <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-neutral-600">Внутри системы</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {inside.map((x) => (
                <li key={x} className="rounded bg-panel px-3 py-[7px] text-[13.5px] text-neutral-300 shadow-[0_0_0_1px_#292b31]">
                  {x}
                </li>
              ))}
            </ul>
          </Reveal>

          <p className="m-0 mt-1.5 text-balance text-[clamp(19px,4.6vw,27px)] leading-[1.26] tracking-[-0.025em]">
            Из набора разрозненных процессов <span className="text-accent-400">→</span> в единую систему обучения
            и развития сотрудников.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <Reveal delay={0.1}>
            <DashboardMockup />
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-neutral-600">Параметры спроектированной системы</p>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
              {parameters.map((p) => (
                <li key={p.value} className="rounded-md bg-panel px-4 pb-4 pt-3.5 shadow-[0_0_0_1px_#292b31]">
                  <p className="m-0 text-[clamp(17px,3.4vw,20px)] leading-[1.2] tracking-[-0.02em] text-ink">{p.value}</p>
                  <p className="m-0 mt-1.5 text-pretty text-[13px] leading-[1.45] text-neutral-500">{p.label}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
