const items = [
  "Новичка каждый раз обучает руководитель",
  "Каждый филиал обучает по-своему",
  "Знания разбросаны по Telegram, PDF и папкам",
  "Непонятно, чему сотрудник реально научился",
  "Уходит сильный человек — вместе с ним уходят знания",
];

export default function Pains() {
  return (
    <section id="problems" className="bg-cream px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-8 flex items-end justify-between gap-6 min-[560px]:mb-12">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-maroon">01 / Знакомо?</p>
          <p className="m-0 hidden text-[11px] uppercase tracking-[0.22em] text-graphite/45 min-[560px]:block">
            Employee Training
          </p>
        </div>

        <p className="m-0 mb-10 max-w-[46ch] text-pretty text-[clamp(17px,3vw,21px)] leading-[1.5] text-graphite/70 min-[560px]:mb-14">
          Возможно, именно так сейчас устроено обучение сотрудников.
        </p>

        <ol className="m-0 flex list-none flex-col border-t border-graphite/15 p-0">
          {items.map((text, i) => (
            <li
              key={text}
              className="grid grid-cols-[64px_1fr] items-start gap-6 border-b border-graphite/15 py-7 min-[760px]:grid-cols-[140px_1fr] min-[760px]:gap-10 min-[760px]:py-10"
            >
              <span className="font-display text-[clamp(30px,6vw,56px)] font-extrabold leading-none tracking-[-0.02em] text-graphite/20 min-[760px]:text-[clamp(38px,4vw,64px)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="m-0 max-w-[46ch] text-pretty text-[clamp(19px,3.4vw,27px)] font-medium leading-[1.25] tracking-[-0.01em] text-graphite">
                {text}
              </p>
            </li>
          ))}
        </ol>

        <h2 className="m-0 mt-14 max-w-[20ch] text-balance font-display text-[clamp(28px,6.6vw,60px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-graphite min-[560px]:mt-20">
          Это не система. <span className="text-signal">Это ручное управление знаниями.</span>
        </h2>
      </div>
    </section>
  );
}
