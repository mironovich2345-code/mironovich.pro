import Reveal from "./Reveal";

const services = [
  {
    title: "Внутренние приложения",
    body: "Личные кабинеты сотрудников, руководителей и управляющих, внутренние сервисы, базы знаний, задачи и аналитика.",
  },
  {
    title: "Обучение сотрудников",
    body: "Онбординг, корпоративная академия, тестирование, аттестации, контроль прогресса и карьерные треки.",
  },
  {
    title: "Автоматизация",
    body: "Интеграции API, автоматизация рутинных процессов, сбор данных, уведомления, отчеты и контроль.",
  },
  {
    title: "AI для бизнеса",
    body: "Анализ звонков, работа с данными, поиск ошибок сотрудников, AI-ассистенты и интеллектуальная аналитика.",
  },
];

export default function Services() {
  return (
    <section id="services" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] py-10 min-[560px]:py-14">
      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">02 — Что можно сделать</p>
      <h2 className="m-0 mb-8 max-w-[18ch] text-balance text-[clamp(27px,6.6vw,46px)] font-medium leading-[1.1] tracking-[-0.03em]">
        От проблемы — к работающему инструменту
      </h2>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        {services.map((s, i) => (
          <Reveal key={s.title} delay={(i % 2) * 0.06}>
            <article className="h-full rounded-md bg-panel px-[22px] pb-7 pt-[26px] shadow-[0_0_0_1px_#292b31] transition-shadow hover:shadow-[0_0_0_1px_#5d5294]">
              <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-neutral-600">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="m-0 mb-2.5 text-[21px] font-medium tracking-[-0.02em]">{s.title}</h3>
              <p className="m-0 text-pretty text-[15px] leading-[1.6] text-neutral-500">{s.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
