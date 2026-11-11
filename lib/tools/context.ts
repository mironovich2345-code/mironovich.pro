import { recommendationCards } from "./catalog.ts";
import { parseGuided, calculateGuided, GUIDED_VERSION, taskLabels, type GuidedInput } from "./guided.ts";
import { applyDiagnosis, parseDiagnosis, errorImpacts, type DiagnosisInput } from "./diagnosis.ts";
import { buildActionPlan } from "./action-plan.ts";
import { automationModel } from "../../config/automation-model.ts";
import { parseLaborInput, calculateLabor, LABOR_VERSION, type LaborInput } from "./labor.ts";
import { parseAutomationInput, calculateAutomation, processTypes, type AutomationInput } from "./automation.ts";
import { record } from "./input.ts";
import { COST_VERSION, calculateCostWhy, parseCostInput, whyReview, type CostInput } from "./cost-why.ts";
import { QUIZ_VERSION, parseQuizInput, type QuizInput } from "./quiz-model.ts";
import { describeQuizInput } from "./quiz-context.ts";

export type ToolContext =
  | { tool: "labor-cost" | "automation-cost"; version: typeof QUIZ_VERSION; input: QuizInput; quiz: true }
  | { tool: "labor-cost" | "automation-cost"; version: typeof COST_VERSION; input: CostInput; costReview: true }
  | { tool: "labor-cost" | "automation-cost"; version: typeof GUIDED_VERSION; input: GuidedInput; guided: true }
  | { tool: "labor-cost"; version: string; input: LaborInput }
  | { tool: "automation-cost"; version: string; input: AutomationInput; labor?: LaborInput; diagnosis?: DiagnosisInput };

/** Whitelist inputs only. Diagnostic program names are bounded; client plans/results are discarded. */
export function parseToolContext(raw: unknown): ToolContext | null {
  const src = record(raw);
  if (!src) return null;
  if ((src.tool === "labor-cost" || src.tool === "automation-cost") && src.version === QUIZ_VERSION) {
    const input = parseQuizInput(src.input);
    if (!input || (src.tool === "labor-cost" && input.kind !== "labor")) return null;
    return { tool: src.tool, version: QUIZ_VERSION, input, quiz: true };
  }
  if ((src.tool === "labor-cost" || src.tool === "automation-cost") && src.version === COST_VERSION) {
    const input = parseCostInput(src.input);
    return input ? { tool: src.tool, version: COST_VERSION, input, costReview: true } : null;
  }
  if ((src.tool === "labor-cost" || src.tool === "automation-cost") && src.version === GUIDED_VERSION) {
    const p=parseGuided(src.input);
    return p ? { tool:src.tool,version:GUIDED_VERSION,input:p,guided:true } : null;
  }
  if (src.tool === "labor-cost" && src.version === LABOR_VERSION) {
    const p = parseLaborInput(src.input);
    return p.ok ? { tool: "labor-cost", version: LABOR_VERSION, input: p.value } : null;
  }
  if (src.tool === "automation-cost" && src.version === automationModel.version) {
    const p = parseAutomationInput(src.input);
    if (!p.ok) return null;
    const labor = src.labor === undefined ? undefined : parseLaborInput(src.labor);
    if (labor && !labor.ok) return null;
    const diagnosis = src.diagnosis === undefined ? undefined : parseDiagnosis(src.diagnosis);
    if (diagnosis === null) return null;
    return { tool: "automation-cost", version: automationModel.version, input: diagnosis ? applyDiagnosis(p.value, diagnosis) : p.value, ...(diagnosis ? { diagnosis } : {}), ...(labor?.ok ? { labor: labor.value } : {}) };
  }
  return null;
}

