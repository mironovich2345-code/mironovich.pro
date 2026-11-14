import { businessMapModel, type BusinessMapModel } from "../../config/business-map-model.ts";
import { dec, Decimal, hours, timeCost } from "./decimal.ts";
import { parseBusinessMap } from "./validation.ts";
import type { Band, BusinessMapInput, BusinessMapResult, Company, Group, Process, ProcessResult, Quantity, Scenario } from "./contracts.ts";

const levels: Band[] = ["low", "medium", "high"];
const level = (score: number, thresholds: readonly number[]): Band => levels[score < thresholds[0] ? 0 : score < thresholds[1] ? 1 : 2];
export const quantity = (n: Decimal, step: number): Quantity => {
  const value = n.number(), display = n.round(step);
  if (!Number.isFinite(value) || !Number.isFinite(display)) throw new RangeError("Совокупный результат слишком велик для числового представления. Проверьте частоту, ставки и затраты.");
  return { value, exact: n.exact(), display };
};
const fromQuantity = (q: Quantity) => { const [n, d] = q.exact.split("/"); return new Decimal(BigInt(n), BigInt(d)); };

/** Trusted versioned configuration, checked before use. Input data never supplies configuration. */
export function validateModel(m: BusinessMapModel): void {
  const walk = (x: unknown): void => {
    if (typeof x === "number" && (!Number.isFinite(x) || x < 0)) throw new RangeError("Некорректная конфигурация модели");
    if (x && typeof x === "object") Object.values(x).forEach(walk);
  };
  walk(m);
  if (!m.version || m.monthlyHours <= 0 || m.salaryLoad <= 0 || Object.values(m.display).some(v => v <= 0) || Object.values(m.periods).some(v => v[0] <= 0 || v[1] <= 0)) throw new RangeError("Некорректная конфигурация модели");
  for (const bucket of [...Object.values(m.mechanical), ...Object.values(m.exceptions)]) if (bucket.length !== 3 || bucket.some(v => v > 1) || bucket[0] > bucket[1] || bucket[1] > bucket[2]) throw new RangeError("Некорректные доли сценариев");
  if (m.durationRangeSelection.length !== 3 || m.durationRangeSelection.some(v => !["lower", "point", "upper"].includes(v))) throw new RangeError("Некорректные границы длительности");
  if (m.review.some(v => v > 1) || m.review[0] < m.review[1] || m.review[1] < m.review[2]) throw new RangeError("Некорректная доля контроля");
  for (const thresholds of [m.valueFTE, m.complexity.thresholds, m.risk.thresholds]) if (thresholds[0] >= thresholds[1]) throw new RangeError("Некорректные пороги");
}
function calculateProcess(p: Process, c: Company, m: BusinessMapModel): ProcessResult {
  const display = m.display;
  const money = (n: Decimal) => quantity(n, n.cmp(display.largeRublesFrom) >= 0 ? display.largeRublesStep : display.rublesStep);
  const hour = (n: Decimal) => quantity(n, display.hoursStep);
  const reasons: string[] = [], missing: string[] = [], flags: string[] = [];
  const unknown = (["employees", "operations", "minutes", "mechanical", "systems", "regulation", "exceptions", "error", "judgment", "access", "personalData"] as const).filter(k => p[k] === "unknown" || p[k] === null);
  missing.push(...unknown);
  if (p.source === "unknown") missing.push("source");
  const confidence: Band = p.personalData === "unknown" ? "low" : p.source === "measured" && unknown.length <= m.confidence.measuredUnknownMax ? "high" : p.source === "estimate" && unknown.length <= m.confidence.estimatedUnknownMax ? "medium" : "low";
  const hMonthly = dec(p.monthlyHours ?? c.monthlyHours ?? m.monthlyHours);
  const factor = p.periodsPerMonth === undefined ? dec(m.periods[p.period][0]).div(m.periods[p.period][1]) : dec(p.periodsPerMonth);
  const n = p.operations === null ? null : dec(p.operations).mul(factor);
  const h = n === null || p.minutes === null ? null : hours(n, dec(p.minutes), dec(1));
  const rate = p.hourlyRate !== undefined && p.hourlyRate !== null ? dec(p.hourlyRate) : c.salary === undefined || c.salary === null ? null : dec(c.salary).mul(c.salaryLoad ?? m.salaryLoad).div(hMonthly);
  const capacity = h !== null && p.employees !== null && h.cmp(hMonthly.mul(p.employees)) > 0;
  if (capacity) flags.push("W-CAPACITY");
  if (n !== null && n.cmp(m.lowRepeatMonthly) < 0) flags.push("W-LOW-REPEAT");
  if (p.personalData !== "no") flags.push("W-LEGAL-REVIEW");
  if (p.overlapsWith.length || !p.independent) flags.push("W-OVERLAP");
  for (const k of ["employees", "operations", "minutes"] as const) if (p[k] === null) missing.push(k);
  if (rate === null) flags.push("W-MISSING-RATE");
  if (p.rateSource === "calculator-salary") flags.push("W-CALCULATOR-SALARY-NO-LOAD");
  const gates: string[] = [];
  if (p.employees === null || p.operations === null || p.minutes === null) gates.push("G1");
  if (p.mechanical === "unknown") gates.push("G2");
  if (p.exceptions === "over50") gates.push("G3");
  const digital = p.systems?.filter(s => s !== "paper" && s !== "voice").length ?? 0;
  const offline = p.systems?.some(s => s === "paper" || s === "voice") ?? false;
  if (p.systems && digital === 0) gates.push("G4");
  if (p.error === "critical") gates.push("G5");
  if (p.judgment === "mostly" && p.error === "serious") gates.push("G6");
  const complexityScore = p.systems === null || p.regulation === "unknown" || p.exceptions === "unknown" || p.exceptions === "over50" || p.judgment === "unknown" ? null
    : m.complexity.access[p.access] + m.complexity.systemCount[digital <= 1 ? 0 : digital === 2 ? 1 : 2] + (offline && digital > 0 ? m.complexity.mixedOffline : 0) + m.complexity.regulation[p.regulation] + m.complexity.exceptions[p.exceptions] + m.complexity.judgment[p.judgment];
  const riskScore = p.error === "unknown" || p.judgment === "unknown" ? null : m.risk.error[p.error] + (p.judgment === "mostly" ? m.risk.judgmentMostly : 0) + (p.personalData !== "no" ? m.risk.personalData : 0);
  const complexity = { score: complexityScore, level: complexityScore === null ? null : level(complexityScore, m.complexity.thresholds) };
  const risk = { score: riskScore, level: riskScore === null ? null : level(riskScore, m.risk.thresholds) };
  const scenarios: Scenario[] = [];
  if (h !== null && p.mechanical !== "unknown" && p.exceptions !== "unknown" && p.exceptions !== "over50") {
    const mech = m.mechanical[p.mechanical], exc = m.exceptions[p.exceptions];
    for (const [i, name] of (["conservative", "base", "optimistic"] as const).entries()) {
      // C1 affects scenario durations; base retains the stated central duration.
      const duration = m.durationRangeSelection[i];
      const minutes = p.minutesRange ? (duration === "lower" ? p.minutesRange[0] : duration === "upper" ? p.minutesRange[1] : p.minutes!) : p.minutes!;
      const hs = hours(n!, dec(minutes), dec(1));
      const freed = hs.mul(mech[i]).mul(dec(1).sub(exc[2 - i])).mul(dec(1).sub(m.review[i]));
      const cash = p.cash;
      const d = cash ? (cash.disposition === "retained" ? dec(0) : freed.min(dec(cash.replaceableHours)).mul(cash.replacementRate)).add(cash.cancelledPayments) : dec(0);
      const costIndex = (range: readonly number[]) => i === 0 ? dec(range[1]) : i === 2 ? dec(range[0]) : dec(range[0]).add(range[1]).div(2);
      const z = p.costs?.implementation && p.costs.training ? costIndex(p.costs.implementation).add(costIndex(p.costs.training)) : null;
      const o = p.costs?.licenses && p.costs.maintenance && p.costs.external ? costIndex(p.costs.licenses).add(costIndex(p.costs.maintenance)).add(costIndex(p.costs.external)) : null;
      const net = o === null ? null : d.sub(o);
      // A known negative net already proves non-recovery, even if Z is missing.
      const payback = net !== null && net.cmp(0) <= 0
        ? { status: "not-recoverable" as const, months: null, missing: [] }
        : z === null || o === null
          ? { status: "not-calculated" as const, months: null, missing: (["implementation", "training", "licenses", "maintenance", "external"] as const).filter(k => p.costs?.[k] === undefined).map(k => `costs.${k}`) }
          : { status: "calculated" as const, months: quantity(z.div(net!), display.monthsStep), missing: [] };
      scenarios.push({ name, hours: hour(hs), freedHours: hour(freed), residualHours: hour(hs.sub(freed)), fte: quantity(freed.div(hMonthly), display.fteStep), freedTimeValue: rate === null ? null : money(timeCost(freed, rate)), cashReduction: money(d), capacityRevenue: p.capacityRevenue ?? null, oneOff: z === null ? null : money(z), recurring: o === null ? null : money(o), payback });
    }
  }
  const base = scenarios[1];
  const months = scenarios.map(s => s.payback.months);
  const sortedMonths = months.length === 3 && months.every(q => q !== null) ? (months as Quantity[]).sort((a, b) => fromQuantity(a).cmp(fromQuantity(b))) : [];
  const paybackRange = sortedMonths.length ? { min: sortedMonths[0], max: sortedMonths[2] } : null;
  const value: Band | null = base ? (fromQuantity(base.fte).cmp(m.valueFTE[0]) < 0 ? "low" : fromQuantity(base.fte).cmp(m.valueFTE[1]) < 0 ? "medium" : "high") : null;
  const matrixGroup: Group | null = value !== null && complexity.level !== null ? m.matrix[value][levels.indexOf(complexity.level)] : null;
  let group: Group = matrixGroup ?? "insufficient";
  if (matrixGroup) reasons.push(`R-MATRIX-${value!.toUpperCase()}-${complexity.level!.toUpperCase()}`);
  if (group === "first" && risk.level === "high") { group = "later"; reasons.push("R-HIGH-RISK"); }
  if (group === "first" && confidence === "low") { group = "preliminary"; reasons.push("R-LOWCONF"); }
  // Unknown unscored fields never receive invented weights or an actionable priority.
  if (!matrixGroup || risk.level === null) { group = "insufficient"; reasons.push("R-MISSING-ASSESSMENT"); }
  // All applicable gates survive; safety exclusions take precedence over preparation/data gates.
  if (gates.includes("G1") || gates.includes("G2")) group = "insufficient";
  if (gates.includes("G3") || gates.includes("G4")) group = "prepare";
  if (gates.includes("G5") || gates.includes("G6")) group = "excluded";
  reasons.push(...gates.map(g => `R-${g}`));
  const suitability = group === "excluded" ? "excluded" : group === "prepare" ? "prepare" : group === "insufficient" ? "needs-data" : "eligible";
  if (confidence === "low") flags.push("W-LOW-CONFIDENCE");
  return { id: p.id, name: p.name, modelVersion: m.version, hours: h === null ? null : hour(h), hourlyRate: rate === null ? null : quantity(rate, display.hourlyRateStep), timeCost: h === null || rate === null ? null : money(timeCost(h, rate)), scenarios, value, complexity, risk, paybackRange, confidence, suitability, matrixGroup, group, reasons, missing: [...new Set(missing)], flags, longPayback: Boolean(base?.payback.months && fromQuantity(base.payback.months).cmp(m.longPaybackMonths) > 0) };
}

