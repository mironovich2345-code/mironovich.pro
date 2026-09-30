const services = [
  {
    title: "Адаптация новичка",
    body: "Понятный маршрут с первого рабочего дня до самостоятельной работы.",
  },
  {
    title: "Корпоративная академия",
    body: "Уроки, видео, инструкции и программы обучения по должностям.",
  },
  {
    title: "База знаний",
    body: "Актуальные регламенты, скрипты, инструкции и ответы на рабочие вопросы.",
  },
  {
    title: "Тестирование и аттестации",
    body: "Проверка знаний до допуска сотрудника к самостоятельной работе.",
  },
  {
    title: "Контроль прогресса",
    body: "Руководитель видит, что сотрудник прошёл, где ошибается и где требуется помощь.",
  },
  {
    title: "AI и автоматизация",
    body: "Создание и обновление контента, работа с корпоративными знаниями, аналитика и автоматизация повторяющихся процессов.",
  },
];

const [lead, ...rest] = services;
const left = rest.slice(0, 3);
const right = rest.slice(3);

// Mobile: a short labelled route, no descriptions — the full index is for desktop.
const mobileRoute = [
  "Адаптация",
  "Академия",
  "База знаний",
  "Проверка",
  "Контроль",
  "AI и автоматизация",
];

export default function Services() {
  return (
    <section id="system" className="relative overflow-hidden bg-graphite px-[22px] py-16 min-[560px]:py-24">
      <p
        aria-hidden
        className="pointer-events-none absolute -left-4 bottom-0 select-none whitespace-nowrap font-display text-[clamp(120px,24vw,300px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream/5"
      >
        System
      </p>

      <div className="relative mx-auto max-w-[1080px]">
        <div className="mb-12 flex items-end justify-between gap-6 min-[560px]:mb-16">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-signal">02 / Система обучения</p>
          <p className="m-0 hidden text-[11px] uppercase tracking-[0.22em] text-stone min-[560px]:block">
            От адаптации до аналитики
          </p>
        </div>

        <h2 className="m-0 mb-14 max-w-[22ch] text-balance font-display text-[clamp(30px,6.2vw,54px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-cream min-[560px]:mb-20">
          От первого рабочего дня — до самостоятельного сотрудника
        </h2>

        {/* Mobile: short numbered route, no descriptions — keeps the section scannable in a few seconds. */}
        <div className="border-t border-cream/15 min-[640px]:hidden">
          {mobileRoute.map((label, i) => (
            <div key={label} className="flex items-baseline gap-4 border-b border-cream/15 py-4">
              <span className="font-display text-[15px] font-extrabold text-signal">{String(i + 1).padStart(2, "0")} /</span>
              <span className="text-[16px] font-medium uppercase tracking-[0.01em] text-cream">{label}</span>
            </div>
          ))}
          <p className="m-0 mt-6 max-w-[40ch] text-pretty text-[15px] leading-[1.6] text-stone">
            Сотрудник проходит единый маршрут, руководитель видит результат.
          </p>
        </div>

        {/* Desktop: featured lead item + asymmetric two-column index, 3 + 2 */}
        <div className="hidden min-[640px]:block">
          <div className="grid grid-cols-[64px_1fr] items-start gap-6 border-t border-cream/15 py-8 min-[760px]:grid-cols-[140px_1fr] min-[760px]:gap-10 min-[760px]:py-10">
            <span className="font-display text-[clamp(30px,6vw,56px)] font-extrabold leading-none tracking-[-0.02em] text-signal min-[760px]:text-[clamp(38px,4vw,64px)]">
              01
            </span>
            <div>
              <h3 className="m-0 mb-2 max-w-[20ch] text-balance font-display text-[clamp(24px,4.6vw,38px)] font-extrabold uppercase leading-[1.08] tracking-[-0.015em] text-cream">
                {lead.title}
              </h3>
              <p className="m-0 max-w-[52ch] text-pretty text-[15.5px] leading-[1.6] text-stone">{lead.body}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 border-t border-cream/15 min-[860px]:grid-cols-2">
            <div className="flex flex-col min-[860px]:border-r min-[860px]:border-cream/15 min-[860px]:pr-10">
              {left.map((s, i) => (
                <div key={s.title} className="grid grid-cols-[64px_1fr] items-start gap-6 border-b border-cream/15 py-7">
                  <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.02em] text-cream/25">
                    {String(i + 2).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="m-0 mb-1.5 text-[15px] font-medium uppercase tracking-[0.01em] text-cream">{s.title}</p>
                    <p className="m-0 max-w-[38ch] text-pretty text-[13.5px] leading-[1.55] text-stone">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col min-[860px]:pl-10">
              {right.map((s, i) => (
                <div
                  key={s.title}
                  className="grid grid-cols-[64px_1fr] items-start gap-6 border-b border-cream/15 py-7 min-[860px]:last:border-b-0"
                >
                  <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.02em] text-cream/25">
                    {String(i + 5).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="m-0 mb-1.5 text-[15px] font-medium uppercase tracking-[0.01em] text-cream">{s.title}</p>
                    <p className="m-0 max-w-[38ch] text-pretty text-[13.5px] leading-[1.55] text-stone">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
