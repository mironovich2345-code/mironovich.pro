import SectionLabel from "./SectionLabel";

const steps = [
  { title: "Обсуждение задачи", body: "Бесплатно. Разбираемся, что происходит и где теряется время." },
  {
    title: "Описание процесса и требований",
    body: "Фиксирую роли, данные, сценарии и ограничения. Если нужна глубина — отдельно согласуем аудит процессов.",
  },
  { title: "Выбор решения", body: "Сравниваю варианты, включая готовые сервисы и изменения без разработки." },
  { title: "Прототип и разработка", body: "Начинаю с одного сценария, который приносит пользу первым." },
  { title: "Тестирование и запуск", body: "Проверяю решение на реальной работе вместе с вашей командой." },
  { title: "Поддержка и развитие", body: "По договорённости: объём и стоимость поддержки согласуются отдельно." },
];

export default function Process() {
  return (
    <section id="process" className="bg-cream px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel index="06" label="Как я работаю" note="Шесть шагов" tone="light" />

        <h2 className="m-0 mb-12 max-w-[20ch] text-balance font-display text-[clamp(30px,5.8vw,54px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-graphite min-[560px]:mb-16">
          От обсуждения задачи до работающего решения
        </h2>

        <ol className="m-0 grid list-none grid-cols-1 border-t border-graphite/15 p-0 min-[760px]:grid-cols-2 min-[1000px]:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-3 border-b border-graphite/15 py-8 min-[760px]:pr-8">
              <span className="font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-none tracking-[-0.02em] text-graphite/30">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="m-0 text-[15px] font-medium uppercase tracking-[0.06em] text-graphite">{s.title}</h3>
              <p className="m-0 max-w-[40ch] text-pretty text-[14.5px] leading-[1.6] text-graphite/75">{s.body}</p>
            </li>
          ))}
        </ol>

        <p className="m-0 mt-12 max-w-[52ch] border-l-2 border-signal pl-5 text-pretty text-[clamp(18px,2.6vw,22px)] leading-[1.45] tracking-[-0.01em] text-graphite min-[560px]:mt-16">
          Готовое ТЗ не требуется. Небольшой первый этап позволяет проверить пользу до больших вложений.
        </p>
      </div>
    </section>
  );
}
