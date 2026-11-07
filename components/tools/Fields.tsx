import type { ReactNode } from "react";

export const controlClass = "min-h-[52px] w-full min-w-0 border border-cream/25 bg-graphite px-3 text-base text-cream outline-none focus:border-signal aria-[invalid=true]:border-signal";
export const buttonClass = "inline-flex min-h-[54px] items-center justify-center bg-signal px-5 py-3 text-center text-[15px] font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] disabled:opacity-60";
export const numberText = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
export const rubles = (n: number) => numberText(n) + " ₽";

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-2">
    <label htmlFor={id} className="text-[13px] leading-[1.4] text-cream">{label}</label>
    {children}
    {hint && <p id={id + "-hint"} className="m-0 text-[12px] leading-[1.5] text-stone">{hint}</p>}
    {error && <p id={id + "-error"} className="m-0 text-[13px] text-signal">{error}</p>}
  </div>;
}

export function Metric({ label, value, note, primary = false }: { label: string; value: string; note?: string; primary?: boolean }) {
  return <div className={"min-w-0 border-t py-5 " + (primary ? "border-signal" : "border-cream/20")}>
    <dt className="text-[12px] uppercase tracking-[0.08em] text-stone">{label}</dt>
    <dd className={"m-0 mt-2 break-words font-display text-[clamp(28px,4vw,48px)] font-extrabold leading-tight " + (primary ? "text-signal" : "text-cream")}>{value}</dd>
    {note && <dd className="m-0 mt-1 text-[13px] leading-[1.5] text-stone">{note}</dd>}
  </div>;
}
