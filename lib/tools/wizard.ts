import { applyDiagnosis, parseDiagnosis, type DiagnosisInput } from "./diagnosis.ts";
import { parseDecimal, type Parsed } from "./input.ts";
import { parseLaborInput, type LaborInput } from "./labor.ts";
import { parseAutomationInput, type AutomationInput } from "./automation.ts";

export type LaborAnswers = { task: string; other: string; employees: string; operations: string; days: string; minutes: string; costMode: string; hourly: string; monthly: string; paidHours: string; percent: string };
export function laborAnswers(a: LaborAnswers): Parsed<LaborInput> {
  let hourlyCost: number | null = a.costMode === "unknown" ? null : parseDecimal(a.hourly);
  if (a.costMode === "monthly") {
    const hours = parseDecimal(a.paidHours), monthly = parseDecimal(a.monthly);
    if (!(hours > 0 && hours <= 744 && Number.isFinite(monthly) && monthly >= 0 && monthly <= 1000000000)) return { ok: false, errors: { form: "Укажите месячные затраты и рабочие часы больше нуля (до 744)." } };
    hourlyCost = monthly / hours;
  }
  return parseLaborInput({ employees: parseDecimal(a.employees), operationsPerDay: parseDecimal(a.operations), workingDays: parseDecimal(a.days), minutesPerOperation: parseDecimal(a.minutes), hourlyCost, automationPercent: parseDecimal(a.percent) });
}
export type AutoAnswers = { task: string; systems: string[]; api: string; data: string; load: string; employees: string; integrations: string; actions: string[]; ui: boolean; review: boolean; support: boolean; description: string; programNames?: string; goal?: DiagnosisInput["goal"]; errorImpact?: DiagnosisInput["errorImpact"] };
export function automationAnswers(a: AutoAnswers): Parsed<AutomationInput> {
  const manual = a.systems.includes("manual");
  const usesAI = a.actions.some((s) => ["answers", "analysis", "decisions"].includes(s));
  const parsed = parseAutomationInput({ processType: a.task, employees: parseDecimal(a.employees), integrations: manual ? 0 : parseDecimal(a.integrations), api: manual ? "unknown" : a.api,
    data: a.data, load: a.load, interface: a.ui, documents: a.actions.includes("documents") || a.task === "documents",
    ai: usesAI, humanReview: a.review, support: a.support });
  if (!parsed.ok || a.goal === undefined) return parsed;
  const diagnosis = diagnosisAnswers(a);
  return diagnosis ? { ok: true, value: applyDiagnosis(parsed.value, diagnosis) } : { ok: false, errors: { form: "Проверьте цель, последствия ошибки и выбранные действия." } };
}

export function diagnosisAnswers(a: AutoAnswers): DiagnosisInput | null {
  return parseDiagnosis({ systems: a.systems, programNames: a.programNames ?? "", goal: a.goal ?? "unknown", errorImpact: a.errorImpact ?? "unknown", actions: a.actions });
}