/** Deterministic, pure, dependency-free. Validates and discards client results before calculation. */
export function calculateBusinessMap(raw: BusinessMapInput | unknown, model: BusinessMapModel = businessMapModel): BusinessMapResult {
  validateModel(model);
  const parsed = parseBusinessMap(raw, model);
  if (!parsed.ok) throw new RangeError(JSON.stringify(parsed.errors));
  const { company, processes: inputs } = parsed.value;
  const processes = inputs.map(p => calculateProcess(p, company, model));
  const collator = new Intl.Collator(model.sortLocale, { sensitivity: "base" });
  const compareText = (a: string, b: string) => collator.compare(a, b);
  const ordered = [...processes].sort((a, b) => model.groupOrder.indexOf(a.group) - model.groupOrder.indexOf(b.group)
    || (b.scenarios[1] && a.scenarios[1] ? fromQuantity(b.scenarios[1].freedHours).cmp(fromQuantity(a.scenarios[1].freedHours)) : Number(Boolean(b.scenarios[1])) - Number(Boolean(a.scenarios[1])))
    || model.confidenceOrder.indexOf(a.confidence) - model.confidenceOrder.indexOf(b.confidence)
    || (a.complexity.score ?? Infinity) - (b.complexity.score ?? Infinity)
    || (a.risk.score ?? Infinity) - (b.risk.score ?? Infinity)
    || compareText(a.name.normalize("NFC").toLowerCase(), b.name.normalize("NFC").toLowerCase()) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ranking = ordered.filter(p => p.group !== "insufficient" && p.group !== "excluded").map(p => p.id);
  const totalBlockers: string[] = [];
  if (inputs.length > 1 && inputs.some(p => !p.independent || p.overlapsWith.length)) totalBlockers.push("OVERLAP-OR-UNCONFIRMED-INDEPENDENCE");
  if (processes.some(p => !p.hours)) totalBlockers.push("MISSING-HOURS");
  if (processes.some(p => p.flags.includes("W-CAPACITY"))) totalBlockers.push("CAPACITY-EXCEEDED");
  // Company headcount is a bucket; do not invent an aggregate capacity from it.
  const sum = (list: Quantity[]) => list.reduce((n, q) => n.add(fromQuantity(q)), dec(0));
  const mixedCostBases = new Set(inputs.map(p => p.rateSource === "calculator-salary" ? "salary-without-load" : "full-hourly")).size > 1;
  const totalCost = !mixedCostBases && processes.every(p => p.timeCost !== null) ? sum(processes.map(p => p.timeCost!)) : null;
  const totals = totalBlockers.length ? null : { hours: quantity(sum(processes.map(p => p.hours!)), model.display.hoursStep), timeCost: totalCost === null ? null : quantity(totalCost, totalCost.cmp(model.display.largeRublesFrom) >= 0 ? model.display.largeRublesStep : model.display.rublesStep) };
  // A basis conflict blocks C only; H can remain meaningful for independent processes.
  if (mixedCostBases) totalBlockers.push("MIXED-COST-BASES");
  const recommendedId = ordered.find(p => p.group === "first")?.id ?? null;
  return { modelVersion: model.version, processes, ranking, recommendedId, fallbackId: recommendedId === null ? (ordered.find(p => p.group !== "excluded")?.id ?? null) : null, totals, totalBlockers };
}
