import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COMPARABILITY_KEYS, INSUFFICIENT, ResultsInputError, compareMeasurement, conditionsFor, parseMeasurement, progressPercent, unitsFor,
} from "../lib/career-v3/results.ts";
import { buildReport, REPORT_KINDS, SECTION_HEADINGS } from "../lib/career-v3/report.ts";

const TODAY = "2026-11-19";
const allTrue = Object.fromEntries(COMPARABILITY_KEYS.map((k) => [k, true]));
const forUnit = (unit) => Object.fromEntries(conditionsFor(unit).map((k) => [k, true]));
const body = (o = {}) => ({
  unit: "minutes",
  baseline: { value: 19, sampleSize: 4, measuredOn: "2026-11-10" },
  after: { value: 2.3, sampleSize: 4, measuredOn: "2026-11-17" },
  reviewMinutes: 7, fixMinutes: 3.5, errorsFound: 7, conditions: allTrue, limitations: [], ...o,
});
const m = (o) => parseMeasurement(body(o), "research_time", TODAY);

test("formulas: total time includes review and fix; absolute difference and percent of 'before'", () => {
  const c = compareMeasurement(m(), "exercise");
  assert.equal(c.status, "ok");
  assert.equal(c.after, 12.8, "2.3 + 7 + 3.5");
  assert.deepEqual(c.afterParts, { work: 2.3, review: 7, fix: 3.5 });
  assert.equal(c.absDiff, -6.2);
  assert.deepEqual(c.relative, { value: -33 });
  assert.equal(c.percentagePoints, null);
  assert.match(c.statement, /было 19 мин \(4 задачи\), стало 12,8 мин/);
  assert.match(c.statement, /работа 2,3 \+ проверка 7 \+ исправление 3,5/);
  assert.match(c.statement, /не доказанный эффект/);
});

test("shares are compared in percentage points", () => {
  const p = parseMeasurement(body({ unit: "percent", baseline: { value: 50, sampleSize: 4, measuredOn: "2026-11-10" }, after: { value: 75, sampleSize: 4, measuredOn: "2026-11-17" }, reviewMinutes: null, fixMinutes: null, conditions: forUnit("percent") }), "crm_completeness", TODAY);
  const c = compareMeasurement(p, "exercise");
  assert.equal(c.percentagePoints, 25);
  assert.deepEqual(c.relative, { value: 50 });
  assert.match(c.statement, /\+25 п\. п\./);
});

test("division by zero gives an explanation instead of a percent", () => {
  const c = compareMeasurement(parseMeasurement(body({ unit: "count", baseline: { value: 0, sampleSize: 5, measuredOn: "2026-11-10" }, after: { value: 2, sampleSize: 5, measuredOn: "2026-11-17" }, reviewMinutes: null, fixMinutes: null, conditions: forUnit("count") }), "error_rate", TODAY), "exercise");
  assert.equal(c.status, "ok");
  assert.equal(c.relative.value, null);
  assert.match(c.relative.explanation, /делить на него нельзя/);
  assert.doesNotMatch(c.statement, /Infinity|NaN|%/);
});

test("insufficient grounds: no baseline, small sample, non-comparable conditions, missing review time, workplace metric", () => {
  const cases = [
    [m({ baseline: null }), "exercise", /Нет исходного замера/],
    [m({ after: { value: 10, sampleSize: 2, measuredOn: "2026-11-17" } }), "exercise", /меньше 3 задач/],
    [m({ conditions: { ...allTrue, sameTaskType: false } }), "exercise", /одного типа и объёма/],
    [m({ reviewMinutes: null }), "exercise", /время проверки/],
    [m(), "workplace_outcome", /рабочий показатель/],
  ];
  for (const [input, kind, re] of cases) {
    const c = compareMeasurement(input, kind);
    assert.equal(c.status, "insufficient");
    assert.equal(c.conclusion, INSUFFICIENT);
    assert.match(c.reasons.join(" "), re);
  }
});

test("audit #49 — comparability uses only conditions relevant to the unit", () => {
  assert.deepEqual(conditionsFor("minutes"), COMPARABILITY_KEYS);
  assert.ok(!conditionsFor("percent").includes("reviewIncluded") && !conditionsFor("count").includes("reviewIncluded"));
  const pct = parseMeasurement(body({ unit: "percent", baseline: { value: 40, sampleSize: 5, measuredOn: "2026-11-10" }, after: { value: 70, sampleSize: 5, measuredOn: "2026-11-17" }, reviewMinutes: null, fixMinutes: null, conditions: forUnit("percent") }), "crm_completeness", TODAY);
  assert.equal(compareMeasurement(pct, "exercise").status, "ok", "a share is comparable without the time-only condition");
  assert.throws(() => parseMeasurement(body({ unit: "percent", conditions: allTrue, reviewMinutes: null, fixMinutes: null }), "crm_completeness", TODAY), /для выбранной единицы/, "the time-only condition is not accepted for a share");
  assert.throws(() => parseMeasurement(body({ conditions: forUnit("percent") }), "research_time", TODAY), /для выбранной единицы/, "minutes still require the review condition");
});

