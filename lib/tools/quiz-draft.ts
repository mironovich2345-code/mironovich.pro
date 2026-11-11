import { parseDecimal, record } from "./input.ts";
import { taskLabels, type Task } from "./guided.ts";
import { daysInMonth, shiftCount, parseQuizLabor, type QuizLabor, type QuizGroup, type Schedule } from "./quiz-model.ts";

export type MeasureDraft = { frequency: "shift" | "week" | "month"; repetitions: string; frequencyUnknown: boolean; duration: string; durationUnit: "minutes" | "hours"; durationUnknown: boolean };
export type GroupDraft = { id: QuizGroup["id"]; employees: string; schedule: Schedule | ""; useActual: boolean; actualShifts: string; shiftHours: string; payKind: "salary" | "employer" | "unknown"; amount: string; measures: Partial<Record<Task, MeasureDraft>> };
export type LaborDraft = { tasks: Task[]; month: string; groups: GroupDraft[]; groupsDistinct: boolean; independent: Task[] };
export type StepKind = "processes" | "employees" | "frequency" | "duration" | "schedule" | "actual_shifts" | "shift_hours" | "pay" | "obstacle" | "issue_frequency" | "consequence";
export type QuizStep = { id: string; kind: StepKind; group?: QuizGroup["id"]; task?: Task };
export const emptyMeasure = (): MeasureDraft => ({ frequency: "shift", repetitions: "", frequencyUnknown: false, duration: "", durationUnit: "minutes", durationUnknown: false });
export const emptyGroup = (id: QuizGroup["id"] = "g1"): GroupDraft => ({ id, employees: id === "g1" ? "4" : "1", schedule: "", useActual: false, actualShifts: "", shiftHours: "", payKind: "salary", amount: "", measures: {} });
export function currentMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}`;
}
export const initialLaborDraft = (): LaborDraft => ({ tasks: [], month: currentMonth(), groups: [emptyGroup()], groupsDistinct: true, independent: [] });
export function laborSteps(d: LaborDraft): QuizStep[] {
  const out: QuizStep[] = [{ id: "processes", kind: "processes" }];
  for (const group of d.groups) {
    out.push({ id: `${group.id}.employees`, kind: "employees", group: group.id });
    for (const task of d.tasks.length ? d.tasks : ["other" as Task]) {
      const m = group.measures[task] ?? emptyMeasure();
      out.push({ id: `${group.id}.${task}.frequency`, kind: "frequency", group: group.id, task });
      if (!m.frequencyUnknown && !(m.repetitions !== "" && parseDecimal(m.repetitions) === 0)) out.push({ id: `${group.id}.${task}.duration`, kind: "duration", group: group.id, task });
    }
    out.push({ id: `${group.id}.schedule`, kind: "schedule", group: group.id });
    if (group.useActual || group.schedule === "other") out.push({ id: `${group.id}.actual_shifts`, kind: "actual_shifts", group: group.id });
    out.push({ id: `${group.id}.shift_hours`, kind: "shift_hours", group: group.id }, { id: `${group.id}.pay`, kind: "pay", group: group.id });
  }
  return out;
}
export function stepError(d: LaborDraft, step: QuizStep): string | null {
  if (step.kind === "processes") return d.tasks.length ? null : "Выберите хотя бы один процесс.";
  const g = d.groups.find(g => g.id === step.group)!;
  if (!g) return "Выберите существующую группу.";
  const m = step.task ? g.measures[step.task] ?? emptyMeasure() : null;
  if (step.kind === "employees") {
    const count = parseDecimal(g.employees), total = d.groups.reduce((s, g) => s + parseDecimal(g.employees), 0);
    if (!Number.isInteger(count) || count < 1 || count > 10000 || total > 10000) return "Укажите от 1 до 10 000 участников; сумма групп также не больше 10 000.";
    if (d.groups.length > 1 && !d.groupsDistinct) return "Подтвердите, что каждый сотрудник входит только в одну группу.";
  }
  if (step.kind === "frequency" && !m!.frequencyUnknown) { const n = parseDecimal(m!.repetitions); if (!Number.isInteger(n) || n < 0 || n > 100000) return "Укажите число повторений от 0 до 100 000 на одного сотрудника или выберите «Пока не знаю»."; }
  if (step.kind === "duration" && !m!.durationUnknown) { const n = parseDecimal(m!.duration) * (m!.durationUnit === "hours" ? 60 : 1); if (!Number.isFinite(n) || n < 0 || n > 10080) return "Укажите длительность до 10 080 минут / 168 часов либо выберите «Пока не знаю»."; }
  if (step.kind === "schedule" && (!daysInMonth(d.month) || !g.schedule)) return "Выберите график и корректный месяц расчёта.";
  if (step.kind === "actual_shifts") { const n = parseDecimal(g.actualShifts); if (!Number.isInteger(n) || n < 1 || n > (daysInMonth(d.month) ?? 0)) return "Укажите фактическое число смен от 1 до числа календарных дней месяца."; }
  if (step.kind === "shift_hours") { const n = parseDecimal(g.shiftHours); if (!Number.isFinite(n) || n < 0.25 || n > 24) return "Укажите от 0,25 до 24 часов в смену."; }
  if (step.kind === "pay" && g.payKind !== "unknown") {
    const n = parseDecimal(g.amount), shifts = g.schedule ? shiftCount(d.month, g.schedule, g.useActual || g.schedule === "other" ? parseDecimal(g.actualShifts) : null) : null;
    if (!Number.isFinite(n) || n < 0 || n > 10000000) return "Введите свою месячную сумму от 0 до 10 000 000 ₽ или выберите «Не знаю».";
    if (shifts && n / (shifts * parseDecimal(g.shiftHours)) > 1000000) return "Получилась слишком большая ставка часа. Проверьте сумму и рабочие часы.";
  }
  return null;
}
export function buildQuizLabor(d: LaborDraft): QuizLabor | null {
  if (laborSteps(d).some(step => stepError(d, step))) return null;
  return parseQuizLabor({ tasks: d.tasks, month: d.month, groupsDistinct: d.groupsDistinct, independent: d.independent.filter(t => d.tasks.includes(t)), groups: d.groups.map(g => ({ id: g.id, employees: parseDecimal(g.employees), schedule: g.schedule, actualShifts: g.useActual || g.schedule === "other" ? parseDecimal(g.actualShifts) : null, shiftHours: parseDecimal(g.shiftHours), pay: g.payKind === "unknown" ? { kind: "unknown" } : { kind: g.payKind, amount: parseDecimal(g.amount) }, measures: Object.fromEntries(d.tasks.map(task => { const m = g.measures[task] ?? emptyMeasure(); return [task, { frequency: m.frequency, repetitions: m.frequencyUnknown ? null : parseDecimal(m.repetitions), minutes: m.frequencyUnknown || m.durationUnknown || (m.duration === "" && parseDecimal(m.repetitions) === 0) ? null : parseDecimal(m.duration) * (m.durationUnit === "hours" ? 60 : 1) }]; })) })) });
}

/** Only bounded numeric drafts/enums persist. Never free text, contacts or event payloads. */
export function cleanLaborDraft(raw: unknown): LaborDraft | null {
  const s = record(raw);
  if (!s || !Array.isArray(s.tasks) || s.tasks.length > 9 || !s.tasks.every(t => typeof t === "string" && Object.hasOwn(taskLabels, t)) || new Set(s.tasks).size !== s.tasks.length || typeof s.month !== "string" || !daysInMonth(s.month) || !Array.isArray(s.groups) || !s.groups.length || s.groups.length > 3 || typeof s.groupsDistinct !== "boolean") return null;
  const text = (v: unknown) => typeof v === "string" && v.length <= 32 && /^\d{0,8}(?:[.,]\d{0,20})?$/.test(v) ? v : "";
  const groups: GroupDraft[] = [];
  for (const item of s.groups) {
    const g = record(item), measures = record(g?.measures);
    if (!g || !["g1", "g2", "g3"].includes(String(g.id)) || groups.some(x => x.id === g.id) || !["", "5/2", "2/2", "3/3", "6/1", "3/2", "other"].includes(String(g.schedule)) || !["salary", "employer", "unknown"].includes(String(g.payKind)) || !measures) return null;
    const cleaned: GroupDraft["measures"] = {};
    for (const task of s.tasks as Task[]) {
      const m = record(measures[task]);
      if (!m) continue;
      if (!["shift", "week", "month"].includes(String(m.frequency)) || !["minutes", "hours"].includes(String(m.durationUnit))) return null;
      cleaned[task] = { frequency: m.frequency as MeasureDraft["frequency"], repetitions: m.frequencyUnknown === true ? "" : text(m.repetitions), frequencyUnknown: m.frequencyUnknown === true, duration: m.durationUnknown === true || m.frequencyUnknown === true ? "" : text(m.duration), durationUnit: m.durationUnit as MeasureDraft["durationUnit"], durationUnknown: m.durationUnknown === true };
    }
    groups.push({ id: g.id as GroupDraft["id"], employees: text(g.employees), schedule: g.schedule as GroupDraft["schedule"], useActual: g.useActual === true, actualShifts: text(g.actualShifts), shiftHours: text(g.shiftHours), payKind: g.payKind as GroupDraft["payKind"], amount: g.payKind === "unknown" ? "" : text(g.amount), measures: cleaned });
  }
  return { tasks: [...s.tasks] as Task[], month: s.month, groups, groupsDistinct: s.groupsDistinct, independent: Array.isArray(s.independent) ? [...new Set(s.independent.filter(t => (s.tasks as Task[]).includes(t)))] as Task[] : [] };
}
