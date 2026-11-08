"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { COST_VERSION, calculateCostWhy, costTaskLabels, parseCostInput, whyReview, type CostInput } from "@/lib/tools/cost-why";
import { encodeCostTransfer, COST_STORAGE_KEY } from "@/lib/tools/cost-why-storage";
import { GUIDED_STORAGE_KEY, encodeGuidedTransfer } from "@/lib/tools/storage";
import { costToGuided } from "@/lib/tools/cost-why";
import { parseDecimal } from "@/lib/tools/input";
import { controlClass, numberText, rubles } from "./Fields";
import CostMetrics from "./CostMetrics";
import CostConsultation from "./CostConsultation";

const frequency = { day: "день", week: "неделю", month: "месяц" };
const plural = (n: number, forms: [string, string, string]) => forms[n % 100 >= 11 && n % 100 <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2];
function ConditionalRate({ input, task }: { input: CostInput; task: CostInput["tasks"][number] }) {
  const [rate, setRate] = useState("");
  const n = parseDecimal(rate), valid = Number.isFinite(n) && n >= 0 && n <= 1_000_000;
  const scenario = valid ? parseCostInput({ ...input, processes: { ...input.processes, [task]: { ...input.processes[task]!, cost: { kind: "hourly", hourly: n } } } }) : null;
  const row = scenario ? calculateCostWhy(scenario).rows.find(r => r.task === task)! : null;
  return <div className="my-5 border-l-2 border-cream/40 pl-4" aria-label="Условная стоимость часа">
    <p className="text-sm font-medium">Если ставка неизвестна — условный пример</p><p className="text-xs leading-relaxed text-stone">Это не данные вашей компании. Пример не заменит вашу ставку в расчёте или заявке.</p>
    <label htmlFor={`scenario-${task}`} className="mb-2 block text-xs">При стоимости часа X ₽</label><input id={`scenario-${task}`} inputMode="decimal" className={controlClass} value={rate} onChange={e => setRate(e.target.value)} maxLength={12} />
    <div className="mt-2 flex flex-wrap gap-2">{[300, 600, 1000].map(n => <button key={n} type="button" className="min-h-[44px] border border-cream/30 px-3 text-xs" onClick={() => setRate(String(n))}>{n} ₽/ч — пример</button>)}</div>
    {row && <p role="status" className="text-sm">Условно при {rubles(n)}/ч: {rubles(row.cost!)} в месяц и {rubles(row.annualCost!)} в год при той же нагрузке. Это стоимость времени, не экономия.</p>}
    {rate !== "" && !row && <p role="alert" className="text-xs">Проверьте условную ставку: от 0 до 1 000 000 ₽/ч, без превышения допустимого объёма расчёта.</p>}
  </div>;
}
export default function CostWhyResult({ input, mode, description, edit, extension }: { input: CostInput; mode: "labor-cost" | "automation-cost"; description: string; edit: () => void; extension?: ReactNode }) {
  const r = calculateCostWhy(input), [transferError, setTransferError] = useState("");
  return <section aria-label="Стоимость и причины проверки" className="mx-auto max-w-[980px] text-cream [overflow-wrap:anywhere]">
    <p className="mb-2 text-xs uppercase tracking-widest text-stone">Ваши данные и указанные допущения · команда {input.employees}</p>
    <h2 id="cost-result-heading" tabIndex={-1} className="m-0 scroll-mt-24 font-display text-[clamp(28px,4vw,44px)] font-extrabold uppercase leading-tight">{mode === "labor-cost" ? "Во сколько обходится эта работа" : "Где стоит проверить затраты"}</h2>
    {input.tasks.length > 1 && <div className="mt-5" aria-label="Общий итог">
      {r.canSum ? <><h3 className="text-lg font-medium">Общий итог независимых процессов</h3><CostMetrics hours={r.totalHours} cost={r.totalCost} annual={r.totalAnnualCost} />{r.totalCost === null && <p className="text-sm text-stone">Не все ставки известны: общая стоимость не определена.</p>}</> : <p role="status" className="border-l-2 border-signal pl-4 text-sm">Показатели ниже — по каждому процессу. Общий итог не выводится: { !r.complete ? "есть незавершённые замеры." : !r.independent ? "не подтверждено отсутствие пересечений." : "нагрузка требует проверки." } Не складывайте эти суммы как независимые затраты.</p>}
    </div>}
    {r.rows.map(row => {
      const p = input.processes[row.task]!, t = p.timing, why = whyReview(row.task, input);
      return <article key={row.task} aria-label={costTaskLabels[row.task]} className="mt-6 border border-cream/25 p-4 min-[560px]:p-6">
        <h3 className="m-0 text-xl font-medium">{costTaskLabels[row.task]}</h3>
        <CostMetrics hours={row.hours} cost={row.cost} annual={row.annualCost} />
        <p className="my-5 border-l-2 border-signal pl-4 text-xs leading-relaxed">Это стоимость рабочего времени, а не сумма устранимых потерь или обещанная экономия. Годовая оценка — 12 месяцев при неизменной нагрузке.</p>
        {row.warning && <p role="alert" className="text-sm">Более 200 часов на участника в месяц. Проверьте частоту и повторный учёт. Это диагностический порог, не норма рабочего времени.</p>}
        <div className="border-y border-cream/20 py-4 text-sm leading-relaxed"><h4 className="m-0 font-medium">На чём основан расчёт</h4>
          {t ? <><p>{t.employees} {plural(t.employees, ["сотрудник", "сотрудника", "сотрудников"])} · {numberText(t.repetitions)} {plural(t.repetitions, ["повторение", "повторения", "повторений"])} на человека за {frequency[t.frequency]} · {numberText(t.minutes)} мин{t.frequency === "month" ? "" : ` · ${numberText(t.periodsPerMonth)} ${plural(t.periodsPerMonth, t.frequency === "day" ? ["рабочий день", "рабочих дня", "рабочих дней"] : ["рабочая неделя", "рабочие недели", "рабочих недель"])} в месяц`}</p>
          <p className="text-xs text-stone">{t.employees} × {numberText(t.repetitions)} × {numberText(t.minutes)} × {numberText(t.periodsPerMonth)} / 60 = {numberText(row.hours!)} ч/мес.</p>
          {t.periodAssumption && <p className="text-xs text-stone">График {numberText(t.periodsPerMonth)} {t.frequency === "day" ? "дня" : "недели"} — редактируемое допущение, его нужно сверить с вашим месяцем.</p>}</> : <p>Время пока не замерено: нужны частота, длительность и число участников.</p>}
          {p.cost.kind === "monthly" && <p className="text-xs text-stone">{rubles(p.cost.monthly)} полной стоимости сотрудника / {numberText(p.cost.hours)} отработанных часов = {rubles(row.hourlyRate!)}/ч.{p.cost.hoursAssumption && " Часы — редактируемое допущение, а не ваш подтверждённый график."}</p>}
          {row.cost !== null ? <p className="text-xs text-stone">Стоимость: часы × {rubles(row.hourlyRate!)}/ч = {rubles(row.cost)}/мес.; {rubles(row.cost)} × 12 = {rubles(row.annualCost!)}/год. {row.costPerOperation !== null && `${rubles(row.costPerOperation)} за одно выполнение.`}</p> : <p className="text-xs text-stone">Стоимость не определена: {row.hourlyRate === null ? "ставка не указана." : "время не замерено."} Зарплату и процент экономии не подставляем.</p>}
        </div>
        {row.hours !== null && row.hourlyRate === null && <ConditionalRate input={input} task={row.task} />}
        <div className="mt-6 grid gap-6 md:grid-cols-2"><div><h4 className="font-display text-2xl font-extrabold uppercase">Почему стоит проверить</h4><p className="text-sm leading-relaxed">{why.reason}</p><p className="text-sm leading-relaxed text-stone">{why.possibility}</p></div><div><h4 className="font-display text-2xl font-extrabold uppercase">Что пока неизвестно</h4><ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed">{why.questions.map(q => <li key={q}>{q}</li>)}</ul><p className="text-xs leading-relaxed text-stone">Возможность улучшения и реальную экономию нужно проверить на примере работы.</p></div></div>
      </article>;
    })}
    {description && <p className="mt-5 whitespace-pre-wrap text-sm text-stone">Ваше описание: {description}</p>}
    <button type="button" className="mt-4 min-h-[48px] text-sm underline" onClick={edit}>Изменить исходные данные</button>
    {extension}
    <CostConsultation context={{ tool: mode, version: COST_VERSION, input, costReview: true }} description={description} />
    {mode === "labor-cost" && <><Link className="mt-4 inline-flex min-h-[48px] items-center text-sm underline" href="/tools/automation-cost" onClick={e => { try { sessionStorage.setItem(COST_STORAGE_KEY, encodeCostTransfer(input)); sessionStorage.setItem(GUIDED_STORAGE_KEY, encodeGuidedTransfer(costToGuided(input))); } catch { e.preventDefault(); setTransferError("Хранилище вкладки недоступно. Расчёт остаётся здесь; во втором инструменте введите данные заново."); } }}>Проверить причины затрат во втором инструменте →</Link><p className="text-xs leading-relaxed text-stone">При переходе числовые параметры сохраняются в этой вкладке до 24 часов. Описание не сохраняется.</p></>}
    {transferError && <p role="alert" className="text-sm">{transferError}</p>}
  </section>;
}
