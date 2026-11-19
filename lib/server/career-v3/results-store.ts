// "Мои результаты" (#47): training measurements on top of the saved progress (migration 008). Progress is not
// duplicated — it is read through progress-store. The account comes from the session, the plan version is
// the account's active one, the step is addressed by position + stable ID and its metric must be the step's
// own exercise metric. Comparisons are computed on the server (lib/career-v3/results.ts).
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { careerPool, event, transaction } from "../career/db.ts";
import { CareerError } from "../career/config.ts";
import { metricRef } from "../../career-v3/engine.ts";
import type { PlanStepV3, PlanV3 } from "../../career-v3/contracts.ts";
import { VARIANT_LABEL } from "../../career-v3/ui-flow.ts";
import {
  COMPARABILITY_KEYS, compareMeasurement, parseMeasurement, unitsFor, type Comparison, type LimitationKey, type MeasurementInput, type Unit,
} from "../../career-v3/results.ts";
import { buildReport, type ReportKind, type ReportSnapshot } from "../../career-v3/report.ts";
import { activePlanRow, readProgress, versionStaleReasons } from "./progress-store.ts";
import { loadProfessionBundle, type ProfessionBundle } from "./content.ts";

type Queryable = { query: (q: string, args?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
type ReadyPlan = Extract<PlanV3, { status: "ready" }>;
interface Diagnostic { savedAt: string; stale: boolean; staleReasons: string[] }
const MEASURE_PHASES = new Set(["measure", "value"]);
const iso = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : null);
const today = () => new Date().toISOString().slice(0, 10);

/** Steps where a measurement can be entered: measurement/value phase with an exercise metric of the role. */
export function measurementSlots(plan: ReadyPlan, bundle: ProfessionBundle) {
  return plan.steps.filter((s) => MEASURE_PHASES.has(s.phase) && s.metricId).map((s) => {
    const m = metricRef(bundle.engine, s.metricId);
    return {
      position: s.position, stableId: s.stableId, lessonTitle: s.lessonTitle, learningGoal: s.learningGoal,
      metric: m ? { id: m.metricId, label: m.label, method: m.method, caveat: m.caveat, kind: m.kind } : null,
      units: m?.kind === "exercise" ? unitsFor(m.metricId) : [],
      eligible: m?.kind === "exercise",
      note: m?.kind === "exercise" ? null : "Рабочий показатель: только наблюдается и не сравнивается в учебных результатах",
    };
  });
}

function rowToInput(r: Record<string, unknown>): MeasurementInput {
  const point = (v: unknown, n: unknown, d: unknown) => (v === null ? null : { value: Number(v), sampleSize: Number(n), measuredOn: iso(d)! });
  return {
    unit: r.unit as Unit,
    baseline: point(r.baseline_value, r.baseline_sample, r.baseline_on),
    after: point(r.after_value, r.after_sample, r.after_on),
    reviewMinutes: r.review_minutes === null ? null : Number(r.review_minutes),
    fixMinutes: r.fix_minutes === null ? null : Number(r.fix_minutes),
    errorsFound: r.errors_found === null ? null : Number(r.errors_found),
    conditions: r.conditions as MeasurementInput["conditions"],
    limitations: (r.limitations as LimitationKey[]) ?? [],
  };
}

export async function readResults(db: Queryable, accountId: string, professionId: string, d: Diagnostic | null) {
  const bundle = loadProfessionBundle(professionId);
  const progress = await readProgress(db, accountId, professionId, d);
  const historyMeasurements = (await db.query(
    `SELECT v.created_at, count(m.*)::int AS n FROM career_v3_plan_versions v JOIN career_v3_measurements m ON m.plan_version_id=v.id AND m.account_id=v.account_id
      WHERE v.account_id=$1 AND v.profession_id=$2 AND v.status='superseded' GROUP BY v.id ORDER BY v.created_at DESC`, [accountId, professionId])).rows;
  const history = progress.history.map((h) => ({ ...h, measurements: (historyMeasurements.find((x) => new Date(x.created_at as string).toISOString() === h.createdAt)?.n as number) ?? 0 }));
  if (!progress.plan) return { plan: null, history, professionTitle: bundle.config.title };
  const p = progress as Extract<typeof progress, { planVersionId: string }>;
  const published = new Map(bundle.library.published.map((l) => [l.id, l.version]));
  const lessonIds = [...new Set(p.plan.steps.map((s) => s.lessonId))];
  const lessons = lessonIds.map((id) => {
    const steps = p.plan.steps.filter((s) => s.lessonId === id);
    const done = p.steps.filter((s) => s.lessonId === id && s.state === "done").length;
    const q = p.quizzes[id];
    const version = steps[0].lessonVersion;
    const status = !published.has(id) ? "withdrawn" : published.get(id) !== version ? "outdated" : "current";
    return { lessonId: id, title: steps[0].lessonTitle, version, status, stepsDone: done, stepsTotal: steps.length,
      quiz: q ? { passed: q.passed, correct: q.correct, total: q.total, attempts: q.attempts } : null };
  });
  const rows = (await db.query("SELECT * FROM career_v3_measurements WHERE plan_version_id=$1 AND account_id=$2 ORDER BY position", [p.planVersionId, accountId])).rows;
  const slots = measurementSlots(p.plan, bundle);
  const measurements = slots.map((slot) => {
    const row = rows.find((r) => r.position === slot.position);
    const input = row ? rowToInput(row) : null;
    const comparison: Comparison | null = input ? compareMeasurement(input, slot.metric?.kind) : null;
    return { ...slot, input, comparison, revision: (row?.revision as number) ?? 0, updatedAt: row ? new Date(row.updated_at as string).toISOString() : null };
  });
  return {
    professionTitle: bundle.config.title, libraryMode: bundle.libraryMode, plan: { variant: p.plan.variant, builtOn: p.plan.builtOn },
    stale: p.stale, staleReasons: p.staleReasons, summary: p.summary, lessons, measurements, history,
  };
}

/** Saves (or replaces) the measurement of one step; a repeated submission updates the same row. */
export async function saveMeasurement(accountId: string, professionId: string, position: number, stableId: unknown, metricId: unknown, body: unknown, d: Diagnostic) {
  if (!Number.isInteger(position) || position < 1 || position > 30) throw new CareerError(404, "Шаг не найден");
  if (typeof stableId !== "string" || typeof metricId !== "string") throw new CareerError(400, "Не указан шаг или показатель");
  const bundle = loadProfessionBundle(professionId);
  return transaction(async (tx) => {
    const version = await activePlanRow(tx, accountId, professionId, true);
    if (!version) throw new CareerError(409, "Маршрут ещё не собран");
    const reasons = versionStaleReasons(version, bundle, d);
    if (reasons.length) throw Object.assign(new CareerError(409, "Маршрут устарел: новые замеры вносятся в новый маршрут, прежние сохранены в истории"), { errors: reasons });
    const plan = version.payload as ReadyPlan;
    const step = plan.steps.find((s) => s.position === position) as PlanStepV3 | undefined;
    if (!step || step.stableId !== stableId) throw new CareerError(409, "Шаг не совпадает с вашим текущим маршрутом — обновите страницу");
    const slot = measurementSlots(plan, bundle).find((s) => s.position === position);
    if (!slot) throw new CareerError(409, "Для этого шага замер не предусмотрен");
    if (!slot.metric || slot.metric.id !== metricId) throw new CareerError(409, "Показатель не совпадает с показателем шага");
    if (!slot.eligible) throw new CareerError(409, slot.note!);
    const m = parseMeasurement(body, metricId, today());
    const r = await tx.query(
      `INSERT INTO career_v3_measurements(plan_version_id,account_id,position,step_stable_id,metric_id,metric_kind,variant,unit,
         baseline_value,baseline_sample,baseline_on,after_value,after_sample,after_on,review_minutes,fix_minutes,errors_found,conditions,limitations)
       VALUES($1,$2,$3,$4,$5,'exercise',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18)
       ON CONFLICT(plan_version_id,position) DO UPDATE SET unit=EXCLUDED.unit, baseline_value=EXCLUDED.baseline_value, baseline_sample=EXCLUDED.baseline_sample,
         baseline_on=EXCLUDED.baseline_on, after_value=EXCLUDED.after_value, after_sample=EXCLUDED.after_sample, after_on=EXCLUDED.after_on,
         review_minutes=EXCLUDED.review_minutes, fix_minutes=EXCLUDED.fix_minutes, errors_found=EXCLUDED.errors_found, conditions=EXCLUDED.conditions,
         limitations=EXCLUDED.limitations, revision=career_v3_measurements.revision+1, updated_at=now()
       RETURNING revision`,
      [version.id, accountId, position, stableId, metricId, plan.variant, m.unit,
        m.baseline?.value ?? null, m.baseline?.sampleSize ?? null, m.baseline?.measuredOn ?? null,
        m.after?.value ?? null, m.after?.sampleSize ?? null, m.after?.measuredOn ?? null,
        m.reviewMinutes, m.fixMinutes, m.errorsFound, JSON.stringify(Object.fromEntries(COMPARABILITY_KEYS.map((k) => [k, m.conditions[k]]))), m.limitations],
    );
    await event("v3_measurement_saved", accountId, null, tx);
    return { position, revision: r.rows[0].revision as number, comparison: compareMeasurement(m, slot.metric.kind) };
  });
}

export function reportSnapshot(results: Awaited<ReturnType<typeof readResults>>): ReportSnapshot | null {
  if (!results.plan || !("summary" in results)) return null;
  return {
    professionTitle: results.professionTitle, variantLabel: VARIANT_LABEL[results.plan.variant], syntheticLibrary: results.libraryMode === "synthetic_fixture",
    generatedOn: today(), completedSteps: results.summary.done, totalSteps: results.summary.total, stale: results.stale,
    lessons: results.lessons.map((l) => ({ title: l.title, stepsDone: l.stepsDone, stepsTotal: l.stepsTotal, quiz: l.quiz })),
    measurements: results.measurements.filter((m) => m.input && m.comparison && m.metric).map((m) => ({
      metricLabel: m.metric!.label, method: m.metric!.method, unit: m.input!.unit,
      baselineOn: m.input!.baseline?.measuredOn ?? null, afterOn: m.input!.after?.measuredOn ?? null, comparison: m.comparison!,
    })),
  };
}

export function resultsReport(results: Awaited<ReturnType<typeof readResults>>, kind: ReportKind) {
  const snap = reportSnapshot(results);
  if (!snap) throw new CareerError(409, "Маршрут ещё не собран — отчёт строить не из чего");
  return buildReport(kind, snap);
}

/** PDF from the report text only: no email, account or plan IDs, no tokens. */
export async function reportPdf(report: ReturnType<typeof buildReport>): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(report.title);
  pdf.setAuthor("Учебный кабинет MIRONOVICH");
  pdf.setProducer("MIRONOVICH.PRO");
  pdf.setCreator("MIRONOVICH.PRO");
  const font = await pdf.embedFont(await readFile(resolve("public/fonts/career/DejaVuSans.ttf")), { subset: true });
  let page = pdf.addPage([595, 842]);
  let y = 790;
  const draw = (text: string, size: number, color = rgb(0.06, 0.06, 0.07)) => {
    if (y < 60) { page = pdf.addPage([595, 842]); y = 790; }
    page.drawText(text, { x: 50, y, size, font, color });
    y -= size + 5;
  };
  const para = (text: string, size = 11, color?: ReturnType<typeof rgb>) => {
    let line = "";
    for (const w of text.split(/\s+/)) {
      const next = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(next, size) > 495 && line) { draw(line, size, color); line = w; } else line = next;
    }
    if (line) draw(line, size, color);
    y -= 4;
  };
  para(report.title, 16);
  for (const n of report.notice) para(n, 9.5, rgb(0.33, 0.32, 0.3));
  y -= 6;
  for (const s of report.sections) {
    para(s.heading, 13);
    for (const l of s.lines) para("— " + l);
    y -= 4;
  }
  for (const p of pdf.getPages()) p.drawText("Учебные данные · без доказанной связи с бизнес-результатами", { x: 50, y: 28, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
  return Buffer.from(await pdf.save());
}

export const defaultResultsDb = () => careerPool();