test("audit #49 — an empty fix time is never turned into zero", () => {
  const c = compareMeasurement(m({ fixMinutes: null }), "exercise");
  assert.equal(c.status, "insufficient");
  assert.match(c.reasons.join(" "), /Не указано время исправления \(укажите 0/);
  const zero = compareMeasurement(m({ fixMinutes: 0 }), "exercise");
  assert.equal(zero.status, "ok", "an explicit 0 is accepted");
  assert.equal(zero.after, 9.3);
});

test("audit #49 — symmetric rounding of negative changes and next-day date tolerance", () => {
  const down = compareMeasurement(m({ baseline: { value: 40, sampleSize: 4, measuredOn: "2026-11-10" }, after: { value: 17, sampleSize: 4, measuredOn: "2026-11-17" }, reviewMinutes: 7, fixMinutes: 3 }), "exercise");
  assert.equal(down.absDiff, -13);
  assert.equal(down.relative.value, -33, "−32.5% rounds to −33%, like +32.5% → +33%");
  const up = compareMeasurement(m({ baseline: { value: 40, sampleSize: 4, measuredOn: "2026-11-10" }, after: { value: 43, sampleSize: 4, measuredOn: "2026-11-17" }, reviewMinutes: 7, fixMinutes: 3 }), "exercise");
  assert.equal(up.relative.value, 33);
  assert.doesNotThrow(() => parseMeasurement(body({ after: { value: 2, sampleSize: 4, measuredOn: "2026-11-20" } }), "research_time", "2026-11-20"));
  assert.throws(() => parseMeasurement(body({ after: { value: 2, sampleSize: 4, measuredOn: "2026-11-21" } }), "research_time", "2026-11-20"), /не позже/);
});

test("strict input: negatives, out-of-range values, wrong units, future or reversed dates, free text and extra fields are refused", () => {
  const bad = [
    { baseline: { value: -1, sampleSize: 4, measuredOn: "2026-11-10" } },
    { after: { value: 2, sampleSize: 0, measuredOn: "2026-11-17" } },
    { after: { value: 2, sampleSize: 2.5, measuredOn: "2026-11-17" } },
    { after: { value: 2, sampleSize: 4, measuredOn: "2026-12-30" } },
    { after: { value: 2, sampleSize: 4, measuredOn: "2026-11-01" } },
    { unit: "rubles" },
    { unit: "percent", baseline: { value: 120, sampleSize: 4, measuredOn: "2026-11-10" }, conditions: forUnit("percent") },
    { reviewMinutes: "семь" },
    { conditions: { ...allTrue, sameMethod: "да" } },
    { conditions: { sameTaskType: true } },
    { limitations: ["Клиент ООО Ромашка"] },
    { comment: "внутренний процесс компании" },
    { baseline: { value: 19, sampleSize: 4, measuredOn: "2026-11-10", note: "текст" } },
  ];
  for (const b of bad) assert.throws(() => m(b), ResultsInputError, JSON.stringify(b));
  assert.deepEqual(unitsFor("research_time"), ["minutes"]);
  assert.throws(() => parseMeasurement(body({ unit: "percent" }), "research_time", TODAY), /Единица/);
});

test("task count agreement", async () => {
  const { tasksWord } = await import("../lib/career-v3/results.ts");
  assert.deepEqual([1, 3, 5, 11, 12, 21, 22, 25].map(tasksWord), ["1 задача", "3 задачи", "5 задач", "11 задач", "12 задач", "21 задача", "22 задачи", "25 задач"]);
});

test("progress percent rounds to the nearest whole number: 2/30 ≈ 7%", () => {
  assert.equal(progressPercent(2, 30), 7);
  assert.equal(progressPercent(1, 30), 3);
  assert.equal(progressPercent(30, 30), 100);
  assert.equal(progressPercent(0, 0), 0);
});

const snapshot = (o = {}) => ({
  professionTitle: "Менеджер по продажам", variantLabel: "Практика вручную, без ИИ", syntheticLibrary: false, generatedOn: TODAY,
  completedSteps: 6, totalSteps: 30, stale: false,
  lessons: [
    { title: "Какие данные нельзя передавать ИИ", stepsDone: 2, stepsTotal: 2, quiz: { passed: true, correct: 3, total: 3 } },
    { title: "Коммерческое предложение с проверкой условий", stepsDone: 1, stepsTotal: 4, quiz: { passed: false, correct: 3, total: 5 } },
    { title: "[SYNTHETIC FIXTURE] Тестовый урок", stepsDone: 0, stepsTotal: 2, quiz: null },
  ],
  measurements: [
    { metricLabel: "Качество и время КП", method: "Минуты + доля предложений без ошибок", unit: "minutes", baselineOn: "2026-11-10", afterOn: "2026-11-17", comparison: compareMeasurement(m(), "exercise") },
    { metricLabel: "Доля ошибок в результате", method: "Число значимых ошибок / число проверенных артефактов", unit: "percent", baselineOn: null, afterOn: "2026-11-17", comparison: compareMeasurement(m({ baseline: null }), "exercise") },
  ],
  ...o,
});
const PROMISES = [/(рост|увеличени\S*|повыш\S*)\s+(вашего\s+|вашей\s+)?(доход|зарплат|выручк|продаж|конверси)/i, /гарантир/i, /экономи[яюи]\s+\d/i, /\d+\s*(₽|руб)/i, /повышени\S*\s+(в\s+)?должност/i, /благодаря ИИ|ИИ повысил|ИИ увеличил/i];
const TECH = /\b(T\d{2}|TPL-[A-Z0-9-]+|[A-Z]{3}\d{2}-TASK-\d+|STEP-\d{2}|(SAF|SAL|MAP|TRD|VAL)-\d{2})\b|@example|[0-9a-f]{8}-[0-9a-f]{4}-|demo-/;

test("three report variants: six sections, training notice, dates, no proven business link, no promises or technical data", () => {
  assert.deepEqual(REPORT_KINDS.map((k) => k.id), ["results", "pilot", "development"]);
  for (const { id } of REPORT_KINDS) {
    const r = buildReport(id, snapshot());
    assert.deepEqual(r.sections.map((s) => s.heading), [...SECTION_HEADINGS]);
    assert.match(r.text, /Учебные данные/);
    assert.match(r.text, /Даты замеров: 10\.11\.2026–17\.11\.2026/);
    assert.match(r.text, /не доказана и не утверждается/);
    assert.match(r.text, /самопроверка, а не объективное подтверждение/);
    assert.match(r.text, /недостаточно оснований для вывода — нет исходного замера/);
    for (const re of PROMISES) assert.doesNotMatch(r.text, re, `${id}: ${re}`);
    assert.doesNotMatch(r.text, TECH, `${id}: technical identifiers`);
    assert.doesNotMatch(r.text, /\[SYNTHETIC FIXTURE\]/);
  }
  assert.match(buildReport("pilot", snapshot()).text, /две недели/i);
  assert.match(buildReport("pilot", snapshot()).text, /Критерий остановки/);
  assert.match(buildReport("development", snapshot()).text, /а не запрос о должности или оплате/);
});

test("report without measurements or steps never invents a result", () => {
  const r = buildReport("results", snapshot({ completedSteps: 0, lessons: [], measurements: [] }));
  assert.match(r.text, /Пока ни один шаг не завершён/);
  assert.match(r.text, /Недостаточно оснований для вывода: замеров нет/);
  assert.match(r.text, /Замеров пока нет/);
  const stale = buildReport("results", snapshot({ stale: true, syntheticLibrary: true }));
  assert.match(stale.text, /прежней версии маршрута/);
  assert.match(stale.text, /тестовой библиотеке-заглушке/);
});

test("migration 008: separate table, exercise metrics only, numbers and predefined codes, links to step and plan of the same account", () => {
  const sql = readFileSync("migrations/career/008_v3_measurements.sql", "utf8");
  assert.match(sql, /CAREER_TEST_DATABASE_REQUIRED/);
  assert.match(sql, /metric_kind = 'exercise'/);
  assert.match(sql, /REFERENCES career_v3_step_progress\(plan_version_id, position\)/);
  assert.match(sql, /REFERENCES career_v3_plan_versions\(id, account_id\)/);
  assert.match(sql, /limitations <@ ARRAY/);
  assert.doesNotMatch(sql, /\b(comment|note|description|free_text)\b\s+text/i);
  assert.doesNotMatch(sql, /career_progress\b/);
});
