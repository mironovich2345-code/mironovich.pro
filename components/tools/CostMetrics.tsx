import { numberText, rubles } from "./Fields";
export default function CostMetrics({ hours, cost, annual, compact = false }: { hours: number | null; cost: number | null; annual: number | null; compact?: boolean }) {
  const value = compact ? "mt-2 break-words text-xl font-semibold" : "mt-3 break-words font-display text-[clamp(22px,3.5vw,42px)] font-extrabold leading-tight [overflow-wrap:anywhere]";
  const primaryValue = compact ? value : "mt-3 break-words font-display text-[clamp(40px,5vw,64px)] font-extrabold leading-tight [overflow-wrap:anywhere]";
  return <dl className={"m-0 grid min-w-0 grid-cols-2 border border-cream/25 md:grid-cols-[1.3fr_1fr_1fr] " + (compact ? "mt-5" : "mt-4")}>
    <div className={"col-span-2 min-w-0 p-4 md:col-span-1 " + (compact ? "bg-cream/5" : "bg-signal text-white")}><dt className="text-xs leading-relaxed">Стоимость времени / месяц</dt><dd className={"m-0 " + (cost === null ? "mt-3 text-xl" : primaryValue)} data-metric="monthly">{cost === null ? "Неизвестна" : rubles(cost)}</dd></div>
    <div className="min-w-0 border-t border-cream/25 p-4 md:border-l md:border-t-0"><dt className="text-xs leading-relaxed">Ручная работа / месяц</dt><dd className={"m-0 " + (hours === null ? "mt-3 text-lg" : value)} data-metric="hours">{hours === null ? "Не замерена" : numberText(hours) + " ч"}</dd></div>
    <div className="min-w-0 border-l border-t border-cream/25 p-4 md:border-t-0"><dt className="text-xs leading-relaxed">Стоимость времени / год</dt><dd className={"m-0 " + (annual === null ? "mt-3 text-lg" : value)} data-metric="annual">{annual === null ? "Неизвестна" : rubles(annual)}</dd></div>
  </dl>;
}
