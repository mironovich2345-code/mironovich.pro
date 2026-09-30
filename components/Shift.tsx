const rows: [string, string][] = [
  [
    "Руководитель по несколько часов объясняет одно и то же каждому новичку.",
    "Новичок самостоятельно проходит единый маршрут, а руководитель подключается только там, где действительно нужен.",
  ],
  [
    "Знания находятся в чатах, документах и головах сотрудников.",
    "Есть единая актуальная база знаний.",
  ],
  [
    "«Мы его обучили» — но никто не знает, что сотрудник реально запомнил.",
    "Есть тестирование, аттестации и история результатов.",
  ],
  [
    "Новый филиал фактически создаёт обучение заново.",
    "Один стандарт можно масштабировать на новые точки и сотрудников.",
  ],
];

// Mobile keeps 3 of the 4 pairs, shortened to a single line each side.
const mobileRows: [string, string][] = [
  ["Руководитель каждый раз повторяет обучение.", "Сотрудник самостоятельно проходит единый маршрут."],
  ["Знания находятся в чатах, документах и головах сотрудников.", "Есть единая актуальная база знаний."],
  ["«Мы его обучили», но результат неизвестен.", "Есть тестирование, аттестация и история результатов."],
];

export default function Shift() {
  return (
    <section id="shift" className="bg-cream px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-10 flex items-end justify-between gap-6 min-[560px]:mb-14">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-maroon">03 / Что меняется</p>
          <p className="m-0 hidden text-[11px] uppercase tracking-[0.22em] text-graphite/45 min-[560px]:block">
            Сейчас → Система
          </p>
        </div>

        <h2 className="m-0 mb-12 max-w-[20ch] text-balance font-display text-[clamp(28px,5.6vw,48px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-graphite min-[560px]:mb-16">
          Обучение перестаёт быть задачей конкретного руководителя
        </h2>

        {/* Mobile: 3 pairs, shortened — full 4 pairs stay for desktop. */}
        <div className="flex flex-col border-t border-graphite/15 min-[640px]:hidden">
          {mobileRows.map(([now, sys], i) => (
            <div key={i} className="grid grid-cols-1 items-start gap-3 border-b border-graphite/15 py-7">
              <div>
                <p className="m-0 mb-2.5 text-[11px] uppercase tracking-[0.18em] text-graphite/45">Сейчас</p>
                <p className="m-0 max-w-[42ch] text-pretty text-[15px] leading-[1.6] text-graphite/60">{now}</p>
              </div>
              <div>
                <p className="m-0 mb-2.5 text-[11px] uppercase tracking-[0.18em] text-maroon">Система</p>
                <p className="m-0 max-w-[42ch] text-pretty text-[16px] font-medium leading-[1.6] text-graphite">{sys}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden flex-col border-t border-graphite/15 min-[640px]:flex">
          {rows.map(([now, sys], i) => (
            <div
              key={i}
              className="grid grid-cols-1 items-start gap-3 border-b border-graphite/15 py-8 min-[700px]:gap-8 min-[700px]:[grid-template-columns:1fr_44px_1fr]"
            >
              <div>
                <p className="m-0 mb-2.5 text-[11px] uppercase tracking-[0.18em] text-graphite/45">Сейчас</p>
                <p className="m-0 max-w-[42ch] text-pretty text-[15px] leading-[1.6] text-graphite/60">{now}</p>
              </div>
              <div aria-hidden className="hidden justify-center pt-[22px] text-lg text-signal min-[700px]:flex">→</div>
              <div>
                <p className="m-0 mb-2.5 text-[11px] uppercase tracking-[0.18em] text-maroon">Система</p>
                <p className="m-0 max-w-[42ch] text-pretty text-[16px] font-medium leading-[1.6] text-graphite">{sys}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
