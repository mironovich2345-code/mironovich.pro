"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { automationModel } from "@/config/automation-model";
import { apiOptions, calculateAutomation, dataOptions, defaultAutomation, loadOptions, parseAutomationInput, processTypes, type AutomationInput } from "@/lib/tools/automation";
import { parseDecimal, type FieldErrors } from "@/lib/tools/input";
import { calculateLabor, type LaborInput } from "@/lib/tools/labor";
import { decodeLaborTransfer, LABOR_STORAGE_KEY } from "@/lib/tools/storage";
import { track } from "@/lib/analytics";
import ToolLead from "./ToolLead";
import { buttonClass, controlClass, Field, Metric, numberText, rubles } from "./Fields";

type Values = Omit<AutomationInput, "employees" | "integrations"> & { employees: string; integrations: string };
const initial: Values = { ...defaultAutomation, employees: "3", integrations: "1" };
const selectors = [
  { key: "processType", label: "Тип процесса", options: processTypes },
  { key: "api", label: "Доступность API", options: apiOptions },
  { key: "data", label: "Состояние исходных данных", options: dataOptions },
  { key: "load", label: "Предполагаемая нагрузка", options: loadOptions },
] as const;
const switches = [
  { key: "interface", label: "Нужен отдельный пользовательский интерфейс" },
  { key: "documents", label: "Нужна обработка документов" },
  { key: "ai", label: "Хочу проверить применение ИИ" },
  { key: "humanReview", label: "Результат будет проверять человек" },
  { key: "support", label: "Нужно техническое сопровождение" },
] as const;

