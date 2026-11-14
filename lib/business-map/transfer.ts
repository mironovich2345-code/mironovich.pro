import { businessMapModel } from "../../config/business-map-model.ts";
import { parseToolContext } from "../tools/context.ts";
import { groupCostV3, shiftCount } from "../tools/quiz-model.ts";
import { taskLabels } from "../tools/guided.ts";
import type { Task } from "../tools/guided.ts";
import type { CostInput } from "../tools/cost-why.ts";
import type { Process } from "./contracts.ts";
import { calculateBusinessMap } from "./calculate.ts";

const empty = (id: string, name: string): Process => ({ id, name, employees: null, operations: null, period: "month", minutes: null, source: "estimate", mechanical: "unknown", systems: null, regulation: "unknown", exceptions: "unknown", error: "unknown", judgment: "unknown", access: "unknown", personalData: "unknown", independent: false, overlapsWith: [] });
function fromV3(input: CostInput, groupId = "v3"): Process[] {
  return input.tasks.map((task: Task) => {
    const row = input.processes[task]!, t = row.timing;
    return { ...empty(`${groupId}-${task}`, taskLabels[task]), ...(t ? { employees: t.employees, operations: t.employees * t.repetitions, period: t.frequency, periodsPerMonth: t.periodsPerMonth, minutes: t.minutes } : {}), ...(row.cost.kind === "monthly" ? { monthlyHours: row.cost.hours } : {}), hourlyRate: row.cost.kind === "hourly" ? row.cost.hourly : row.cost.kind === "monthly" ? row.cost.monthly / row.cost.hours : null, rateSource: "user-hourly" as const, independent: row.independent };
  });
}
/** Pure import boundary: accepts validated original inputs, NEVER client result totals.
 * No cookies, database, identity or entitlement are implemented at this stage.
 * Multi-group v4 rows stay separate: averaging unlike rates/durations would fabricate facts.
 */
export function transferCalculator(raw: unknown): { processes: Process[]; warnings: string[] } {
  const context = parseToolContext(raw);
  if (!context) throw new RangeError("Не удалось проверить исходные параметры калькулятора.");
  let processes: Process[];
  const warnings: string[] = [];
  if ("quiz" in context) {
    const known = context.input.kind === "labor" ? { kind: "v4" as const, input: context.input.data } : context.input.data.known;
    if (!known) throw new RangeError("В диагностике нет исходных числовых данных.");
    if (known.kind === "v3") processes = fromV3(known.input);
    else {
      warnings.push("Сохранены график и ставки калькулятора; 165 часов и коэффициент 1,3 повторно не применяются.");
      processes = known.input.groups.flatMap(g => fromV3(groupCostV3(known.input, g), g.id).map(p => ({ ...p, monthlyHours: shiftCount(known.input.month, g.schedule, g.actualShifts)! * g.shiftHours, rateSource: g.pay.kind === "salary" ? "calculator-salary" as const : g.pay.kind === "employer" ? "calculator-employer" as const : "user-hourly" as const })));
      // Revalidate source calendar rather than trust a client rate or shift count.
      known.input.groups.forEach(g => { if (shiftCount(known.input.month, g.schedule, g.actualShifts) === null) throw new RangeError("Неизвестный график"); });
    }
  } else if ("costReview" in context) processes = fromV3(context.input);
  else if ("guided" in context) throw new RangeError("Для v2 сначала уточните данные в калькуляторе v3/v4.");
  else {
    const labor = context.tool === "labor-cost" ? context.input : context.labor;
    if (!labor) throw new RangeError("Нет исходных данных о времени.");
    processes = [{ ...empty("labor-import", "Повторяющаяся работа"), employees: labor.employees, operations: labor.employees * labor.operationsPerDay, period: "day", periodsPerMonth: labor.workingDays, minutes: labor.minutesPerOperation, hourlyRate: labor.hourlyCost, rateSource: "user-hourly", independent: true }];
    warnings.push("Процент автоматизации из бесплатного калькулятора не переносится.");
  }
  if (processes.some(p => p.rateSource === "calculator-salary")) warnings.push("Зарплатная ставка v4 сохранена без начислений. Для полной стоимости работодателя уточните ставку; автоматический коэффициент 1,3 не добавлен.");
  if (processes.length > businessMapModel.limits.processes) throw new RangeError("Выберите не более пяти процессов для переноса.");
  // Narrower paid-product constraints are checked before returning anything.
  try { calculateBusinessMap({ company: { industry: "other", headcount: "1-10", goal: "cost", systems: ["other"] }, processes }); }
  catch (error) { throw new RangeError(`Исходные параметры выходят за ограничения Карты: ${error instanceof Error ? error.message : "проверьте данные"}`); }
  return { processes, warnings };
}