/** Called by the API; all results are recalculated using the current server model. */
export function describeToolContext(context: ToolContext): string {
  if ("quiz" in context) return describeQuizInput(context.input);
  if ("costReview" in context) {
    const r = calculateCostWhy(context.input);
    return `Стоимость повторяющейся работы · ${COST_VERSION} · пересчитано сервером
Команда: ${context.input.employees}.
Общий итог: ${r.totalHours === null ? "не сводится" : r.totalHours + " ч/мес"}; ${r.totalCost === null ? "стоимость неизвестна или суммирование запрещено" : r.totalCost + " ₽/мес; " + r.totalAnnualCost + " ₽/год"}.
Это стоимость времени, не устранимые потери и не денежная экономия.
${r.rows.map(row => {
  const p = context.input.processes[row.task]!;
  const basis = p.cost.kind === "monthly" ? `${p.cost.monthly} ₽/сотрудника в месяц / ${p.cost.hours} ч${p.cost.hoursAssumption ? " (допущение часов)" : ""}` : p.cost.kind === "hourly" ? `${p.cost.hourly} ₽/ч` : "ставка неизвестна";
  const t = p.timing;
  const units = { day: "день", week: "нед", month: "мес" };
  const formula = t ? `${t.employees} чел × ${t.repetitions}/${units[t.frequency]} × ${t.minutes} мин × ${t.periodsPerMonth} период/мес /60 = ` : "";
  return `${taskLabels[row.task]}: ${formula}${row.hours === null ? "время неизвестно" : row.hours + " ч/мес"}; ${row.cost === null ? "стоимость неизвестна" : row.cost + " ₽/мес; " + row.annualCost + " ₽/год"}; ${basis}.${t?.periodAssumption ? " График — допущение." : ""}`;
}).join("\n")}
Год: 12 месяцев при той же нагрузке. На консультации — реальные узкие места, целесообразность, выбор решения и пилот.
Вопрос: ${whyReview(context.input.tasks[0], context.input).questions[0]}`;
  }
  if ("guided" in context) {
    const r=calculateGuided(context.input);
    return `Разбор процессов · ${GUIDED_VERSION} · пересчитано сервером
Сотрудников: ${context.input.employees}.
${r.rows.map(row=>`${taskLabels[row.task]}: ${row.hours === null ? "время не измерено" : row.hours+" ч/мес"}; ${row.cost===null?"стоимость неизвестна":row.cost+" ₽ стоимости времени"}`).join("\n")}
Итог независимых процессов: ${r.totalHours ?? "не сводится"} ч. Высвобождение времени — после пилота; денежная экономия не подтверждена.
Базовые подходы: ${recommendationCards(context.input).map(c=>`${c.title}: ${c.type}`).join("; ")}.`;

  }
  if (context.tool === "labor-cost") {
    const i = context.input, r = calculateLabor(i);
    return `Ручной труд · ${LABOR_VERSION}\nПроцесс: повторяющиеся операции (название не передаётся).\nСотрудников: ${i.employees}; операций/день на человека: ${i.operationsPerDay}; минут/операцию: ${i.minutesPerOperation}; дней/мес: ${i.workingDays}; ₽/час: ${i.hourlyCost ?? "неизвестно"}; автоматизация: ${i.automationPercent}%.\nПересчитано сервером: ${r.monthlyHours} ч/мес; ${r.monthlyCost === null ? "стоимость неизвестна" : r.monthlyCost + " ₽/мес; " + r.annualCost + " ₽/год"}; потенциально ${r.freedHours} ч и ${r.freedTimeValue === null ? "неизвестная стоимость" : r.freedTimeValue + " ₽ стоимости"} времени/мес. Это не подтверждённая денежная экономия.`;
  }
  const i = context.input, r = calculateAutomation(i, context.labor, undefined, context.diagnosis);
  if (context.diagnosis) {
    const d = context.diagnosis, plan = buildActionPlan(i, d, context.labor);
    const labor = plan.economics;
    return `Автоматизация · ${r.version} · пересчитано сервером
Процесс: ${plan.process}. Цель: ${plan.goal}.
Системы: ${plan.systems.join(", ")}.
Ошибка: ${errorImpacts[d.errorImpact]}. Контроль: запрошен ${i.humanReview}; нужен ${plan.humanControl}.
Подход: ${plan.recommendation.approach}.
План:
${plan.steps.map((s, n) => `${n + 1}. ${s}`).join("\n")}
Ограничения:
${plan.technicalLimits.map(s => `• ${s}`).join("\n")}
${labor ? `Ручной труд: ${labor.monthlyHours} ч/мес; ${labor.monthlyCost === null ? "стоимость неизвестна" : labor.monthlyCost + " ₽/мес"}; потенциал ${labor.freedHours} ч. Это стоимость времени, не денежная экономия.` : "Ручной труд не рассчитан."}
Программы (возможности не проверены): ${d.programNames || "не указаны"}.`;
  }
  const economics = i.confirmedCashBenefit === undefined ? "" : `\nДенежная выгода (заявлено пользователем): ${i.confirmedCashBenefit} ₽/мес; остаточный ручной труд: ${i.residualManualCost} ₽/мес.`;

  return `Автоматизация · ${r.version}\nТип: ${processTypes[i.processType]}; сотрудников: ${i.employees}; интеграций: ${i.integrations}; API: ${i.api}; данные: ${i.data}; нагрузка: ${i.load}; интерфейс: ${i.interface}; документы: ${i.documents}; ИИ запрошен: ${i.ai}; проверка человеком: ${i.humanReview}; сопровождение: ${i.support}.\nПересчитано сервером: ${r.recommendation.approach}; сложность: ${r.complexity}; ${r.stages.length ? r.hours[0] + "–" + r.hours[1] + " ч" : "трудоёмкость неизвестна"}.\n${r.budget ? `Бюджет: ${r.budget[0]}–${r.budget[1]} ₽.` : "Денежная модель не опубликована; суммы клиента не принимаются."}${economics}${r.paybackMonths ? `\nОкупаемость по сценарию: ${r.paybackMonths[0]}–${r.paybackMonths[1]} мес.` : ""}${context.labor ? `\nИз расчёта ручного труда: ${calculateLabor(context.labor).monthlyHours} ч/мес; потенциал ${r.potentialTimeValue ?? "неизвестная стоимость"} ₽ стоимости времени/мес (не денежная экономия).` : ""}`;
}
