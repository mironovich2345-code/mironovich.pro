import Reveal from "./Reveal";

const steps = [
  { title: "Разбор", body: "Изучаем, как сейчас проходит адаптация и обучение сотрудников." },
  { title: "Архитектура", body: "Определяем роли, знания, этапы обучения, контрольные точки и требования руководителей." },
  { title: "Контент", body: "Собираем существующие материалы и определяем, что нужно переработать, создать или структурировать." },
  { title: "Система", body: "Проектируем и запускаем рабочий инструмент: обучение, база знаний, тесты, аттестации и управление." },
  { title: "Развитие", body: "Собираем результаты, обновляем материалы и подключаем автоматизацию и AI там, где они дают реальную пользу." },
];

export default function Process() {
  return (
    <section id="process" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] py-10 min-[560px]:py-14">
      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">06 — Как я работаю</p>
      <h2 className="m-0 mb-8 text-[clamp(27px,6.6vw,46px)] font-medium leading-[1.1] tracking-[-0.03em]">Сначала процесс. Потом инструмент.</h2>

      <ol className="m-0 grid list-none grid-cols-1 gap-x-4 gap-y-3.5 p-0 min-[560px]:gap-y-[18px] min-[560px]:[grid-template-columns:repeat(auto-fit,minmax(min(100%,172px),1fr))]">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={(i % 3) * 0.06}>
            <li
              className="relative list-none pt-[18px]"
              style={{
                backgroundImage: `linear-gradient(90deg, ${i === 0 ? "#5d5294" : "#3f424d"}, ${i === steps.length - 1 ? "transparent" : "#292b31"})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% 1px",
              }}
            >
              <span
                className={"absolute -top-0.5 left-0 h-[5px] w-[5px] rounded-full " + (i === 0 ? "bg-accent" : "bg-neutral-700")}
              />
              <p className="text-[11px] tracking-[0.14em] text-neutral-600">{String(i + 1).padStart(2, "0")}</p>
              <p className="my-2 text-[13px] uppercase tracking-[0.14em] text-ink">{s.title}</p>
              <p className="m-0 text-pretty text-sm leading-[1.5] text-neutral-500">{s.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>

      <p className="m-0 mt-7 max-w-[56ch] text-pretty text-[15px] leading-[1.6] text-neutral-500">
        Не начинаю с выбора LMS или разработки приложения. Сначала нужно понять, как должна работать сама система обучения.
      </p>
    </section>
  );
}
