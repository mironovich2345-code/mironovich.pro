// "Мои результаты" (#47): learner-entered training measurements "было → стало" and the server formulas.
// Only numbers, units from a fixed list and predefined comparability flags are accepted — no free text.
// Comparisons are allowed only for exercise metrics (measured on the learner's own training artifacts)
// under comparable conditions; workplace outcomes (reply rate, renewals, response time…) are never
// compared or attributed to training or AI (METRICS_REVIEW.md).
import type { MetricKind } from "./types.ts";

export const RESULTS_MODEL = "career-v3-results/1";
export type Unit = "minutes" | "count" | "percent" | "fields";
export const UNIT_LABEL: Record<Unit, string> = { minutes: "минуты", count: "штуки", percent: "проценты", fields: "заполненные поля" };
export const UNIT_SHORT: Record<Unit, string> = { minutes: "мин", count: "шт.", percent: "%", fields: "полей" };

/** Units that make sense for each exercise metric of the sales pilot (other metrics: count). */
export const METRIC_UNITS: Record<string, Unit[]> = {
  research_time: ["minutes"],
  qualification_quality: ["percent", "fields"],
  crm_completeness: ["percent", "fields"],
  proposal_quality: ["minutes", "percent"],
  error_rate: ["percent", "count"],
  funnel_hypotheses: ["count"],
  report_quality: ["percent", "count"],
};
export const unitsFor = (metricId: string): Unit[] => METRIC_UNITS[metricId] ?? ["count"];

/** Predefined comparability conditions; every one must hold for a comparison. */
export const COMPARABILITY = {
  sameTaskType: "Задачи «было» и «стало» одного типа и объёма",
  sameMethod: "Один и тот же способ замера и чек-лист качества",
  samePerformer: "Замер делал один и тот же человек",
  trainingDataOnly: "Только вымышленные учебные данные",
  reviewIncluded: "Время «стало» включает проверку и исправление",
} as const;
export type ComparabilityKey = keyof typeof COMPARABILITY;
export const COMPARABILITY_KEYS = Object.keys(COMPARABILITY) as ComparabilityKey[];
/** Only conditions that apply to the unit: the review/fix-time condition concerns time measurements only. */
export const conditionsFor = (unit: Unit): ComparabilityKey[] => COMPARABILITY_KEYS.filter((k) => k !== "reviewIncluded" || unit === "minutes");

/** Predefined interpretation limits the learner can add; some are always added by the system. */
export const LIMITATIONS = {
  small_sample: "Мало задач в замере",
  learning_effect: "Повторный замер мог улучшиться просто от опыта",
  other_changes: "В тот же период менялось что-то ещё (регламент, шаблоны, нагрузка)",
  single_example_type: "Проверен один тип учебной задачи",
} as const;
export type LimitationKey = keyof typeof LIMITATIONS;
export const ALWAYS_LIMITATIONS = [
  "Учебные данные на вымышленных задачах, а не рабочие показатели",
  "Связь с выручкой, конверсией, продлениями и другими бизнес-результатами не доказана и не утверждается",
];
export const MIN_SAMPLE = 3;
export const INSUFFICIENT = "Недостаточно оснований для вывода";

export class ResultsInputError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export interface Point { value: number; sampleSize: number; measuredOn: string }
export interface MeasurementInput {
  unit: Unit;
  baseline: Point | null;
  after: Point | null;
  reviewMinutes: number | null;
  fixMinutes: number | null;
  errorsFound: number | null;
  conditions: Partial<Record<ComparabilityKey, boolean>>;
  limitations: LimitationKey[];
}

const MAX: Record<Unit, number> = { minutes: 600, count: 1000, percent: 100, fields: 200 };
const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
const num = (v: unknown, max: number, what: string, integer = false) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max || (integer && !Number.isInteger(v)))
    throw new ResultsInputError("invalid_number", `${what}: число от 0 до ${max}${integer ? ", целое" : ""}`);
  return Math.round(v * 10) / 10;
};

