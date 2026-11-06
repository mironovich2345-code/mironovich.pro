import { automationModel } from "../../config/automation-model.ts";
import { parseLaborInput, calculateLabor, LABOR_VERSION, type LaborInput } from "./labor.ts";
import { parseAutomationInput, calculateAutomation, processTypes, type AutomationInput } from "./automation.ts";
import { record } from "./input.ts";

export type ToolContext =
  | { tool: "labor-cost"; version: string; input: LaborInput }
  | { tool: "automation-cost"; version: string; input: AutomationInput; labor?: LaborInput };

/** Whitelist only structured parameters. Client results, names and descriptions are discarded. */
export function parseToolContext(raw: unknown): ToolContext | null {
  const src = record(raw);
  if (!src) return null;
  if (src.tool === "labor-cost" && src.version === LABOR_VERSION) {
    const p = parseLaborInput(src.input);
    return p.ok ? { tool: "labor-cost", version: LABOR_VERSION, input: p.value } : null;
  }
  if (src.tool === "automation-cost" && src.version === automationModel.version) {
    const p = parseAutomationInput(src.input);
    if (!p.ok) return null;
    const labor = src.labor === undefined ? undefined : parseLaborInput(src.labor);
    if (labor && !labor.ok) return null;
    return { tool: "automation-cost", version: automationModel.version, input: p.value, ...(labor?.ok ? { labor: labor.value } : {}) };
  }
  return null;
}

/** Called by the API; all results are recalculated using the current server model. */
export function describeToolContext(context: ToolContext): string {
  if (context.tool === "labor-cost") {
    const i = context.input, r = calculateLabor(i);
    return `Ручной труд · ${LABOR_VERSION}\nПроцесс: повторяющиеся операции (название не передаётся).\nСотрудников: ${i.employees}; операций/день на человека: ${i.operationsPerDay}; минут/операцию: ${i.minutesPerOperation}; дней/мес: ${i.workingDays}; ₽/час: ${i.hourlyCost ?? "неизвестно"}; автоматизация: ${i.automationPercent}%.\nПересчитано сервером: ${r.monthlyHours} ч/мес; ${r.monthlyCost === null ? "стоимость неизвестна" : r.monthlyCost + " ₽/мес; " + r.annualCost + " ₽/год"}; потенциально ${r.freedHours} ч и ${r.freedTimeValue === null ? "неизвестная стоимость" : r.freedTimeValue + " ₽ стоимости"} времени/мес. Это не подтверждённая денежная экономия.`;
  }
  const i = context.input, r = calculateAutomation(i, context.labor);
  const economics = i.confirmedCashBenefit === undefined ? "" : `\nДенежная выгода (заявлено пользователем): ${i.confirmedCashBenefit} ₽/мес; остаточный ручной труд: ${i.residualManualCost} ₽/мес.`;

  return `Автоматизация · ${r.version}\nТип: ${processTypes[i.processType]}; сотрудников: ${i.employees}; интеграций: ${i.integrations}; API: ${i.api}; данные: ${i.data}; нагрузка: ${i.load}; интерфейс: ${i.interface}; документы: ${i.documents}; ИИ запрошен: ${i.ai}; проверка человеком: ${i.humanReview}; сопровождение: ${i.support}.\nПересчитано сервером: ${r.recommendation.approach}; сложность: ${r.complexity}; ${r.stages.length ? r.hours[0] + "–" + r.hours[1] + " ч" : "трудоёмкость неизвестна"}.\n${r.budget ? `Бюджет: ${r.budget[0]}–${r.budget[1]} ₽.` : "Денежная модель не опубликована; суммы клиента не принимаются."}${economics}${r.paybackMonths ? `\nОкупаемость по сценарию: ${r.paybackMonths[0]}–${r.paybackMonths[1]} мес.` : ""}${context.labor ? `\nИз расчёта ручного труда: ${calculateLabor(context.labor).monthlyHours} ч/мес; потенциал ${r.potentialTimeValue ?? "неизвестная стоимость"} ₽ стоимости времени/мес (не денежная экономия).` : ""}`;
}
