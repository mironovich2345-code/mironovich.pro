const route: [string, number][] = [
  ["Адаптация", 100],
  ["Обучение по должности", 72],
  ["Тест и аттестация", 38],
  ["Самостоятельная работа", 0],
];

export default function DashboardMockup() {
  const bars = [38, 56, 34, 70, 92, 62, 48];
  return (
    <div aria-hidden className="rounded-md bg-panel p-3.5 shadow-[0_0_0_1px_#292b31,0_16px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2.5 px-1 pb-3.5 pt-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="text-[11px] uppercase tracking-[0.16em] text-neutral-600">Маршрут сотрудника</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {route.map(([label, pct], i) => (
          <div key={label} className="flex items-center gap-3 rounded-md bg-surface px-3.5 py-3">
            <span className="w-[2ch] flex-none text-[10px] tracking-[0.14em] text-neutral-600">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className={"flex-1 text-[13px] " + (pct === 0 ? "text-neutral-500" : "text-neutral-300")}>{label}</span>
            <span className="h-1 w-[54px] flex-none overflow-hidden rounded bg-neutral-800">
              <span
                className={"block h-full " + (pct >= 72 ? "bg-accent" : "bg-neutral-700")}
                style={{ width: pct + "%" }}
              />
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 rounded-md bg-surface p-3.5">
        <p className="mb-3.5 text-[10px] uppercase tracking-[0.14em] text-neutral-600">Прохождение по клубам</p>
        <div className="flex h-[74px] items-end gap-1.5">
          {bars.map((h, i) => (
            <span
              key={i}
              className={"flex-1 rounded-t " + (h === 92 ? "bg-accent" : "bg-neutral-800")}
              style={{ height: h + "%" }}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,104px),1fr))]">
        <div className="rounded-md bg-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-600">База знаний</p>
          <div className="mt-3.5 flex gap-[3px]">
            <span className="h-1 flex-1 rounded bg-accent" />
            <span className="h-1 flex-1 rounded bg-accent" />
            <span className="h-1 flex-1 rounded bg-neutral-800" />
          </div>
        </div>
        <div className="rounded-md bg-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-600">Контроль</p>
          <div className="mt-3.5 h-1 overflow-hidden rounded bg-neutral-800">
            <span className="block h-full w-[60%] bg-neutral-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
