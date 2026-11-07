"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass, controlClass } from "./Fields";
export type Step = { id: string; title: string; hint: string; content: ReactNode; validate: () => string | null };
export default function Wizard({ steps, finish }: { steps: Step[]; finish: () => void }) {
  const [index, setIndex] = useState(0); const [error, setError] = useState(""); const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const step = steps[Math.min(index, steps.length - 1)];
  const move = (next: number) => { setIndex(next); setError(""); requestAnimationFrame(() => heading.current?.focus()); };
  return <form noValidate onSubmit={(e) => { e.preventDefault(); const problem = step.validate(); if (problem) { setError(problem); return; } if (index === steps.length - 1) finish(); else move(index + 1); }} className="mx-auto max-w-[800px] border border-cream/20 p-5 min-[560px]:p-10">
    <p className="m-0 mb-4 text-xs uppercase tracking-[0.14em] text-stone">Шаг {index + 1} из {steps.length}</p>
    <div role="progressbar" aria-label="Прогресс опроса" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index + 1} className="mb-8 h-1 bg-cream/15"><div className="h-full bg-signal" style={{ width: ((index + 1) / steps.length * 100) + "%" }} /></div>
    <h2 ref={heading} tabIndex={-1} className="m-0 text-balance font-display text-[clamp(26px,4vw,44px)] font-extrabold uppercase leading-tight text-cream outline-none scroll-mt-24">{step.title}</h2>
    <p className="mb-7 mt-4 text-[15px] leading-relaxed text-stone">{step.hint}</p>
    <div key={step.id}>{step.content}</div>
    {error && <p role="alert" className="mt-5 border-l-2 border-signal pl-3 text-sm leading-relaxed text-signal">{error}</p>}
    <div className="mt-8 flex gap-3"><button type="button" disabled={index === 0} className="min-h-[54px] border border-cream/30 px-5 text-sm text-cream disabled:opacity-30" onClick={() => move(index - 1)}>Назад</button><button type="submit" className={buttonClass + " grow"}>{index === steps.length - 1 ? "Показать результат" : "Продолжить"}</button></div>
  </form>;
}
export function Choices({ name, options, value, onChange, multi = false }: { name: string; options: Record<string, string>; value: string | string[]; onChange: (value: string) => void; multi?: boolean }) {
  return <div className="grid gap-3 min-[560px]:grid-cols-2">{Object.entries(options).map(([key, label]) => <label key={key} className={"flex min-h-[64px] cursor-pointer items-center gap-3 border p-4 text-[15px] leading-relaxed text-cream has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal " + ((Array.isArray(value) ? value.includes(key) : value === key) ? "border-signal bg-signal/10" : "border-cream/25")}><input className="h-5 w-5 shrink-0 accent-[#D92D2D]" type={multi ? "checkbox" : "radio"} name={name} checked={Array.isArray(value) ? value.includes(key) : value === key} onChange={() => onChange(key)} />{label}</label>)}</div>;
}
export function NumberAnswer({ id, label, value, onChange, buttons = false }: { id: string; label: string; value: string; onChange: (v: string) => void; buttons?: boolean }) {
  return <div className="my-4 min-w-0"><label className="mb-2 block text-sm text-cream" htmlFor={id}>{label}</label><div className="flex gap-2">{buttons && <button type="button" aria-label="Уменьшить количество" className="w-14 shrink-0 border border-cream/30 text-xl text-cream" onClick={() => onChange(String(Math.max(0, (Number(value) || 0) - 1)))}>−</button>}<input id={id} className={controlClass} inputMode="decimal" maxLength={16} value={value} onChange={(e) => onChange(e.target.value)} />{buttons && <button type="button" aria-label="Увеличить количество" className="w-14 shrink-0 border border-cream/30 text-xl text-cream" onClick={() => onChange(String((Number(value) || 0) + 1))}>+</button>}</div></div>;
}
