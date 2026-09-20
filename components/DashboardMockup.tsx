export default function DashboardMockup() {
  const bars = [38, 56, 34, 70, 92, 62, 48];
  return (
    <div
      aria-hidden
      className="rounded-md bg-panel p-3.5 shadow-[0_0_0_1px_#292b31,0_16px_40px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center gap-2.5 px-1 pb-3.5 pt-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="text-[11px] uppercase tracking-[0.16em] text-neutral-600">Внутренняя платформа</span>
      </div>

      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,104px),1fr))]">
        <div className="rounded-md bg-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-600">Адаптация</p>
          <div className="mt-3.5 h-1 overflow-hidden rounded bg-neutral-800">
            <span className="block h-full w-[72%] bg-accent" />
          </div>
        </div>
        <div className="rounded-md bg-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-600">Обучение</p>
          <div className="mt-3.5 flex gap-[3px]">
            <span className="h-1 flex-1 rounded bg-accent" />
            <span className="h-1 flex-1 rounded bg-accent" />
            <span className="h-1 flex-1 rounded bg-neutral-800" />
          </div>
        </div>
        <div className="rounded-md bg-surface p-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-600">План дня</p>
          <div className="mt-3.5 h-1 overflow-hidden rounded bg-neutral-800">
            <span className="block h-full w-[45%] bg-neutral-700" />
          </div>
        </div>
      </div>

      <div className="mt-2 rounded-md bg-surface p-3.5">
        <p className="mb-3.5 text-[10px] uppercase tracking-[0.14em] text-neutral-600">Динамика по клубам</p>
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

      <div className="mt-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-3 rounded-md bg-surface p-3">
          <span className="h-5 w-5 flex-none rounded-md bg-neutral-800" />
          <span className="h-[5px] flex-1 rounded bg-neutral-800" />
          <span className="h-[5px] w-[5px] flex-none rounded-full bg-accent" />
        </div>
        <div className="flex items-center gap-3 rounded-md bg-surface p-3">
          <span className="h-5 w-5 flex-none rounded-md bg-neutral-800" />
          <span className="h-[5px] w-[62%] rounded bg-neutral-800" />
          <span className="ml-auto h-[5px] w-[5px] flex-none rounded-full bg-neutral-700" />
        </div>
      </div>
    </div>
  );
}