/**
 * Strict parsing of a measurement body: exact keys, numbers in range, ISO dates not after `latestDate`
 * (the caller passes the next UTC day so that a learner east of UTC can enter today's local date).
 */
export function parseMeasurement(body: unknown, metricId: string, latestDate: string): MeasurementInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ResultsInputError("invalid_body", "Замер не распознан");
  const b = body as Record<string, unknown>;
  const allowed = ["unit", "baseline", "after", "reviewMinutes", "fixMinutes", "errorsFound", "conditions", "limitations"];
  if (Object.keys(b).some((k) => !allowed.includes(k))) throw new ResultsInputError("unexpected_field", "Неожиданные поля замера");
  const unit = b.unit as Unit;
  if (!unitsFor(metricId).includes(unit)) throw new ResultsInputError("invalid_unit", "Единица измерения не подходит для этого показателя");
  const point = (v: unknown, what: string): Point | null => {
    if (v === null || v === undefined) return null;
    if (typeof v !== "object" || Array.isArray(v)) throw new ResultsInputError("invalid_point", `${what}: неверный формат`);
    const p = v as Record<string, unknown>;
    if (Object.keys(p).some((k) => !["value", "sampleSize", "measuredOn"].includes(k))) throw new ResultsInputError("unexpected_field", `${what}: неожиданные поля`);
    if (!isDate(p.measuredOn) || (p.measuredOn as string) > latestDate) throw new ResultsInputError("invalid_date", `${what}: дата замера в формате ГГГГ-ММ-ДД, не позже сегодняшней`);
    return { value: num(p.value, MAX[unit], `${what}, значение`), sampleSize: num(p.sampleSize, 100, `${what}, число задач`, true), measuredOn: p.measuredOn as string };
  };
  const baseline = point(b.baseline, "Было");
  const after = point(b.after, "Стало");
  if (baseline && baseline.sampleSize < 1) throw new ResultsInputError("invalid_number", "Было: число задач от 1");
  if (after && after.sampleSize < 1) throw new ResultsInputError("invalid_number", "Стало: число задач от 1");
  if (baseline && after && after.measuredOn < baseline.measuredOn) throw new ResultsInputError("invalid_date", "Повторный замер не может быть раньше исходного");
  const opt = (v: unknown, max: number, what: string, integer = false) => (v === null || v === undefined ? null : num(v, max, what, integer));
  const c = b.conditions;
  const keys = conditionsFor(unit);
  if (!c || typeof c !== "object" || Array.isArray(c) || Object.keys(c).length !== keys.length
    || keys.some((k) => typeof (c as Record<string, unknown>)[k] !== "boolean"))
    throw new ResultsInputError("invalid_conditions", "Условия сопоставимости: отметьте каждое условие для выбранной единицы «да» или «нет»");
  const lim = b.limitations ?? [];
  if (!Array.isArray(lim) || lim.some((x) => !(x in LIMITATIONS)) || new Set(lim).size !== lim.length)
    throw new ResultsInputError("invalid_limitations", "Ограничения выбираются только из списка");
  return {
    unit, baseline, after,
    reviewMinutes: opt(b.reviewMinutes, 600, "Время проверки"), fixMinutes: opt(b.fixMinutes, 600, "Время исправления"),
    errorsFound: opt(b.errorsFound, 1000, "Найдено ошибок", true),
    conditions: Object.fromEntries(keys.map((k) => [k, (c as Record<string, boolean>)[k]])), limitations: lim as LimitationKey[],
  };
}

