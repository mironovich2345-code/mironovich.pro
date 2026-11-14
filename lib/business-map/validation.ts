import { record, numberField, type Parsed } from "../tools/input.ts";
import { businessMapModel, type BusinessMapModel } from "../../config/business-map-model.ts";
import { dec } from "./decimal.ts";
import type { BusinessMapInput, Company, Process, Range } from "./contracts.ts";

export const processChoices = {
  period: ["day", "week", "month"], source: ["measured", "estimate", "unknown"],
  mechanical: ["under25", "from25to50", "from50to75", "over75", "unknown"],
  regulation: ["yes", "partial", "no", "unknown"], exceptions: ["under10", "from10to30", "from30to50", "over50", "unknown"],
  error: ["minor", "noticeable", "serious", "critical", "unknown"], judgment: ["rare", "sometimes", "mostly", "unknown"], access: ["available", "manual", "unknown"], personalData: ["yes", "no", "unknown"],
} as const;
const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const strings = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && v.every(x => text(x, 80)) && new Set(v).size === v.length;
const range = (v: unknown, min: number, max: number): v is Range => Array.isArray(v) && v.length === 2 && v.every(x => numberField(x, min, max)) && v[0] <= v[1];
export function parseBusinessMap(raw: unknown, model: BusinessMapModel = businessMapModel): Parsed<BusinessMapInput> {
  const s = record(raw), c = record(s?.company), errors: Record<string, string> = {}, limit = model.limits;
  if (!s || !c || !Array.isArray(s.processes)) return { ok: false, errors: { form: "Нужны компания и список процессов." } };
  const fail = (key: string, message = "Проверьте значение поля.") => { errors[key] = message; };
  if (!text(c.industry, 80)) fail("company.industry");
  if (!["1-10", "11-50", "51-100", "101-250", "over250"].includes(String(c.headcount))) fail("company.headcount");
  if (!["cost", "speed", "errors", "growth"].includes(String(c.goal))) fail("company.goal");
  if (!strings(c.systems, 20) || !(c.systems as unknown[])?.length) fail("company.systems");
  for (const [key, min, max] of [["salary", 0, limit.money], ["salaryLoad", ...limit.salaryLoad], ["monthlyHours", ...limit.monthlyHours]] as const) {
    if (c[key] !== undefined && !(key === "salary" && c[key] === null) && !numberField(c[key], min, max)) fail(`company.${key}`);
  }
  const company = Object.fromEntries(["industry", "headcount", "goal", "systems", "salary", "salaryLoad", "monthlyHours"].filter(k => c[k] !== undefined).map(k => [k, c[k]])) as Company;
  if (!s.processes.length || s.processes.length > limit.processes) fail("processes", `Нужно от 1 до ${limit.processes} процессов.`);
  const processes: Process[] = [];
  for (const [index, item] of s.processes.entries()) {
    const p = record(item), prefix = `processes.${index}.`;
    if (!p) { fail(prefix + "form"); continue; }
    if (!text(p.id, 80)) fail(prefix + "id");
    if (!text(p.name, 80)) fail(prefix + "name");
    if (p.description !== undefined && (typeof p.description !== "string" || p.description.length > 300)) fail(prefix + "description");
    for (const [k, options] of Object.entries(processChoices)) if (!(options as readonly unknown[]).includes(p[k])) fail(prefix + k);
    for (const [k, min, max, integer] of [["employees", 1, limit.employees, true], ["operations", 0, limit.monthlyOperations, false], ["minutes", ...limit.minutes, false]] as const) {
      if (p[k] !== null && !numberField(p[k], min, max, integer)) fail(prefix + k, `Введите число от ${min} до ${max} или null, если оно неизвестно.`);
    }
    if (p.systems !== null && (!strings(p.systems, 20) || !(p.systems as unknown[])?.length)) fail(prefix + "systems");
    if (typeof p.independent !== "boolean") fail(prefix + "independent");
    if (!strings(p.overlapsWith, limit.processes)) fail(prefix + "overlapsWith");
    for (const [key, max] of [["hourlyRate", limit.hourlyRate], ["capacityRevenue", limit.money]] as const) if (p[key] !== undefined && p[key] !== null && !numberField(p[key], 0, max)) fail(prefix + key);
    if (p.rateSource !== undefined && !["user-hourly", "calculator-salary", "calculator-employer"].includes(String(p.rateSource))) fail(prefix + "rateSource");
    if (p.monthlyHours !== undefined && !numberField(p.monthlyHours, ...limit.monthlyHours)) fail(prefix + "monthlyHours");
    if (p.periodsPerMonth !== undefined && !numberField(p.periodsPerMonth, 0.000001, 31)) fail(prefix + "periodsPerMonth");
    if (p.minutesRange !== undefined && (!range(p.minutesRange, ...limit.minutes) || (typeof p.minutes === "number" && (p.minutes < p.minutesRange[0] || p.minutes > p.minutesRange[1])))) fail(prefix + "minutesRange");
    if (typeof p.operations === "number" && !errors[prefix + "operations"] && (processChoices.period as readonly unknown[]).includes(p.period) && !errors[prefix + "periodsPerMonth"]) {
      const factor = model.periods[p.period as Process["period"]];
      const n = dec(p.operations).mul(p.periodsPerMonth === undefined ? dec(factor[0]).div(factor[1]) : dec(p.periodsPerMonth as number));
      if (n.cmp(limit.monthlyOperations) > 0) fail(prefix + "operations", `Общий объём команды не больше ${limit.monthlyOperations} операций в месяц.`);
    }
    const keys = ["id", "name", "description", "employees", "operations", "period", "minutes", "source", "mechanical", "systems", "regulation", "exceptions", "error", "judgment", "access", "personalData", "hourlyRate", "minutesRange", "periodsPerMonth", "monthlyHours", "rateSource", "independent", "overlapsWith", "capacityRevenue"];
    const clean = Object.fromEntries(keys.filter(k => p[k] !== undefined).map(k => [k, p[k]])) as Process;
    if (p.cash !== undefined) {
      const cash = record(p.cash);
      if (!cash || !["retained", "avoid-hire", "reduce-contractor"].includes(String(cash.disposition)) || !numberField(cash.replaceableHours, 0, limit.money) || !numberField(cash.replacementRate, 0, limit.hourlyRate) || !numberField(cash.cancelledPayments, 0, limit.money)) fail(prefix + "cash");
      else clean.cash = { disposition: cash.disposition as NonNullable<Process["cash"]>["disposition"], replaceableHours: cash.replaceableHours as number, replacementRate: cash.replacementRate as number, cancelledPayments: cash.cancelledPayments as number };
    }
    if (p.costs !== undefined) {
      const costs = record(p.costs), entries = ["implementation", "training", "licenses", "maintenance", "external"];
      if (!costs || !entries.every(k => costs[k] === undefined || range(costs[k], 0, limit.money))) fail(prefix + "costs", "Введите статьи затрат диапазонами; известное отсутствие затрат обозначьте [0, 0].");
      else clean.costs = Object.fromEntries(entries.filter(k => costs[k] !== undefined).map(k => [k, costs[k]])) as Process["costs"];
    }
    processes.push(clean);
  }
  const ids = processes.map(p => p.id);
  if (new Set(ids).size !== ids.length) fail("processes.ids", "Идентификаторы процессов должны различаться.");
  for (const [i, p] of processes.entries()) if (Array.isArray(p.overlapsWith) && p.overlapsWith.some(id => id === p.id || !ids.includes(id))) fail(`processes.${i}.overlapsWith`);
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { company, processes } };
}
