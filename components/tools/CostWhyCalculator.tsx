"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { DEFAULT_EMPLOYEES, EMPLOYEE_PRESETS, impacts, systems, taskLabels, type GuidedInput, type Task } from "@/lib/tools/guided";
import { buildCostDraft, costDrafts, emptyCostDraft, type CostDraft } from "@/lib/tools/cost-why-draft";
import { calculateCostWhy, costTaskLabels, costToGuided, type CostInput } from "@/lib/tools/cost-why";
import { COST_STORAGE_KEY, decodeCostTransfer, guidedToCost } from "@/lib/tools/cost-why-storage";
import { GUIDED_STORAGE_KEY, decodeGuidedTransfer } from "@/lib/tools/storage";
import CostMetrics from "./CostMetrics";
import CostWhyResult from "./CostWhyResult";
import { buttonClass, controlClass } from "./Fields";

function Numeric({ id, label, value, change, presets = [], hint, error }: { id: string; label: string; value: string; change: (v: string) => void; presets?: number[]; hint?: string; error?: string }) {
  return <div className="min-w-0"><label htmlFor={id} className="mb-2 block text-sm">{label}</label><input id={id} className={controlClass} inputMode="decimal" maxLength={12} value={value} onChange={e => change(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={[hint ? id + "-hint" : "", error ? id + "-error" : ""].filter(Boolean).join(" ") || undefined} />
    {presets.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{presets.map(n => <button type="button" key={n} aria-label={`${label}: ${n}`} aria-pressed={value === String(n)} onClick={() => change(String(n))} className={"min-h-[44px] min-w-[44px] border px-3 text-sm " + (value === String(n) ? "border-signal" : "border-cream/25")}>{n}</button>)}</div>}
    {hint && <p id={id + "-hint"} className="text-xs leading-relaxed text-stone">{hint}</p>}{error && <p id={id + "-error"} role="alert" className="text-xs">{error}</p>}
  </div>;
}

/** Client-to-client result slot is the integration seam for PR #9, not an API call.
 * Pass its separately gated analysis component here only during controlled integration. */
export default function CostWhyCalculator({ mode, resultExtension }: { mode: "labor-cost" | "automation-cost"; resultExtension?: (input: GuidedInput) => ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]), [employees, setEmployees] = useState(String(DEFAULT_EMPLOYEES));
  const [drafts, setDrafts] = useState<Partial<Record<Task, CostDraft>>>({});
  const [selectedSystems, setSystems] = useState<GuidedInput["systems"]>([]), [impact, setImpact] = useState<GuidedInput["impact"]>("unknown");
  const [description, setDescription] = useState(""), [result, setResult] = useState<CostInput | null>(null), [errors, setErrors] = useState<Record<string, string>>({});
  const formHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (mode !== "automation-cost") return;
    try {
      const fresh = decodeCostTransfer(sessionStorage.getItem(COST_STORAGE_KEY));
      const legacy = fresh ? null : decodeGuidedTransfer(sessionStorage.getItem(GUIDED_STORAGE_KEY));
      const input = fresh ?? (legacy ? guidedToCost(legacy) : null);
      if (input) { setTasks(input.tasks); setEmployees(String(input.employees)); setSystems(input.systems); setImpact(input.impact); setDrafts(costDrafts(input)); setResult(input); }
    } catch { /* Storage is optional; calculations remain available. */ }
  }, [mode]);
  function changeTeam(value: string) {
    setEmployees(value); setErrors({});
    setDrafts(old => Object.fromEntries(Object.entries(old).map(([key, row]) => [key, row?.allTeam ? { ...row, employees: value } : row])));
  }
  function update(task: Task, patch: Partial<CostDraft>) { setDrafts(old => ({ ...old, [task]: { ...(old[task] ?? emptyCostDraft(employees)), ...patch } })); setErrors({}); }
  function toggle(task: Task) { setTasks(old => old.includes(task) ? old.filter(t => t !== task) : [...old, task]); setDrafts(old => { const next = { ...old }; delete next[task]; return next; }); setErrors({}); }
  function show() {
    const built = buildCostDraft({ tasks, employees, systems: selectedSystems, impact, drafts });
    if (!built.input) { setErrors(built.errors); requestAnimationFrame(() => { const key = Object.keys(built.errors)[0]; (key === "tasks" ? formHeading.current : document.getElementById(key))?.focus(); }); return; }
    setResult(built.input); setErrors({}); requestAnimationFrame(() => { const h = document.getElementById("cost-result-heading"); h?.focus(); h?.scrollIntoView({ block: "start" }); });
  }
  if (result) return <CostWhyResult input={result} mode={mode} description={description} extension={resultExtension?.(costToGuided(result))} edit={() => { setResult(null); requestAnimationFrame(() => { formHeading.current?.focus(); formHeading.current?.scrollIntoView({ block: "start" }); }); }} />;
  return <div className="mx-auto max-w-[980px] border border-cream/25 p-4 text-cream min-[560px]:p-7 [overflow-wrap:anywhere]">
    <form noValidate onSubmit={e => { e.preventDefault(); show(); }}>
      <h2 ref={formHeading} tabIndex={-1} className="m-0 mb-5 scroll-mt-24 font-display text-2xl font-extrabold uppercase">Какая работа повторяется?</h2>
      <p className="text-sm leading-relaxed text-stone">Можно выбрать несколько процессов. Для быстрого начала достаточно одного; удобнее сначала оценить 1–3 процесса.</p>
      <fieldset><legend className="sr-only">Выберите процессы</legend><div className="grid grid-cols-2 gap-2 lg:grid-cols-3">{Object.entries(costTaskLabels).map(([key, label]) => <label key={key} className={"flex min-h-[64px] cursor-pointer items-center gap-2 border p-2 text-sm min-[560px]:p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal " + (tasks.includes(key as Task) ? "border-signal bg-signal/10" : "border-cream/25")}><input name="tasks" type="checkbox" value={key} className="h-5 w-5 shrink-0 accent-[#D92D2D]" checked={tasks.includes(key as Task)} onChange={() => toggle(key as Task)} /><span>{label}</span></label>)}</div></fieldset>
      {errors.tasks && <p role="alert" className="text-sm">{errors.tasks}</p>}
      <div className="my-7"><Numeric id="cost-team" label="Сколько сотрудников в команде?" value={employees} change={changeTeam} presets={[...EMPLOYEE_PRESETS]} error={errors["cost-team"]} hint="По умолчанию 4. Участников каждого процесса можно уточнить ниже; считаем от одного человека." /></div>
      {tasks.map(task => {
        const d = drafts[task] ?? emptyCostDraft(employees), prefix = `cost-${task}-`;
        const single = buildCostDraft({ tasks: [task], employees, systems: selectedSystems, impact, drafts });
        const preview = single.input ? calculateCostWhy(single.input).rows[0] : null;
        const field = (key: "employees" | "repetitions" | "minutes" | "periods" | "hourly" | "monthly" | "paidHours", label: string, presets: number[] = [], hint?: string) => <Numeric id={prefix + key} label={label} value={d[key]} presets={presets} hint={hint} error={errors[prefix + key]} change={v => update(task, { [key]: v, ...(key === "employees" ? { allTeam: false } : key === "periods" ? { periodAssumption: false } : key === "paidHours" ? { hoursAssumption: false } : {}) })} />;
        return <fieldset key={task} className="my-6 min-w-0 border border-cream/25 p-4 min-[560px]:p-5"><legend className="max-w-full px-2 text-lg font-medium">{taskLabels[task]}</legend>
          <div className="grid gap-5 sm:grid-cols-2">{field("employees", "Сколько сотрудников выполняют процесс?", [], d.allTeam ? "По умолчанию вся команда. Уточните число участников." : undefined)}<div><label htmlFor={prefix + "frequency"} className="mb-2 block text-sm">За какой период считаем повторы?</label><select id={prefix + "frequency"} className={controlClass} value={d.frequency} onChange={e => { const frequency = e.target.value as CostDraft["frequency"]; update(task, { frequency, periods: frequency === "day" ? "22" : frequency === "week" ? "4" : "1", periodAssumption: frequency !== "month" }); }}><option value="day">За день</option><option value="week">За неделю</option><option value="month">За месяц</option></select></div>
          {field("repetitions", "Повторений на одного сотрудника за период", [1, 5, 10, 20])}{field("minutes", "Минут на одно выполнение", [1, 3, 5, 15, 30])}
          {d.frequency !== "month" && field("periods", d.frequency === "day" ? "Рабочих дней в этом месяце" : "Рабочих недель в этом месяце", d.frequency === "day" ? [20, 22, 25] : [4, 5], d.periodAssumption ? `Допущение: ${d.periods} ${d.frequency === "day" ? "рабочих дня" : "недели"}. Замените своим графиком.` : "Используем указанный вами график.")}</div>
          <button type="button" className="mt-2 min-h-[44px] text-xs underline" onClick={() => update(task, { repetitions: "", minutes: "" })}>Пока нет замеров — оставить время неизвестным</button>
          <fieldset className="mt-5 border-t border-cream/20 pt-4"><legend className="pt-3 text-sm font-medium">Как задать стоимость сотрудника?</legend><div className="my-3 flex flex-wrap gap-2">{([["hourly", "Стоимость часа"], ["monthly", "Полная стоимость за месяц"], ["unknown", "Не знаю ставку"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={d.costMode === key} className={"min-h-[48px] border px-3 py-2 text-xs " + (d.costMode === key ? "border-signal" : "border-cream/25")} onClick={() => update(task, { costMode: key })}>{label}</button>)}</div>
            {d.costMode === "hourly" && field("hourly", "Ваша стоимость часа, ₽", [], "Оставьте пустым, если не знаете. Выдуманную ставку не подставляем.")}
            {d.costMode === "monthly" && <div className="grid gap-5 sm:grid-cols-2">{field("monthly", "Полная стоимость одного сотрудника в месяц, ₽", [], "Ваши расходы на сотрудника, включая обязательные начисления. Не зарплата, выбранная нами.")}{field("paidHours", "Отработанных часов в месяц", [120, 160, 176], d.hoursAssumption ? "Допущение 160 ч/мес — измените на фактическое значение. Это не установленный график вашей компании." : "Ставка часа = полная месячная стоимость / указанные часы.")}</div>}
            {d.costMode === "unknown" && <p className="text-xs text-stone">Покажем часы без фактической стоимости. После расчёта можно проверить явно условную ставку.</p>}
          </fieldset>
          {tasks.length > 1 && <label className="mt-5 flex min-h-[48px] items-start gap-3 text-sm leading-relaxed"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#D92D2D]" checked={d.independent} onChange={e => update(task, { independent: e.target.checked })} /><span>Эта работа не включена в другие выбранные процессы. Подтверждаю отсутствие пересечений.</span></label>}
          <div aria-label={`Предпросмотр: ${taskLabels[task]}`} aria-live="polite"><CostMetrics compact hours={preview?.hours ?? null} cost={preview?.cost ?? null} annual={preview?.annualCost ?? null} /><p className="mb-0 text-xs leading-relaxed text-stone">Предпросмотр по введённым данным. Стоимость времени не равна экономии.{!single.input && " Завершите замер или оставьте частоту и длительность пустыми."}</p></div>
        </fieldset>;
      })}
      <details className="my-5 border-y border-cream/20 py-3"><summary className="min-h-[48px] cursor-pointer py-3 text-sm">Контекст и описание — если хотите уточнить</summary>
        <label htmlFor="cost-description" className="mb-2 block text-sm">Опишите процесс своими словами — необязательно</label><textarea id="cost-description" className={controlClass + " min-h-[100px] py-3"} maxLength={400} value={description} onChange={e => { setDescription(e.target.value); if (e.target.value.trim() && !tasks.length) setTasks(["other"]); }} /><p className="text-xs leading-relaxed text-stone">Без контактов, паролей и данных клиентов. Описание остаётся в памяти страницы и попадёт в заявку только после её редактирования, согласия и отправки.</p>
        {mode === "automation-cost" && <><fieldset className="mt-4"><legend className="mb-2 text-sm">Какие программы участвуют?</legend><div className="grid gap-2 sm:grid-cols-2">{Object.entries(systems).map(([key, label]) => <label key={key} className="flex min-h-[48px] items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0 accent-[#D92D2D]" checked={selectedSystems.includes(key as GuidedInput["systems"][number])} onChange={() => setSystems(old => { const k = key as GuidedInput["systems"][number]; return old.includes(k) ? old.filter(v => v !== k) : ["none", "unknown"].includes(k) ? [k] : [...old.filter(v => !["none", "unknown"].includes(v)), k]; })} />{label}</label>)}</div></fieldset><label htmlFor="cost-impact" className="mb-2 mt-4 block text-sm">Что произойдёт при ошибке?</label><select id="cost-impact" className={controlClass} value={impact} onChange={e => setImpact(e.target.value as GuidedInput["impact"])}>{Object.entries(impacts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></>}
      </details>
      <button type="submit" className={buttonClass + " w-full"}>Показать стоимость и причины</button><p className="mb-0 text-center text-xs leading-relaxed text-stone">Бесплатно и без заявки. Без передачи данных в OpenAI.</p>
    </form>
  </div>;
}
