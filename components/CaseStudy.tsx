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

// Design parameters of the system as built — deliberately not outcomes: no measured results exist to report.
const parameters = [
  { value: "3 ДНЯ", label: "Базовая адаптация сотрудника" },
  { value: "≈15 МИН", label: "Обучения за смену — встроено в рабочий процесс" },
];

export default function CaseStudy() {
  return (
    <section id="case" className="bg-maroon px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-12 flex items-end justify-between gap-6 min-[560px]:mb-16">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-cream">04 <span className="text-signal">/</span> Кейс</p>
          <p className="m-0 hidden text-[11px] uppercase tracking-[0.22em] text-stone min-[560px]:block">
            Проект для сети фитнес-клубов
          </p>
        </div>

        <div className="grid gap-12 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] min-[900px]:gap-20">
          <div className="flex flex-col gap-8">
            <h2 className="m-0 max-w-[18ch] text-balance font-display text-[clamp(27px,5vw,44px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-cream">
              Как разрозненные процессы обучения превращаются в единую систему
            </h2>

            <div className="flex flex-col gap-6 border-t border-cream/15 pt-6">
              {steps.map((s) => (
                <div key={s.label}>
                  <p className="m-0 mb-2 text-[11px] uppercase tracking-[0.18em] text-stone">{s.label}</p>
                  <p className="m-0 text-pretty text-[15px] leading-[1.6] text-cream/80">{s.body}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-cream/15 pt-6">
              <p className="m-0 text-[11px] uppercase tracking-[0.18em] text-stone">Внутри системы</p>
              <p className="m-0 max-w-[44ch] text-pretty text-[14px] leading-[1.9] text-cream/65">{inside.join(" — ")}</p>
            </div>
          </div>

          <div className="flex flex-col">
            <p className="m-0 mb-6 text-[11px] uppercase tracking-[0.22em] text-stone">Параметры спроектированной системы</p>

            <div className="grid grid-cols-1 border-t border-cream/15 min-[560px]:grid-cols-2">
              {parameters.map((p, i) => (
                <div
                  key={p.value}
                  className={
                    "flex flex-col gap-2 border-b border-cream/15 py-7 min-[560px]:border-b-0 min-[560px]:py-9 " +
                    (i === 0 ? "min-[560px]:border-r min-[560px]:border-cream/15 min-[560px]:pr-8" : "min-[560px]:pl-8")
                  }
                >
                  <p className="m-0 font-display text-[clamp(34px,5.5vw,58px)] font-extrabold leading-none tracking-[-0.02em] text-signal">
                    {p.value}
                  </p>
                  <p className="m-0 max-w-[26ch] text-pretty text-[13px] leading-[1.5] text-cream/70">{p.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-cream/15 pt-8 text-[13px] uppercase tracking-[0.16em] text-cream">
              <span>Модуль</span>
              <span aria-hidden className="text-signal">→</span>
              <span>Тест</span>
              <span aria-hidden className="text-signal">→</span>
              <span>Аттестация</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
