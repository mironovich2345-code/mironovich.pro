import { COST_VERSION, parseCostInput, type CostInput } from "./cost-why.ts";
import { record } from "./input.ts";
export const COST_STORAGE_KEY = "mrnv_tools_cost_v3";
export function encodeCostTransfer(input: CostInput, now = Date.now()): string {
  const clean = parseCostInput({ tasks: input.tasks, employees: input.employees, systems: input.systems, impact: input.impact, processes: input.processes });
  if (!clean) throw new RangeError("Invalid cost transfer");
  return JSON.stringify({ version: COST_VERSION, savedAt: now, input: clean });
}
export function decodeCostTransfer(raw: string | null, now = Date.now()): CostInput | null {
  if (!raw || raw.length > 12000) return null;
  try {
    const o = record(JSON.parse(raw));
    return o && o.version === COST_VERSION && typeof o.savedAt === "number" && Number.isFinite(o.savedAt) && o.savedAt <= now && now - o.savedAt <= 86400000 ? parseCostInput(o.input) : null;
  } catch { return null; }
}
/** Import old measurements without inventing their source or changing the v2 contract. */
export function guidedToCost(input: import("./guided.ts").GuidedInput): CostInput {
  return { tasks: input.tasks, employees: input.employees, systems: input.systems, impact: input.impact, processes: Object.fromEntries(input.tasks.map(task => {
    const m = input.measurements[task];
    return [task, { timing: m ? { employees: m.employees, frequency: m.frequency, repetitions: m.repetitions, minutes: m.minutes, periodsPerMonth: m.periodsPerMonth, periodAssumption: false } : null, cost: m && m.hourlyCost !== null ? { kind: "hourly", hourly: m.hourlyCost } : { kind: "unknown" }, independent: m?.independent ?? false }];
  })) };
}
