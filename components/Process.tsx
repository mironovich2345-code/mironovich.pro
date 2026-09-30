const steps = [
  { title: "Разбор", body: "Изучаем, как сейчас проходит адаптация и обучение сотрудников." },
  { title: "Архитектура", body: "Определяем роли, знания, этапы обучения, контрольные точки и требования руководителей." },
  { title: "Контент", body: "Собираем существующие материалы и определяем, что нужно переработать, создать или структурировать." },
  { title: "Система", body: "Проектируем и запускаем рабочий инструмент: обучение, база знаний, тесты, аттестации и управление." },
  { title: "Развитие", body: "Собираем результаты, обновляем материалы и подключаем автоматизацию и AI там, где они дают реальную пользу." },
];

// Mobile: Process + FirstReview compressed into one "how we start" block —
// the two sections otherwise partly repeat each other at this length.
const mobileSteps = [
  { title: "Разбор", body: "Смотрим, как обучение работает сейчас." },
  { title: "Архитектура", body: "Определяем роли, знания, маршрут и контрольные точки." },
  { title: "Запуск", body: "Собираем первый рабочий этап системы." },
];

export default function Process() {
  return (
    <section id="process" className="bg-graphite px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-10 flex items-end justify-between gap-6 min-[560px]:mb-14">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-signal">06 / Как я работаю</p>
          <p className="m-0 hidden text-[11px] uppercase tracking-[0.22em] text-stone min-[560px]:block">Process</p>
        </div>

        {/* Mobile: merged compact version — replaces Process + FirstReview together. */}
        <div className="min-[640px]:hidden">
          <h2 className="m-0 mb-10 font-display text-[clamp(28px,6.6vw,40px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-cream">
            Как начинаем
          </h2>

          <ol className="m-0 flex list-none flex-col border-t border-cream/15 p-0">
            {mobileSteps.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[64px_1fr] items-start gap-6 border-b border-cream/15 py-7">
                <span className="font-display text-[clamp(28px,4.6vw,44px)] font-extrabold leading-none tracking-[-0.02em] text-cream/20">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="m-0 mb-1.5 text-[15px] uppercase tracking-[0.08em] text-cream">{s.title}</p>
                  <p className="m-0 max-w-[46ch] text-pretty text-[14.5px] leading-[1.6] text-stone">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="m-0 mt-10 max-w-[46ch] border-l-2 border-signal pl-5 text-pretty text-[clamp(17px,4vw,20px)] leading-[1.45] tracking-[-0.01em] text-cream">
            Готовое техническое задание не требуется.
          </p>
        </div>

        {/* Desktop: full 5-step Process — FirstReview follows as its own section. */}
        <div className="hidden min-[640px]:block">
          <h2 className="m-0 mb-12 max-w-[18ch] text-balance font-display text-[clamp(28px,5.6vw,48px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-cream min-[560px]:mb-16">
            Сначала процесс. Потом инструмент.
          </h2>

          <ol className="m-0 flex list-none flex-col border-t border-cream/15 p-0">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="grid grid-cols-[64px_1fr] items-start gap-6 border-b border-cream/15 py-7 min-[760px]:grid-cols-[140px_1fr] min-[760px]:gap-10"
              >
                <span className="font-display text-[clamp(28px,4.6vw,44px)] font-extrabold leading-none tracking-[-0.02em] text-cream/20">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="m-0 mb-1.5 text-[15px] uppercase tracking-[0.08em] text-cream">{s.title}</p>
                  <p className="m-0 max-w-[46ch] text-pretty text-[14.5px] leading-[1.6] text-stone">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="m-0 mt-12 max-w-[46ch] text-balance text-[clamp(19px,3.4vw,24px)] leading-[1.4] tracking-[-0.01em] text-cream min-[560px]:mt-16">
            Не начинаю с выбора LMS или разработки приложения. Сначала нужно понять, как должна работать{" "}
            <span className="text-signal">сама система обучения</span>.
          </p>
        </div>
      </div>
    </section>
  );
}
