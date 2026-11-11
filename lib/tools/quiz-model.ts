import { record, numberField, round2 } from "./input.ts";
import { calculateCostWhy, parseCostInput, type CostInput } from "./cost-why.ts";
import { taskLabels, type Task } from "./guided.ts";

export const QUIZ_VERSION = "tools-quiz-4.0.0";
export const schedules = ["5/2", "2/2", "3/3", "6/1", "3/2", "other"] as const;
export type Schedule = typeof schedules[number];
export type Pay = { kind: "unknown" } | { kind: "salary" | "employer"; amount: number };
export type Measure = { frequency: "shift" | "week" | "month"; repetitions: number | null; minutes: number | null };
export type QuizGroup = { id: "g1" | "g2" | "g3"; employees: number; schedule: Schedule; actualShifts: number | null; shiftHours: number; pay: Pay; measures: Partial<Record<Task, Measure>> };
export type QuizLabor = { tasks: Task[]; month: string; groups: QuizGroup[]; groupsDistinct: boolean; independent: Task[] };
export type KnownCost = { kind: "v4"; input: QuizLabor } | { kind: "v3"; input: CostInput };
export const obstacles = { time: "Много времени уходит на рутину", reentry: "Повторный ввод данных", errors: "Ошибки и исправления", waiting: "Ожидание и задержки", unclear: "Пока трудно определить" } as const;
export const issueFrequencies = { often: "Почти каждый день", sometimes: "Несколько раз в месяц", rare: "Редко", unknown: "Пока не знаю" } as const;
export const consequences = { time: "Отвлекает от основной работы", client: "Клиенты ждут ответа", financial: "Финансовые или юридические риски", unknown: "Пока не измеряли" } as const;
export type QuizDiagnosis = { tasks: Task[]; obstacle: keyof typeof obstacles; frequency: keyof typeof issueFrequencies | "measured"; consequence: keyof typeof consequences; known: KnownCost | null };
export type QuizInput = { kind: "labor"; data: QuizLabor } | { kind: "diagnosis"; data: QuizDiagnosis };
export const exactKeys = (r: Record<string, unknown>, keys: readonly string[]) => Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k));
const tasksOK = (v: unknown): v is Task[] => Array.isArray(v) && v.length > 0 && v.length <= 9 && new Set(v).size === v.length && v.every(k => typeof k === "string" && Object.hasOwn(taskLabels, k));
export function daysInMonth(month: string): number | null {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}
/** Calendar illustration only: no holidays, vacations or actual cycle phase are inferred. */
export function scheduleEstimate(month: string, schedule: Schedule) {
  const days = daysInMonth(month);
  if (!days || !schedules.includes(schedule) || schedule === "other") return null;
  const [year, m] = month.split("-").map(Number);
  if (schedule === "5/2" || schedule === "6/1") {
    let shifts = 0;
    for (let d = 1; d <= days; d++) { const day = new Date(Date.UTC(year, m - 1, d)).getUTCDay(); if (day !== 0 && (schedule === "6/1" || day !== 6)) shifts++; }
    return { shifts, min: shifts, max: shifts, days, approximate: true, convention: schedule === "5/2" ? "Пн–Пт, без праздников и отпусков" : "Пн–Сб, без праздников и отпусков" };
  }
  const [on, off] = schedule.split("/").map(Number), cycle = on + off, variants: number[] = [];
  for (let offset = 0; offset < cycle; offset++) { let count = 0; for (let day = 0; day < days; day++) if ((day + offset) % cycle < on) count++; variants.push(count); }
  return { shifts: days * on / cycle, min: Math.min(...variants), max: Math.max(...variants), days, approximate: true, convention: "Средняя оценка; фактические смены зависят от начала цикла" };
}
export function shiftCount(month: string, schedule: Schedule, actual: number | null): number | null {
  const days = daysInMonth(month);
  if (!days) return null;
  if (actual !== null) return numberField(actual, 1, days, true) ? actual : null;
  return scheduleEstimate(month, schedule)?.shifts ?? null;
}
export function periodFactor(month: string, frequency: Measure["frequency"], shifts: number): number {
  return frequency === "shift" ? shifts : frequency === "week" ? daysInMonth(month)! / 7 : 1;
}
export function groupCostV3(input: QuizLabor, group: QuizGroup): CostInput {
  const shifts = shiftCount(input.month, group.schedule, group.actualShifts)!;
  return { tasks: input.tasks, employees: group.employees, systems: [], impact: "unknown", processes: Object.fromEntries(input.tasks.map(task => {
    const measure = group.measures[task]!;
    const known = measure.repetitions !== null && (measure.minutes !== null || measure.repetitions === 0);
    return [task, { timing: known ? { employees: group.employees, frequency: measure.frequency === "shift" ? "day" : measure.frequency, repetitions: measure.repetitions!, minutes: measure.minutes ?? 0, periodsPerMonth: periodFactor(input.month, measure.frequency, shifts), periodAssumption: measure.frequency !== "month" && (measure.frequency === "week" || group.actualShifts === null) } : null, cost: group.pay.kind === "unknown" ? { kind: "unknown" } : { kind: "monthly", monthly: group.pay.amount, hours: shifts * group.shiftHours, hoursAssumption: group.actualShifts === null }, independent: input.independent.includes(task) }];
  })) };
}
export function parseQuizLabor(raw: unknown): QuizLabor | null {
  const s = record(raw);
  if (!s || !exactKeys(s, ["tasks", "month", "groups", "groupsDistinct", "independent"]) || !tasksOK(s.tasks) || typeof s.month !== "string" || !daysInMonth(s.month) || typeof s.groupsDistinct !== "boolean" || !Array.isArray(s.groups) || s.groups.length < 1 || s.groups.length > 3 || (s.groups.length > 1 && !s.groupsDistinct) || !Array.isArray(s.independent) || new Set(s.independent).size !== s.independent.length || !s.independent.every(t => (s.tasks as Task[]).includes(t))) return null;
  const groups: QuizGroup[] = [];
  for (const item of s.groups) {
    const g = record(item), pay = record(g?.pay), measures = record(g?.measures);
    if (!g || !exactKeys(g, ["id", "employees", "schedule", "actualShifts", "shiftHours", "pay", "measures"]) || !["g1", "g2", "g3"].includes(String(g.id)) || groups.some(row => row.id === g.id) || !numberField(g.employees, 1, 10000, true) || !schedules.includes(g.schedule as Schedule) || !(g.actualShifts === null || numberField(g.actualShifts, 1, daysInMonth(s.month)!, true)) || shiftCount(s.month, g.schedule as Schedule, g.actualShifts as number | null) === null || !numberField(g.shiftHours, 0.25, 24) || !pay || !measures || !exactKeys(measures, s.tasks)) return null;
    let cleanPay: Pay;
    if (pay.kind === "unknown" && exactKeys(pay, ["kind"])) cleanPay = { kind: "unknown" };
    else if (["salary", "employer"].includes(String(pay.kind)) && exactKeys(pay, ["kind", "amount"]) && numberField(pay.amount, 0, 10_000_000)) cleanPay = { kind: pay.kind as "salary" | "employer", amount: pay.amount as number };
    else return null;
    const cleanMeasures: QuizGroup["measures"] = {};
    for (const task of s.tasks) {
      const m = record(measures[task]);
      if (!m || !exactKeys(m, ["frequency", "repetitions", "minutes"]) || !["shift", "week", "month"].includes(String(m.frequency)) || !(m.repetitions === null || numberField(m.repetitions, 0, 100000, true)) || !(m.minutes === null || numberField(m.minutes, 0, 10080)) || (m.repetitions === null && m.minutes !== null)) return null;
      cleanMeasures[task] = { frequency: m.frequency as Measure["frequency"], repetitions: m.repetitions as number | null, minutes: m.minutes as number | null };
    }
    groups.push({ id: g.id as QuizGroup["id"], employees: g.employees as number, schedule: g.schedule as Schedule, actualShifts: g.actualShifts as number | null, shiftHours: g.shiftHours as number, pay: cleanPay, measures: cleanMeasures });
  }
  if (groups.reduce((sum, g) => sum + g.employees, 0) > 10000) return null;
  const input: QuizLabor = { tasks: [...s.tasks], month: s.month, groups, groupsDistinct: s.groupsDistinct, independent: [...s.independent] as Task[] };
  for (const g of groups) if (!parseCostInput(groupCostV3(input, g))) return null;
  return input;
}
export function parseKnownCost(raw: unknown): KnownCost | null {
  const s = record(raw);
  if (!s || !exactKeys(s, ["kind", "input"])) return null;
  if (s.kind === "v4") { const input = parseQuizLabor(s.input); return input ? { kind: "v4", input } : null; }
  if (s.kind === "v3") { const input = parseCostInput(s.input); return input ? { kind: "v3", input } : null; }
  return null;
}
export function parseQuizDiagnosis(raw: unknown): QuizDiagnosis | null {
  const s = record(raw);
  if (!s || !exactKeys(s, ["tasks", "obstacle", "frequency", "consequence", "known"]) || !tasksOK(s.tasks) || !Object.hasOwn(obstacles, String(s.obstacle)) || ![...Object.keys(issueFrequencies), "measured"].includes(String(s.frequency)) || !Object.hasOwn(consequences, String(s.consequence))) return null;
  const known = s.known === null ? null : parseKnownCost(s.known);
  if (s.known !== null && !known) return null;
  if (known && (known.input.tasks.length !== s.tasks.length || !known.input.tasks.every(t => (s.tasks as Task[]).includes(t)))) return null;
  if (s.frequency === "measured" && (s.obstacle !== "time" || !known || !knownHasTime(known))) return null;
  if (s.obstacle === "unclear" && (s.frequency !== "unknown" || s.consequence !== "unknown")) return null;
  return { tasks: [...s.tasks], obstacle: s.obstacle as QuizDiagnosis["obstacle"], frequency: s.frequency as QuizDiagnosis["frequency"], consequence: s.consequence as QuizDiagnosis["consequence"], known };
}
export function parseQuizInput(raw: unknown): QuizInput | null {
  const s = record(raw);
  if (!s || !exactKeys(s, ["kind", "data"])) return null;
  if (s.kind === "labor") { const data = parseQuizLabor(s.data); return data ? { kind: "labor", data } : null; }
  if (s.kind === "diagnosis") { const data = parseQuizDiagnosis(s.data); return data ? { kind: "diagnosis", data } : null; }
  return null;
}
export function knownHasTime(known: KnownCost): boolean {
  return known.kind === "v3" ? known.input.tasks.every(t => Boolean(known.input.processes[t]?.timing)) : known.input.groups.every(g => known.input.tasks.every(t => g.measures[t]?.repetitions !== null && (g.measures[t]?.minutes !== null || g.measures[t]?.repetitions === 0)));
}
export function calculateQuizLabor(raw: QuizLabor) {
  const input = parseQuizLabor(raw);
  if (!input) throw new RangeError("Некорректный расчёт v4");
  const groups = input.groups.map(g => {
    const v3 = calculateCostWhy(groupCostV3(input, g)), shifts = shiftCount(input.month, g.schedule, g.actualShifts)!, paidHours = shifts * g.shiftHours, rate = g.pay.kind === "unknown" ? null : g.pay.amount / paidHours;
    const rows = v3.rows.map(row => {
      const m = g.measures[row.task]!, rawHours = m.repetitions === null || (m.minutes === null && m.repetitions !== 0) ? null : g.employees * m.repetitions * (m.minutes ?? 0) / 60 * periodFactor(input.month, m.frequency, shifts);
      return { ...row, rawHours, rawCost: rawHours === null || rate === null ? null : rawHours * rate, overSchedule: rawHours !== null && rawHours / g.employees > paidHours + 0.000001 };
    });
    const measured = rows.every(r => r.rawHours !== null), overSchedule = measured && rows.reduce((sum, r) => sum + r.rawHours!, 0) / g.employees > paidHours + 0.000001;
    return { ...g, shifts, paidHours, rate, rows, overSchedule };
  });
  const kinds = new Set(groups.map(g => g.pay.kind));
  const basis = kinds.has("unknown") ? "unknown" : kinds.size === 1 ? groups[0].pay.kind : "mixed";
  const rows = input.tasks.map(task => {
    const parts = groups.map(g => g.rows.find(r => r.task === task)!);
    const complete = parts.every(p => p.rawHours !== null), costComplete = parts.every(p => p.rawCost !== null) && basis !== "mixed";
    const cost = costComplete ? round2(parts.reduce((sum, p) => sum + p.rawCost!, 0)) : null;
    return { task, hours: complete ? round2(parts.reduce((sum, p) => sum + p.rawHours!, 0)) : null, cost, annualCost: cost === null ? null : round2(cost * 12), warning: parts.some(p => p.warning || p.overSchedule), complete, basis };
  });
  const canSum = rows.every(r => r.complete && !r.warning) && (input.tasks.length === 1 || input.tasks.every(t => input.independent.includes(t))) && !groups.some(g => g.overSchedule) && rows.reduce((s, r) => s + (r.cost ?? 0), 0) <= 1e12;
  const totalHours = canSum ? round2(rows.reduce((sum, r) => sum + r.hours!, 0)) : null;
  const totalCost = canSum && rows.every(r => r.cost !== null) ? round2(rows.reduce((sum, r) => sum + r.cost!, 0)) : null;
  return { groups, rows, basis, canSum, totalHours, totalCost, totalAnnualCost: totalCost === null ? null : round2(totalCost * 12), cashSavings: null, freedHours: null };
}
