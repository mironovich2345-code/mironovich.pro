import Reveal from "./Reveal";

const items = [
  { title: "Проблема", body: "Разберём текущий процесс и определим, где возникают лишние действия, ошибки или потеря управляемости." },
  { title: "Решение", body: "Поймём, нужна ли разработка, автоматизация, AI — или задачу можно решить проще." },
  { title: "Первый этап", body: "Определим минимальный объём, который имеет смысл запускать первым." },
  { title: "Следующий шаг", body: "Будет понятно, что делать дальше, из каких этапов состоит решение и какой объём работ потребуется." },
];

export default function FirstReview() {
  return (
    <section id="first-review" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] py-10 min-[560px]:py-14">
      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">06 — Первый разбор</p>

      <div className="mb-[46px] grid items-end gap-x-14 gap-y-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <h2 className="m-0 max-w-[22ch] text-balance text-[clamp(27px,6.6vw,46px)] font-medium leading-[1.1] tracking-[-0.03em]">
          Сначала поймём, что вообще стоит делать
        </h2>
        <p className="m-0 mb-1.5 max-w-[46ch] text-pretty text-[15px] leading-[1.6] text-neutral-500">
          Не нужно заранее знать, какой сервис, приложение или AI-инструмент вам нужен. Достаточно описать проблему.
        </p>
      </div>

      <ol className="m-0 grid list-none gap-x-14 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr))]">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={(i % 2) * 0.06}>
            <li
              className="flex list-none items-start gap-[22px] pb-7 pt-[26px]"
              style={{
                backgroundImage: `linear-gradient(90deg, ${i === 0 ? "#5d5294" : "#3f424d"}, ${i === items.length - 1 ? "transparent" : "#292b31"})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% 1px",
                backgroundPosition: "0 0",
              }}
            >
              <span className="min-w-[2ch] flex-none text-[clamp(30px,6vw,40px)] leading-none tracking-[-0.04em] text-neutral-600">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="m-0 mb-2.5 text-[13px] uppercase tracking-[0.14em] text-ink">{it.title}</p>
                <p className="m-0 max-w-[40ch] text-pretty text-[15px] leading-[1.6] text-neutral-500">{it.body}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>

      <p className="m-0 mt-10 max-w-[52ch] border-l-2 border-accent pl-5 text-pretty text-[clamp(17px,3.4vw,21px)] leading-[1.5] tracking-[-0.02em] text-ink">
        Готовое ТЗ не требуется. Можно просто рассказать, как процесс работает сейчас и что в нём хочется изменить.
      </p>
    </section>
  );
}
