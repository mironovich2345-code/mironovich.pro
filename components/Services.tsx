import Reveal from "./Reveal";

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

export default function Services() {
  return (
    <section id="system" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] py-10 min-[560px]:py-14">
      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">02 — Система обучения</p>
      <h2 className="m-0 mb-8 max-w-[20ch] text-balance text-[clamp(27px,6.6vw,46px)] font-medium leading-[1.1] tracking-[-0.03em]">
        От первого рабочего дня — до самостоятельного сотрудника
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
