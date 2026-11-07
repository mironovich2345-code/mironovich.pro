"use client";
import Link from "next/link";
import { useState } from "react";
import Wizard, { Choices, NumberAnswer, type Step } from "./Wizard";
import { laborAnswers, type LaborAnswers } from "@/lib/tools/wizard";
import { calculateLabor, LABOR_VERSION } from "@/lib/tools/labor";
import { LABOR_STORAGE_KEY, encodeLaborTransfer } from "@/lib/tools/storage";
import { Metric, buttonClass, controlClass, numberText, rubles } from "./Fields";
import ToolLead from "./ToolLead";
const tasks = { reporting: "Составляют отчёты", transfer: "Переносят данные между системами", documents: "Заполняют документы", requests: "Обрабатывают заявки", knowledge: "Отвечают на повторяющиеся вопросы", custom: "Другое" };
const initial: LaborAnswers = { task: "", other: "", employees: "", operations: "", days: "22", minutes: "", costMode: "", hourly: "", monthly: "", paidHours: "", percent: "50" };
export default function LaborCalculator() {
  const [a, set] = useState(initial); const [done, setDone] = useState(false); const [transferError, setTransferError] = useState(false);
  const update = (key: keyof LaborAnswers, value: string) => set((v) => ({ ...v, [key]: value }));
  const numeric = (key: keyof LaborAnswers, label: string, buttons = false) => <NumberAnswer id={"labor-" + key} label={label} value={a[key]} onChange={(v) => update(key, v)} buttons={buttons} />;
  const validate = (keys: string[]) => { const p = laborAnswers({ ...a, employees: a.employees || "0", operations: a.operations || "0", minutes: a.minutes || "0", costMode: a.costMode || "unknown" }); return !p.ok ? Object.entries(p.errors).find(([k]) => keys.includes(k))?.[1] ?? null : null; };
  const steps: Step[] = [
    { id: "task", title: "Какую работу сотрудники постоянно делают вручную?", hint: "Выберите один процесс. Остальные можно посчитать отдельно.", content: <><Choices name="task" options={tasks} value={a.task} onChange={(v) => { update("task", v); if (v !== "custom") update("other", ""); }} />{a.task === "custom" && <><label htmlFor="labor-other" className="mt-4 block text-sm text-cream">Опишите работу — необязательно</label><input id="labor-other" className={controlClass} value={a.other} maxLength={100} onChange={(e) => update("other", e.target.value)} /></>}</>, validate: () => a.task ? null : "Выберите вид работы." },
    { id: "people", title: "Сколько сотрудников выполняют эту работу?", hint: "Укажите количество людей, занятых этим процессом.", content: numeric("employees", "Количество сотрудников", true), validate: () => a.employees ? validate(["employees"]) : "Укажите число сотрудников." },
    { id: "frequency", title: "Сколько раз в день каждый сотрудник выполняет это действие?", hint: "22 рабочих дня — только пример. Измените его под ваш график.", content: <>{numeric("operations", "Действий на сотрудника в день")}{numeric("days", "Рабочих дней в месяц")}</>, validate: () => a.operations && a.days ? validate(["operationsPerDay", "workingDays"]) : "Заполните частоту и рабочие дни." },
    { id: "time", title: "Сколько минут занимает одно такое действие?", hint: "Можно выбрать пример или указать своё время, в том числе с десятичной запятой.", content: <><Choices name="minutes" options={{ "1": "1 минута", "5": "5 минут", "10": "10 минут", "15": "15 минут", "30": "30 минут", custom: "Своё значение" }} value={["1","5","10","15","30"].includes(a.minutes) ? a.minutes : "custom"} onChange={(v) => update("minutes", v === "custom" ? "" : v)} />{numeric("minutes", "Минут на одно действие")}</>, validate: () => a.minutes ? validate(["minutesPerOperation"]) : "Укажите время одного действия." },
    { id: "cost", title: "Сколько компании стоит один час работы сотрудника?", hint: "Полные расходы могут включать не только зарплату, но и налоги и другие затраты работодателя.", content: <><Choices name="cost" options={{ hourly: "Знаю стоимость часа", monthly: "Знаю месячные расходы на сотрудника", unknown: "Не знаю — посчитать только часы" }} value={a.costMode} onChange={(v) => update("costMode", v)} />{a.costMode === "hourly" && numeric("hourly", "Полная стоимость часа, ₽")}{a.costMode === "monthly" && <>{numeric("monthly", "Полные расходы за месяц, ₽")}{numeric("paidHours", "Рабочих часов в этом месяце")}</>}</>, validate: () => !a.costMode ? "Выберите способ расчёта." : validate(["hourlyCost", "form"]) },
    { id: "share", title: "Какую часть этой работы, по вашему мнению, можно поручить программе?", hint: "Это ваша гипотеза, а не гарантированный результат автоматизации.", content: <><label htmlFor="labor-percent" className="block text-2xl text-cream">{a.percent}%</label><input id="labor-percent" className="mt-6 min-h-[48px] w-full accent-[#D92D2D]" type="range" min="0" max="100" value={a.percent} onChange={(e) => update("percent", e.target.value)} /></>, validate: () => { const p = laborAnswers(a); return p.ok ? null : Object.values(p.errors)[0]; } },
  ];
  const parsed = laborAnswers(a);
  if (!done || !parsed.ok) return <Wizard steps={steps} finish={() => { setDone(true); requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-label="Результат ручного труда"]')?.focus()); }} />;
  const input = parsed.value, r = calculateLabor(input);
  return <section aria-label="Результат ручного труда" className="mx-auto max-w-[800px] border border-cream/20 p-5 min-[560px]:p-10" tabIndex={-1}>
    <h2 className="font-display text-3xl font-extrabold uppercase text-cream">{tasks[a.task as keyof typeof tasks]}</h2>
    <dl><Metric primary label="Время в месяц" value={numberText(r.monthlyHours) + " ч"} /><Metric label="Стоимость этой работы в месяц" value={r.monthlyCost === null ? "Неизвестна" : rubles(r.monthlyCost)} /><Metric label="Потенциально свободное время" value={numberText(r.freedHours) + " ч/мес"} /></dl>
    <p className="text-sm leading-relaxed text-stone">Стоимость высвобождаемого времени не равна прямой денежной экономии. Проверить реальную долю автоматизации нужно отдельно.</p>
    <details className="my-6 border-y border-cream/20 py-4 text-sm text-stone"><summary className="min-h-[44px] cursor-pointer text-cream">Подробнее о расчёте</summary><p>{input.employees} × {input.operationsPerDay} × {input.minutesPerOperation} / 60 × {input.workingDays} = {r.monthlyHours} ч/мес.</p><p>Стоимость часа: {input.hourlyCost === null ? "не указана" : rubles(input.hourlyCost)}. Доля: {input.automationPercent}%.</p>{r.annualCost !== null && <p>За год: {rubles(r.annualCost)}. Стоимость высвобождаемого времени: {rubles(r.freedTimeValue ?? 0)}/мес.</p>}<p>Версия: {LABOR_VERSION}. Дни и длительность взяты из ваших ответов.</p></details>
    <button className="min-h-[48px] text-sm text-cream underline" onClick={() => setDone(false)}>Изменить ответы</button>
    <Link className={buttonClass + " mt-4 w-full"} href="/tools/automation-cost#labor-transfer" onClick={(e) => { try { sessionStorage.setItem(LABOR_STORAGE_KEY, encodeLaborTransfer(input)); } catch { e.preventDefault(); setTransferError(true); } }}>Узнать, как это автоматизировать →</Link>
    {transferError && <p role="alert" className="text-sm text-stone">Хранилище вкладки недоступно. <Link className="underline" href="/tools/automation-cost">Перейти без переноса</Link></p>}
    <ToolLead context={{ tool: "labor-cost", version: LABOR_VERSION, input }} variant="secondary" />
  </section>;
}
