import Reveal from "./Reveal";

const items = [
  { title: "Текущий процесс", body: "Разберём, как новый сотрудник получает знания и кто сейчас отвечает за его обучение." },
  { title: "Проблемы", body: "Найдём места, где теряется время, знания, контроль или единый стандарт." },
  { title: "Возможное решение", body: "Определим, какие части действительно стоит переводить в систему." },
  { title: "Первый этап", body: "Станет понятно, с чего можно начать без создания сразу большой и дорогой платформы." },
];

export default function FirstReview() {
  return (
    <section id="first-review" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] py-10 min-[560px]:py-14">
      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">07 — Первый разбор</p>

      <div className="mb-[46px] grid items-end gap-x-14 gap-y-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <h2 className="m-0 max-w-[22ch] text-balance text-[clamp(27px,6.6vw,46px)] font-medium leading-[1.1] tracking-[-0.03em]">
          Сначала поймём, что мешает обучению работать
        </h2>
        <p className="m-0 mb-1.5 max-w-[46ch] text-pretty text-[15px] leading-[1.6] text-neutral-500">
          Не нужно заранее знать, какая платформа или технология вам нужна. Достаточно рассказать, как сотрудники
          обучаются сейчас.
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
        Готовое техническое задание не требуется.
      </p>
    </section>
  );
}
