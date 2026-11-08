import { parseDecimal } from "./input.ts";
import { parseCostInput, type CostInput, type CostProcess, type CostBasis } from "./cost-why.ts";
import type { GuidedInput, Task } from "./guided.ts";

export type CostDraft = { employees: string; allTeam: boolean; frequency: "day" | "week" | "month"; repetitions: string; minutes: string; periods: string; periodAssumption: boolean; costMode: "hourly" | "monthly" | "unknown"; hourly: string; monthly: string; paidHours: string; hoursAssumption: boolean; independent: boolean };
export const emptyCostDraft = (employees: string): CostDraft => ({ employees, allTeam: true, frequency: "day", repetitions: "", minutes: "", periods: "22", periodAssumption: true, costMode: "hourly", hourly: "", monthly: "", paidHours: "160", hoursAssumption: true, independent: false });
export function costDrafts(input: CostInput): Partial<Record<Task, CostDraft>> {
  return Object.fromEntries(input.tasks.map(task => {
    const p = input.processes[task]!, t = p.timing, c = p.cost;
    return [task, { ...emptyCostDraft(String(input.employees)), ...(t ? { employees: String(t.employees), allTeam: false, frequency: t.frequency, repetitions: String(t.repetitions), minutes: String(t.minutes), periods: String(t.periodsPerMonth), periodAssumption: t.periodAssumption } : {}), costMode: c.kind, ...(c.kind === "hourly" ? { hourly: String(c.hourly) } : c.kind === "monthly" ? { monthly: String(c.monthly), paidHours: String(c.hours), hoursAssumption: c.hoursAssumption } : {}), independent: p.independent }];
  }));
}
export function buildCostDraft({ tasks, employees, systems, impact, drafts }: { tasks: Task[]; employees: string; systems: GuidedInput["systems"]; impact: GuidedInput["impact"]; drafts: Partial<Record<Task, CostDraft>> }): { input: CostInput | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {}, processes: CostInput["processes"] = {};
  if (!tasks.length) errors.tasks = "Выберите хотя бы один процесс.";
  const team = parseDecimal(employees);
  if (!Number.isInteger(team) || team < 1 || team > 10000) errors["cost-team"] = "Укажите размер команды от 1 до 10 000.";
  for (const task of tasks) {
    const d = drafts[task] ?? emptyCostDraft(employees), prefix = `cost-${task}-`;
    let cost: CostBasis = { kind: "unknown" };
    if (d.costMode === "hourly" && d.hourly !== "") {
      const hourly = parseDecimal(d.hourly);
      if (!Number.isFinite(hourly) || hourly < 0 || hourly > 1_000_000) errors[prefix + "hourly"] = "Проверьте стоимость часа: от 0 до 1 000 000 ₽.";
      else cost = { kind: "hourly", hourly };
    }
    if (d.costMode === "monthly" && d.monthly !== "") {
      const monthly = parseDecimal(d.monthly), hours = parseDecimal(d.paidHours);
      if (!Number.isFinite(monthly) || monthly < 0 || monthly > 10_000_000) errors[prefix + "monthly"] = "Укажите вашу полную месячную стоимость сотрудника.";
      if (!Number.isFinite(hours) || hours < 1 || hours > 744) errors[prefix + "paidHours"] = "Укажите отработанные часы в месяц: от 1 до 744.";
      cost = { kind: "monthly", monthly, hours, hoursAssumption: d.hoursAssumption };
    }
    let timing: CostProcess["timing"] = null;
    if (d.repetitions !== "" || d.minutes !== "") {
      const participants = parseDecimal(d.employees), repetitions = parseDecimal(d.repetitions), minutes = parseDecimal(d.minutes), periodsPerMonth = d.frequency === "month" ? 1 : parseDecimal(d.periods);
      if (!Number.isInteger(participants) || participants < 1 || participants > team) errors[prefix + "employees"] = "Участников не может быть больше команды; минимум один человек.";
      if (!Number.isInteger(repetitions) || repetitions < 0 || repetitions > 100000) errors[prefix + "repetitions"] = "Укажите число повторений на одного сотрудника за выбранный период.";
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 10080) errors[prefix + "minutes"] = "Укажите минуты на одно выполнение: от 0 до 10 080.";
      if (!Number.isFinite(periodsPerMonth) || periodsPerMonth < 1 || periodsPerMonth > (d.frequency === "day" ? 31 : d.frequency === "week" ? 6 : 1)) errors[prefix + "periods"] = "Проверьте рабочие дни или недели в месяце.";
      timing = { employees: participants, repetitions, minutes, frequency: d.frequency, periodsPerMonth, periodAssumption: d.frequency !== "month" && d.periodAssumption };
      if (Number.isFinite(repetitions * minutes * periodsPerMonth) && repetitions * minutes * periodsPerMonth / 60 > 744) errors[prefix + "minutes"] = "Получилось более 744 часов на участника в месяц. Проверьте единицы и частоту.";
    }
    processes[task] = { timing, cost, independent: d.independent };
  }
  if (Object.keys(errors).length) return { input: null, errors };
  const input = parseCostInput({ tasks, employees: team, systems, impact, processes });
  return input ? { input, errors } : { input: null, errors: { tasks: "Проверьте исходные данные: слишком большая ставка или объём работы." } };
}
