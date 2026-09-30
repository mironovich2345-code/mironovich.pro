const items = [
  { title: "Текущий процесс", body: "Разберём, как новый сотрудник получает знания и кто сейчас отвечает за его обучение." },
  { title: "Проблемы", body: "Найдём места, где теряется время, знания, контроль или единый стандарт." },
  { title: "Возможное решение", body: "Определим, какие части действительно стоит переводить в систему." },
  { title: "Первый этап", body: "Станет понятно, с чего можно начать без создания сразу большой и дорогой платформы." },
];

export default function FirstReview() {
  return (
    <section id="first-review" className="bg-cream px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-10 flex items-end justify-between gap-6 min-[560px]:mb-14">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-maroon">07 / Первый разбор</p>
          <p className="m-0 hidden text-[11px] uppercase tracking-[0.22em] text-graphite/45 min-[560px]:block">
            Без готового ТЗ
          </p>
        </div>

        <div className="mb-12 grid items-end gap-x-14 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))] min-[560px]:mb-16">
          <h2 className="m-0 max-w-[20ch] text-balance font-display text-[clamp(28px,5.6vw,48px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-graphite">
            Сначала поймём, что мешает обучению работать
          </h2>
          <p className="m-0 max-w-[46ch] text-pretty text-[15px] leading-[1.6] text-graphite/60">
            Не нужно заранее знать, какая платформа или технология вам нужна. Достаточно рассказать, как сотрудники
            обучаются сейчас.
          </p>
        </div>

        <ol className="m-0 grid list-none grid-cols-1 gap-x-14 border-t border-graphite/15 p-0 min-[700px]:grid-cols-2">
          {items.map((it, i) => (
            <li
              key={it.title}
              className={
                "flex list-none items-start gap-5 border-b border-graphite/15 py-8 " +
                (i === 0 ? "min-[700px]:border-r min-[700px]:border-graphite/15 min-[700px]:pr-10" : "") +
                (i === 1 ? " min-[700px]:pl-10" : "") +
                (i === 2 ? " min-[700px]:border-r min-[700px]:border-graphite/15 min-[700px]:pr-10" : "") +
                (i === 3 ? " min-[700px]:pl-10" : "")
              }
            >
              <span className="min-w-[2ch] flex-none font-display text-[clamp(30px,5vw,40px)] font-extrabold leading-none tracking-[-0.02em] text-graphite/25">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="m-0 mb-2 text-[13px] uppercase tracking-[0.1em] text-graphite">{it.title}</p>
                <p className="m-0 max-w-[38ch] text-pretty text-[14.5px] leading-[1.6] text-graphite/60">{it.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="m-0 mt-12 max-w-[52ch] border-l-2 border-signal pl-5 text-pretty text-[clamp(18px,3.4vw,22px)] leading-[1.45] tracking-[-0.015em] text-graphite min-[560px]:mt-16">
          Готовое техническое задание не требуется.
        </p>
      </div>
    </section>
  );
}
