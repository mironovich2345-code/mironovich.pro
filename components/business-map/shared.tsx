import { useId, type KeyboardEvent } from "react";
import type { Group } from "../../lib/business-map/contracts";
import { groups } from "./presentation";

export function Badge({ group }: { group: Group }) { return <span className={`bm-badge bm-badge-${group}`}>{groups[group]}</span>; }
export function Arrow({ back = false }: { back?: boolean }) { return <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" style={back?{transform:"rotate(180deg)"}:undefined}><path d="M3 10h13m-5-5 5 5-5 5"/></svg>; }
export function NumberField({ label, value, onChange, hint, min = 0, max, error, optional = false }: { label: string; value: string; onChange: (value: string) => void; hint?: string; min?: number; max?: number; error?: string; optional?: boolean }) {
  const id = useId();
  return <div className="bm-field"><label htmlFor={id}>{label}{optional && <small>Необязательно</small>}</label><input id={id} type="text" inputMode="decimal" autoComplete="off" value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={hint || error ? id + "-hint" : undefined} placeholder={optional ? "Не знаю / не введено" : "Например, 10"} data-min={min} data-max={max} /><small id={id + "-hint"} className={error ? "bm-error-text" : ""}>{error || hint}</small></div>;
}
export function SelectField({ label, value, options, onChange, hint }: { label: string; value: string; options: Record<string,string>; onChange: (value: string) => void; hint?: string }) {
  const id = useId();
  return <div className="bm-field"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e => onChange(e.target.value)}>{Object.entries(options).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>{hint && <small>{hint}</small>}</div>;
}
export function Callout({ children, tone = "quiet" }: { children: React.ReactNode; tone?: "quiet" | "warning" }) { return <div className={`bm-callout bm-callout-${tone}`}>{children}</div>; }
export function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) { return <div className="bm-section-heading"><div><p className="bm-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{children}</div>; }

/** Roving tab focus: keyboard operation stays equivalent to selecting a view. */
export function tabKeys(e: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (current < 0) return;
  e.preventDefault();
  const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (current + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].click(); buttons[next].focus();
}
