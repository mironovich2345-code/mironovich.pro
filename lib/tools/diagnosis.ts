import { record } from "./input.ts";
import type { AutomationInput } from "./automation.ts";

export const systemOptions = { tables: "Excel или Google Таблицы", crm: "CRM — система работы с клиентами", messages: "Мессенджеры", several: "Несколько разных сервисов", manual: "Всё выполняется вручную", other: "Другое" } as const;
export const actionOptions = { transfer: "Передавать данные", documents: "Формировать документы", reports: "Подготавливать отчёты", answers: "Отвечать на вопросы", analysis: "Анализировать информацию", decisions: "Предлагать решения", other: "Другое" } as const;
export const businessGoals = { time: "Сократить ручную работу", service: "Ускорить обслуживание клиентов", errors: "Уменьшить количество ошибок", sales: "Увеличить продажи", control: "Улучшить контроль процессов", other: "Другое", unknown: "Пока не знаю" } as const;
export const errorImpacts = { low: "Ничего критичного", fixable: "Сотрудник сможет исправить ошибку", client: "Клиент может получить неверную информацию", financial: "Возможны финансовые потери", serious: "Возможны юридические или другие серьёзные последствия", unknown: "Пока не знаю" } as const;
export const PROGRAM_NAMES_LIMIT = 160;
export type DiagnosisInput = {
  systems: (keyof typeof systemOptions)[];
  programNames: string;
  goal: keyof typeof businessGoals;
  errorImpact: keyof typeof errorImpacts;
  actions: (keyof typeof actionOptions)[];
};
const option = (o: object, v: unknown) => typeof v === "string" && Object.hasOwn(o, v);
function choices<T extends object>(o: T, v: unknown): v is (keyof T)[] {
  return Array.isArray(v) && v.length > 0 && v.length <= Object.keys(o).length && new Set(v).size === v.length && v.every(x => option(o, x));
}
/** Strict whitelist; free text is accepted only in the consented lead payload, never storage. */
export function parseDiagnosis(raw: unknown): DiagnosisInput | null {
  const s = record(raw);
  if (!s || !choices(systemOptions, s.systems) || !choices(actionOptions, s.actions) || !option(businessGoals, s.goal) || !option(errorImpacts, s.errorImpact)) return null;
  if (s.systems.includes("manual") && s.systems.length !== 1) return null;
  if (typeof s.programNames !== "string" || s.programNames.length > PROGRAM_NAMES_LIMIT || /[\u0000-\u001f\u007f]/.test(s.programNames)) return null;
  return { systems: [...s.systems], programNames: s.systems.includes("manual") ? "" : s.programNames.trim(), goal: s.goal as DiagnosisInput["goal"], errorImpact: s.errorImpact as DiagnosisInput["errorImpact"], actions: [...s.actions] };
}
export function needsHumanControl(d: DiagnosisInput): boolean {
  return ["client", "financial", "serious", "unknown"].includes(d.errorImpact);
}
/** An analysis checkbox alone is not evidence that semantic processing is needed. */
export function semanticWork(i: AutomationInput, d: DiagnosisInput): boolean {
  const textTask = ["documents", "knowledge", "requests", "training"].includes(i.processType);
  return textTask && (d.actions.includes("answers") || d.actions.includes("decisions") || (d.actions.includes("analysis") && i.data !== "clean" && i.data !== "unknown"));
}
export function applyDiagnosis(i: AutomationInput, d: DiagnosisInput): AutomationInput {
  const manual = d.systems.includes("manual");
  return { ...i, ...(manual ? { integrations: 0, api: "unknown" as const } : {}), ai: semanticWork(i, d), documents: d.actions.includes("documents") || i.processType === "documents" };
}
