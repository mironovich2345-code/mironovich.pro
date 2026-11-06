"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { LABOR_VERSION, calculateLabor, laborFields, parseLaborInput, type LaborInput } from "@/lib/tools/labor";
import { parseDecimal, type FieldErrors } from "@/lib/tools/input";
import { LABOR_STORAGE_KEY, encodeLaborTransfer } from "@/lib/tools/storage";
import { track } from "@/lib/analytics";
import { buttonClass, controlClass, Field, Metric, numberText, rubles } from "./Fields";
import ToolLead from "./ToolLead";

const initial = { employees: "3", operationsPerDay: "20", minutesPerOperation: "3", workingDays: "22", hourlyCost: "600", automationPercent: "50" };

export default function LaborCalculator() {
  const [values, setValues] = useState(initial);
  const [processName, setProcessName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [input, setInput] = useState<LaborInput | null>(null);
  const [transferError, setTransferError] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const result = input ? calculateLabor(input) : null;
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseLaborInput(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, parseDecimal(v)])));
    if (!parsed.ok) {
      setInput(null); setErrors(parsed.errors);
      (document.getElementById("labor-" + Object.keys(parsed.errors)[0]) ?? document.getElementById("labor-employees"))?.focus();
      return;
    }
    setErrors({}); setInput(parsed.value); setTransferError(false); track("tool_calculate", { location: "tools" });
    requestAnimationFrame(() => resultRef.current?.focus());
  };
  return <div className="grid items-start gap-10 min-[1000px]:grid-cols-[1fr_1fr] min-[1000px]:gap-12">
    <form noValidate onSubmit={submit} className="min-w-0">
      <p className="m-0 mb-6 text-[12px] uppercase tracking-[0.16em] text-stone">01 / Ваш процесс</p>
      <Field id="labor-name" label="Название процесса — необязательно" hint="Только для вас: не сохраняется и не переносится в другой инструмент.">
        <input id="labor-name" value={processName} maxLength={100} autoComplete="off" onChange={(e) => setProcessName(e.target.value)} className={controlClass} />
      </Field>
      <p className="my-6 text-[14px] leading-[1.6] text-stone">Начальные значения — пример. Замените их данными вашей компании. Полная стоимость часа включает оплату труда и связанные затраты работодателя.</p>
      {Object.keys(errors).length > 0 && <p role="alert" className="mb-5 border-l-2 border-signal pl-3 text-sm text-cream">{errors.form || "Проверьте отмеченные поля."}</p>}
      <div className="grid min-w-0 gap-5 min-[560px]:grid-cols-2">
        {(Object.keys(laborFields) as (keyof LaborInput)[]).map((key) => {
          const spec = laborFields[key], id = "labor-" + key;
          return <Field key={key} id={id} label={spec.label} error={errors[key]} hint={key === "automationPercent" ? "Гипотеза, а не гарантированная экономия." : undefined}>
            <input id={id} type="text" inputMode={spec.integer ? "numeric" : "decimal"} maxLength={16} value={values[key]} aria-invalid={!!errors[key]} aria-describedby={[errors[key] ? id + "-error" : "", key === "automationPercent" ? id + "-hint" : ""].filter(Boolean).join(" ") || undefined} onChange={(e) => { setValues({ ...values, [key]: e.target.value }); setInput(null); setErrors({}); }} className={controlClass} />
          </Field>;
        })}
      </div>
      <button type="submit" className={buttonClass + " mt-7 w-full"}>Рассчитать стоимость труда</button>
    </form>

    <div ref={resultRef} tabIndex={-1} aria-label="Результат расчёта ручного труда" className="min-w-0 border border-cream/20 p-5 outline-none min-[560px]:p-7">
      <p className="m-0 mb-4 text-[12px] uppercase tracking-[0.16em] text-stone">02 / Результат</p>
      {result && input ? <>
        <h2 className="m-0 mb-5 break-words font-display text-3xl font-extrabold uppercase text-cream">{processName || "Стоимость процесса"}</h2>
        <dl className="m-0">
          <Metric primary label="Стоимость в месяц" value={rubles(result.monthlyCost)} />
          <Metric label="Стоимость в год" value={rubles(result.annualCost)} />
          <Metric label="Ручной труд в месяц" value={numberText(result.monthlyHours) + " ч"} />
          <Metric label="Потенциально высвобождаемое время" value={numberText(result.freedHours) + " ч/мес"} />
          <Metric label="Стоимость высвобождаемого времени" value={rubles(result.freedTimeValue) + "/мес"} />
        </dl>
        <div className="mt-3 h-2 w-full bg-cream/15" role="img" aria-label={`Потенциальная доля автоматизации: ${input.automationPercent}%`}><div className="h-full bg-signal" style={{ width: input.automationPercent + "%" }} /></div>
        <p className="mt-4 text-[14px] leading-[1.6] text-cream/80">Высвобождение времени не равно сокращению денежных расходов: команда может направить его на другую работу. Реализуемость автоматизации и остаточные затраты нужно проверить отдельно.</p>
        {input.operationsPerDay * input.minutesPerOperation > 1440 && <p role="status" className="text-sm text-signal">На одного сотрудника получилось больше 24 часов работы в день. Проверьте частоту и продолжительность операций.</p>}
        <Link href="/tools/automation-cost#labor-transfer" className={buttonClass + " mt-4 w-full bg-transparent border border-cream/40 hover:bg-cream/10"} onClick={(e) => {
          try { sessionStorage.setItem(LABOR_STORAGE_KEY, encodeLaborTransfer(input)); }
          catch { e.preventDefault(); setTransferError(true); }
        }}>Рассчитать стоимость автоматизации →</Link>
        {transferError && <p role="alert" className="text-sm leading-relaxed text-stone">Хранилище вкладки недоступно. <Link href="/tools/automation-cost" className="text-cream underline">Перейти без переноса данных</Link>.</p>}
        <ToolLead key={JSON.stringify(input)} context={{ tool: "labor-cost", version: LABOR_VERSION, input }} />
      </> : <>
        <h2 className="m-0 mb-5 font-display text-3xl font-extrabold uppercase text-cream">Сколько ресурсов требует рутина?</h2>
        <p className="text-[16px] leading-[1.7] text-stone">Заполните параметры слева и нажмите «Рассчитать». Вы получите стоимость процесса и оценку времени, которое потенциально можно направить на другую работу.</p>
        <p className="mt-8 border-t border-cream/20 pt-5 text-[14px] leading-[1.6] text-stone">Расчёт работает в браузере. Контакты не нужны, введённые параметры не отправляются на сервер до отправки заявки.</p>
      </>}
      <p className="mb-0 mt-6 text-[11px] text-stone">Формулы: {LABOR_VERSION} · Валюта: рубли</p>
    </div>
  </div>;
}
