import { numberField, record, round2 } from "./input.ts";

export const GUIDED_VERSION = "tools-2.0.0";
export const DEFAULT_EMPLOYEES = 4;
export const EMPLOYEE_PRESETS = [4, 10, 25, 50] as const;
export const taskLabels = {
  reporting: "Отчёты и таблицы", transfer: "Перенос данных", crm: "Заявки и CRM",
  documents: "Документы и счета", answers: "Ответы клиентам", training: "Обучение сотрудников",
  control: "Контроль задач", calls: "Анализ звонков", other: "Другая задача",
} as const;
export type Task = keyof typeof taskLabels;
export const systems = { crm: "CRM", tables: "Excel или Google Таблицы", accounting: "1С или другая учётная программа", messages: "Мессенджеры", several: "Несколько систем", none: "Пока ничего нет", unknown: "Не знаю" } as const;
export type System = keyof typeof systems;
export const impacts = { unknown: "Пока не знаю", low: "Ошибку легко исправить", client: "Пострадает клиент", financial: "Возможны финансовые или юридические последствия" } as const;
export type Measurement = { employees: number; frequency: "day" | "week" | "month"; repetitions: number; minutes: number; periodsPerMonth: number; hourlyCost: number | null; independent: boolean };
export type GuidedInput = { tasks: Task[]; employees: number; systems: System[]; impact: keyof typeof impacts; measurements: Partial<Record<Task, Measurement>> };
export const initialGuided = (): GuidedInput => ({ tasks: [], employees: DEFAULT_EMPLOYEES, systems: [], impact: "unknown", measurements: {} });
const known = (o: object, k: unknown): k is string => typeof k === "string" && Object.hasOwn(o, k);
export function parseGuided(raw: unknown): GuidedInput | null {
  const s = record(raw);
  if (!s || !Array.isArray(s.tasks) || !s.tasks.length || s.tasks.length > 9 || new Set(s.tasks).size !== s.tasks.length || !s.tasks.every(t => known(taskLabels,t))) return null;
  if (!numberField(s.employees,1,10000,true) || !Array.isArray(s.systems) || s.systems.length > 7 || new Set(s.systems).size !== s.systems.length || !s.systems.every(t => known(systems,t)) || !known(impacts,s.impact)) return null;
  if ((s.systems.includes("none") || s.systems.includes("unknown")) && s.systems.length !== 1) return null;
  const measurements = record(s.measurements);
  if (!measurements || Object.keys(measurements).some(k => !(s.tasks as unknown[]).includes(k))) return null;
  const cleaned: GuidedInput["measurements"] = {};
  for (const [key, rawMeasure] of Object.entries(measurements)) {
    const m = record(rawMeasure);
    if (!m || !numberField(m.employees,1,s.employees as number,true) || !["day","week","month"].includes(String(m.frequency)) || !numberField(m.repetitions,0,100000,true) || !numberField(m.minutes,0,10080) || !numberField(m.periodsPerMonth,1,m.frequency === "day" ? 31 : m.frequency === "week" ? 6 : 1) || (m.hourlyCost !== null && !numberField(m.hourlyCost,0,1000000)) || typeof m.independent !== "boolean") return null;
    const hours = (m.employees as number)*(m.repetitions as number)*(m.minutes as number)*(m.periodsPerMonth as number)/60;
    if (hours/(m.employees as number)>744 || hours * ((m.hourlyCost as number) ?? 0)>1e12) return null;
    cleaned[key as Task] = { employees: m.employees as number, frequency: m.frequency as Measurement["frequency"], repetitions:m.repetitions as number, minutes:m.minutes as number, periodsPerMonth:m.periodsPerMonth as number, hourlyCost:m.hourlyCost as number|null, independent:m.independent };
  }
  return { tasks:[...s.tasks] as Task[], employees:s.employees as number, systems:[...s.systems] as System[], impact:s.impact as GuidedInput["impact"], measurements:cleaned };
}
export function calculateGuided(input: GuidedInput) {
  const clean = parseGuided(input);
  if (!clean) throw new RangeError("Некорректные параметры процессов");
  const rows=clean.tasks.map(task=>{
    const m=clean.measurements[task];
    if (!m) return { task, hours:null, cost:null, warning:false, independent:false };
    const rawHours=m.employees*m.repetitions*m.minutes*m.periodsPerMonth/60;
    return { task, hours:round2(rawHours), cost:m.hourlyCost===null?null:round2(rawHours*m.hourlyCost), warning:rawHours/m.employees>200, independent:m.independent };
  });
  const measured=rows.filter(r=>r.hours!==null);
  // An attestation is necessary but not sufficient: conservative shared-team capacity check.
  const overCapacity=measured.reduce((sum,r)=>sum+(r.hours??0),0)/clean.employees>200;
  const canSum=measured.length>0 && measured.every(r=>r.independent&&!r.warning) && !overCapacity;
  return { rows, overCapacity, counted:measured.length, totalHours:canSum?round2(measured.reduce((s,r)=>s+(r.hours??0),0)):null, totalCost:canSum&&measured.every(r=>r.cost!==null)?round2(measured.reduce((s,r)=>s+(r.cost??0),0)):null, freedHours:null, cashSavings:null };
}
