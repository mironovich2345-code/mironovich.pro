import { businessMapModel as model } from "../../config/business-map-model.ts";
import { dec, hours, timeCost } from "./decimal.ts";
import { quantity } from "./calculate.ts";
import type { QuickInsight, Workload } from "./dialog/contracts.ts";
import type { IndustryScenario } from "./dialog/industry.ts";
/** Early H/C uses the existing exact core primitives, without a fictional Company contract. */
export function calculateQuickInsight(
  input: Workload,
  scenario: IndustryScenario,
  monthlyHours: number = model.monthlyHours,
): QuickInsight {
  const missing: string[] = [],
    warnings: string[] = [];
  for (const [key, value, min, max, integer] of [
    ["employees", input.employees, 1, model.limits.employees, true],
    ["operations", input.operations, 0, model.limits.monthlyOperations, false],
    ["minutes", input.minutes, ...model.limits.minutes, false],
    ["hourlyRate", input.hourlyRate, 0, model.limits.hourlyRate, false],
  ] as const) {
    if (
      value !== null &&
      (!Number.isFinite(value) ||
        value < min ||
        value > max ||
        (integer && !Number.isInteger(value)))
    )
      throw new RangeError(`Проверьте ${key}.`);
  }
  if (input.operations === null) missing.push("operations");
  if (input.period === null) missing.push("period");
  if (input.minutes === null) missing.push("minutes");
  if (input.scope === "unknown") missing.push("scope");
  if (input.scope === "per-person" && input.employees === null)
    missing.push("employees");
  let team: number | null = null,
    h = null,
    c = null;
  if (
    input.operations !== null &&
    input.scope !== "unknown" &&
    (input.scope === "team" || input.employees !== null)
  ) {
    const exactTeam = dec(input.operations).mul(
      input.scope === "per-person" ? input.employees! : 1,
    );
    team = exactTeam.number();
    if (input.period) {
      const factor = dec(model.periods[input.period][0]).div(
        model.periods[input.period][1],
      );
      if (exactTeam.mul(factor).cmp(model.limits.monthlyOperations) > 0)
        throw new RangeError(
          "Объём команды больше 10 000 операций в месяц. Уточните границы процесса.",
        );
      if (input.minutes !== null) {
        const value = hours(exactTeam, dec(input.minutes), factor);
        h = quantity(value, model.display.hoursStep);
        if (input.hourlyRate !== null) {
          const cost = timeCost(value, dec(input.hourlyRate));
          c = quantity(
            cost,
            cost.cmp(model.display.largeRublesFrom) >= 0
              ? model.display.largeRublesStep
              : model.display.rublesStep,
          );
        }
        if (
          input.employees !== null &&
          value.cmp(dec(monthlyHours).mul(input.employees)) > 0
        )
          warnings.push("W-CAPACITY");
      }
    }
  }
  return {
    hours: h,
    timeCost: c,
    teamOperations: team,
    missing,
    warnings,
    firstAction: scenario.firstAction,
    solution: scenario.solutions[0],
    kind: h ? "user-data" : "early-hypothesis",
  };
}