/** Half away from zero, symmetric for negative changes (−32.5% → −33%, like 32.5% → 33%). */
const roundHalfAway = (x: number) => Math.sign(x) * Math.round(Math.abs(x));
const r1 = (x: number) => Math.sign(x) * Math.round(Math.abs(x) * 10 + 1e-9) / 10;
/** "1 задача", "3 задачи", "5 задач". */
export const tasksWord = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${m10 === 1 && m100 !== 11 ? "задача" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "задачи" : "задач"}`;
};
export const fmtNum = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1)).replace(".", ",").replace("-", "−");

export type Comparison =
  | { status: "insufficient"; reasons: string[]; conclusion: typeof INSUFFICIENT; caveats: string[] }
  | {
    status: "ok"; unit: Unit; baseline: number; after: number; afterParts: { work: number; review: number; fix: number } | null;
    absDiff: number; relative: { value: number } | { value: null; explanation: string }; percentagePoints: number | null;
    statement: string; caveats: string[];
  };

/** Server formulas. Returns "insufficient" instead of a number whenever a conclusion is not supported. */
export function compareMeasurement(m: MeasurementInput, kind: MetricKind | undefined): Comparison {
  const caveats = [...ALWAYS_LIMITATIONS, ...m.limitations.map((k) => LIMITATIONS[k])];
  const reasons: string[] = [];
  if (kind !== "exercise") reasons.push("Это рабочий показатель: он зависит от многих внешних факторов, поэтому в учебных результатах не сравнивается");
  if (!m.baseline) reasons.push("Нет исходного замера «было»");
  if (!m.after) reasons.push("Нет повторного замера «стало»");
  const unmet = conditionsFor(m.unit).filter((k) => m.conditions[k] !== true).map((k) => COMPARABILITY[k].toLowerCase());
  if (unmet.length) reasons.push(`Не подтверждены условия сопоставимости: ${unmet.join("; ")}`);
  if (m.baseline && m.baseline.sampleSize < MIN_SAMPLE) reasons.push(`В исходном замере меньше ${MIN_SAMPLE} задач`);
  if (m.after && m.after.sampleSize < MIN_SAMPLE) reasons.push(`В повторном замере меньше ${MIN_SAMPLE} задач`);
  if (m.unit === "minutes" && m.after && m.reviewMinutes === null) reasons.push("Не указано время проверки результата (укажите 0, если проверки не было)");
  // An empty fix time is never treated as zero: the learner confirms 0 explicitly.
  if (m.unit === "minutes" && m.after && m.fixMinutes === null) reasons.push("Не указано время исправления (укажите 0, если исправлений не было)");
  if (reasons.length || !m.baseline || !m.after) return { status: "insufficient", reasons, conclusion: INSUFFICIENT, caveats };

  if (m.baseline.sampleSize < 10 || m.after.sampleSize < 10) caveats.push(LIMITATIONS.small_sample);
  const parts = m.unit === "minutes" ? { work: m.after.value, review: m.reviewMinutes!, fix: m.fixMinutes! } : null;
  const after = parts ? r1(parts.work + parts.review + parts.fix) : m.after.value;
  const baseline = m.baseline.value;
  const absDiff = r1(after - baseline);
  const relative = baseline === 0
    ? { value: null, explanation: "Процент изменения не считается: исходное значение равно нулю, делить на него нельзя. Используйте абсолютную разницу." }
    : { value: roundHalfAway((absDiff / baseline) * 100) };
  const pp = m.unit === "percent" ? r1(after - baseline) : null;
  const u = UNIT_SHORT[m.unit];
  const sign = (x: number) => (x > 0 ? "+" : "") + fmtNum(x);
  const change = m.unit === "percent"
    ? `${sign(pp!)} п. п. (разница долей в процентных пунктах)`
    : `${sign(absDiff)} ${u}${relative.value !== null ? `, ${sign(relative.value)}% от «было»` : ""}`;
  const timeNote = parts ? ` (стало = работа ${fmtNum(parts.work)} + проверка ${fmtNum(parts.review)} + исправление ${fmtNum(parts.fix)} мин)` : "";
  const statement = `На учебных задачах: было ${fmtNum(baseline)} ${u} (${tasksWord(m.baseline.sampleSize)}), стало ${fmtNum(after)} ${u} (${tasksWord(m.after.sampleSize)})${timeNote}; изменение ${change}. Это наблюдение на учебных данных, а не доказанный эффект.`;
  return { status: "ok", unit: m.unit, baseline, after, afterParts: parts, absDiff, relative, percentagePoints: pp, statement, caveats };
}

/** Progress percent for display: rounded to the nearest whole percent; the exact count is shown alongside. */
export const progressPercent = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);