export default function AutomationCalculator() {
  const [values, setValues] = useState<Values>(initial);
  const [description, setDescription] = useState("");
  const [labor, setLabor] = useState<LaborInput | null>(null);
  const [input, setInput] = useState<AutomationInput | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [economics, setEconomics] = useState({ enabled: false, benefit: "", residual: "0" });
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LABOR_STORAGE_KEY);
      const transfer = decodeLaborTransfer(raw);
      if (transfer) {
        setLabor(transfer); setValues((v) => ({ ...v, employees: String(transfer.employees) }));
      } else if (raw) sessionStorage.removeItem(LABOR_STORAGE_KEY);
    } catch { /* Storage may be disabled; standalone calculation still works. */ }
  }, []);
  const result = input ? calculateAutomation(input, labor ?? undefined) : null;
  const range = (r: readonly number[]) => rubles(r[0]) + " — " + rubles(r[1]);
  const update = <K extends keyof Values>(key: K, value: Values[K]) => { setValues({ ...values, [key]: value }); setInput(null); setErrors({}); };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const p = parseAutomationInput({ ...values, employees: parseDecimal(values.employees), integrations: parseDecimal(values.integrations), ...(economics.enabled ? { confirmedCashBenefit: parseDecimal(economics.benefit), residualManualCost: parseDecimal(economics.residual) } : {}) });
    if (!p.ok) { setErrors(p.errors); setInput(null); document.getElementById("automation-" + Object.keys(p.errors)[0])?.focus(); return; }
    setErrors({}); setInput(p.value); track("tool_calculate", { location: "tools" });
    requestAnimationFrame(() => resultRef.current?.focus());
  };
  return <>
    {labor && <div id="labor-transfer" className="mb-8 flex flex-wrap items-center justify-between gap-4 border border-cream/25 p-5" role="status">
      <div><p className="m-0 text-sm text-cream">Данные ручного труда перенесены: {numberText(calculateLabor(labor).monthlyHours)} ч/мес.</p><p className="m-0 mt-2 text-xs leading-relaxed text-stone">Хранятся только в этой вкладке, до 24 часов. Название процесса и описание не переносятся.</p></div>
      <button type="button" className="min-h-[44px] text-sm text-cream underline underline-offset-4" onClick={() => { setLabor(null); setInput(null); try { sessionStorage.removeItem(LABOR_STORAGE_KEY); } catch {} }}>Убрать данные</button>
    </div>}
    <div className="grid items-start gap-10 min-[1000px]:grid-cols-[1fr_1fr] min-[1000px]:gap-12">
      <form noValidate onSubmit={submit} className="min-w-0">
        <p className="m-0 mb-5 text-[12px] uppercase tracking-[0.16em] text-stone">01 / Условия задачи</p>
        <p className="mb-6 text-[14px] leading-[1.6] text-stone">Начальные значения — пример. Отметьте реальные условия: инструмент предложит подход и состав работ. ИИ не включён по умолчанию.</p>
        {Object.keys(errors).length > 0 && <p role="alert" className="border-l-2 border-signal pl-3 text-sm text-cream">Проверьте отмеченные поля.</p>}
        <div className="grid min-w-0 gap-5 min-[560px]:grid-cols-2">
          {selectors.map(({ key, label, options }) => <Field key={key} id={"automation-" + key} label={label} error={errors[key]}>
            <select id={"automation-" + key} value={values[key]} onChange={(e) => update(key, e.target.value as never)} aria-invalid={!!errors[key]} className={controlClass}>
              {Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </Field>)}
          {([{ key: "employees", label: "Количество сотрудников" }, { key: "integrations", label: "Количество интеграций" }] as const).map(({ key, label }) => <Field key={key} id={"automation-" + key} label={label} error={errors[key]} hint={key === "employees" ? "Для контекста задачи; бюджет не умножается на число людей." : "Отдельные связи с системами, от 0 до 20."}>
            <input id={"automation-" + key} value={values[key]} inputMode="numeric" maxLength={8} aria-invalid={!!errors[key]} aria-describedby={"automation-" + key + (errors[key] ? "-error" : "-hint")} onChange={(e) => update(key, e.target.value)} className={controlClass} />
          </Field>)}
        </div>
        <div className="my-6">
          <Field id="automation-description" label="Краткое описание задачи — необязательно" hint="Не влияет на формулы. Остаётся в браузере; при обращении попадёт в редактируемое описание заявки.">
            <textarea id="automation-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} className={controlClass + " py-3"} />
          </Field>
        </div>
        <fieldset className="m-0 flex min-w-0 flex-col border-0 border-t border-solid border-cream/20 p-0">
          <legend className="mb-2 pr-3 text-[12px] uppercase tracking-[0.12em] text-stone">Требования</legend>
          {switches.map(({ key, label }) => <label key={key} className="flex min-h-[52px] cursor-pointer items-center gap-3 border-b border-cream/15 py-3 text-[14px] leading-[1.5] text-cream"><input type="checkbox" checked={values[key]} onChange={(e) => update(key, e.target.checked)} className="h-5 w-5 shrink-0 accent-[#D92D2D]" />{label}</label>)}
        </fieldset>
        {automationModel.approvedByOwner && automationModel.publicPricingEnabled && <fieldset className="mt-6 min-w-0 border border-cream/20 p-4">
          <legend className="px-2 text-sm text-cream">Экономика — необязательно</legend>
          <label className="flex min-h-[44px] items-center gap-3 text-sm text-stone"><input type="checkbox" checked={economics.enabled} onChange={(e) => { setEconomics({ ...economics, enabled: e.target.checked }); setInput(null); }} className="h-5 w-5 accent-[#D92D2D]" />Есть данные для денежной окупаемости</label>
          {economics.enabled && <div className="mt-4 grid gap-4">
            <Field id="automation-confirmedCashBenefit" label="Подтверждённая денежная выгода, ₽/мес" hint="Без вычета регулярных расходов и остаточного ручного труда. Не подставляйте сюда стоимость высвобождаемого времени." error={errors.confirmedCashBenefit}><input id="automation-confirmedCashBenefit" inputMode="decimal" value={economics.benefit} onChange={(e) => { setEconomics({ ...economics, benefit: e.target.value }); setInput(null); }} className={controlClass} /></Field>
            <Field id="automation-residualManualCost" label="Остаточные затраты ручной работы, ₽/мес" error={errors.residualManualCost}><input id="automation-residualManualCost" inputMode="decimal" value={economics.residual} onChange={(e) => { setEconomics({ ...economics, residual: e.target.value }); setInput(null); }} className={controlClass} /></Field>
          </div>}
        </fieldset>}
        <button type="submit" className={buttonClass + " mt-7 w-full"}>Оценить подход и состав работ</button>
      </form>

      <div ref={resultRef} tabIndex={-1} aria-label="Результат оценки автоматизации" className="min-w-0 border border-cream/20 p-5 outline-none min-[560px]:p-7">
        <p className="m-0 mb-4 text-[12px] uppercase tracking-[0.16em] text-stone">02 / Предварительная оценка</p>
        {!result || !input ? <>
          <h2 className="m-0 font-display text-3xl font-extrabold uppercase text-cream">Сначала подход. Потом бюджет.</h2>
          <p className="mt-5 text-[16px] leading-[1.7] text-stone">Ответьте на вопросы, чтобы увидеть рекомендацию, этапы, сложность и риски. Это инженерная гипотеза по выбранным параметрам, а не коммерческое предложение.</p>
          {!(automationModel.approvedByOwner && automationModel.publicPricingEnabled) && <p className="mt-6 border-l-2 border-signal pl-4 text-sm leading-relaxed text-cream/80">Денежная модель пока не утверждена владельцем. Публичные цены и срок окупаемости выключены. Расчёт ручного труда по вашим данным доступен полностью.</p>}
        </> : <>
          <h2 className="m-0 font-display text-3xl font-extrabold uppercase leading-tight text-cream">{result.recommendation.approach}</h2>
          <p className="mt-4 text-[15px] leading-[1.7] text-cream/80">{result.recommendation.reason}</p>
          <dl className="m-0">
            <Metric primary label="Сложность по модели" value={result.complexity} />
            <Metric label="Трудоёмкость — начальная гипотеза" value={`${result.hours[0]}–${result.hours[1]} ч`} note="Не оценка сроков в календарных днях. Реальный объём требует изучения задачи." />
            {result.budget && <Metric label="Предварительный бюджет" value={range(result.budget)} note="Не оферта; точная оценка после разбора." />}
          </dl>
          {!result.pricingEnabled && <p className="border-l-2 border-signal pl-4 text-sm leading-relaxed text-cream/80">Бюджет и денежные диапазоны скрыты: модель не утверждена. Ниже — состав работ и гипотезы часов, которые ещё нужно проверить.</p>}
          <h3 className="mb-4 mt-8 text-[13px] uppercase tracking-[0.12em] text-cream">Разбивка по этапам</h3>
          <dl className="m-0">
            {result.stages.map((s) => <div key={s.name} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-cream/15 py-3 text-[14px]"><dt className="text-stone">{s.name}</dt><dd className="m-0 text-cream">{s.hours[1] ? `${s.hours[0]}–${s.hours[1]} ч` : "Не заложено"}</dd></div>)}
          </dl>
          <h3 className="mb-4 mt-8 text-[13px] uppercase tracking-[0.12em] text-cream">Регулярные расходы</h3>
          <ul className="m-0 list-none p-0 text-[14px] leading-[1.6] text-stone">
            {result.recurring.map((s, n) => <li key={s.name} className="border-t border-cream/15 py-3"><span className="text-cream">{s.name}:</span> {s.range ? range(s.range) + "/мес" : n === 2 && !result.recommendation.usesAI ? "ИИ не предлагается, расходы на модель не заложены." : n === 3 && !input.support ? "Не включено. Определите ответственного за поддержку." : "Нужно уточнить тарифы, нагрузку и условия. Сумма пока не опубликована."}</li>)}
          </ul>
          {labor && <p className="mt-6 border-t border-cream/20 pt-5 text-sm leading-relaxed text-stone">Из первого расчёта: потенциальная стоимость высвобождаемого времени — {rubles(result.potentialTimeValue ?? 0)}/мес. Это не подтверждённая денежная выгода и не основание обещать окупаемость.</p>}
          <h3 className="mb-2 mt-7 text-[13px] uppercase tracking-[0.12em] text-cream">Окупаемость</h3>
          {result.paybackMonths && <p className="font-display text-3xl text-cream">{numberText(result.paybackMonths[0])}–{numberText(result.paybackMonths[1])} мес.</p>}
          <p className="text-[14px] leading-[1.6] text-stone">{result.paybackReason}</p>
          <h3 className="mb-3 mt-7 text-[13px] uppercase tracking-[0.12em] text-cream">Риски и неизвестные</h3>
          <ul className="m-0 space-y-3 pl-4 text-[14px] leading-[1.6] text-stone">{result.risks.map((r) => <li key={r}>{r}</li>)}</ul>
          <ToolLead key={JSON.stringify([input, labor])} context={{ tool: "automation-cost", version: result.version, input, ...(labor ? { labor } : {}) }} description={description} />
        </>}
        <p className="mb-0 mt-6 break-words text-[11px] leading-relaxed text-stone">Модель: {automationModel.version} · {automationModel.date} · Начальные гипотезы, не рыночные данные.</p>
        <Link href="/tools/labor-cost" className="mt-6 inline-flex min-h-[44px] items-center text-sm text-cream underline underline-offset-4">← Рассчитать стоимость ручного труда</Link>
      </div>
    </div>
  </>;
}
