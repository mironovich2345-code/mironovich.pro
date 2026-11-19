// Persistence of progress through the 30 steps (migration 007). The account always comes from the session,
// the plan version is always the account's active one (never taken from the client), and the step is
// addressed by position plus its stable ID — a mismatch means a stale or forged request and is refused.
// States are derived on the server (lib/career-v3/progress.ts); a completion is recorded once.
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { careerPool, event, transaction } from "../career/db.ts";
import { CareerError } from "../career/config.ts";
import { planStaleReasons } from "../../career-v3/plan.ts";
import type { PlanStepV3, PlanV3, StepState } from "../../career-v3/contracts.ts";
import {
  PROGRESS_MODEL, ProgressInputError, canComplete, checkBooleans, deriveState, gradeQuiz, planFingerprintSource, resumePosition, summarize,
  type QuizQuestion,
} from "../../career-v3/progress.ts";
import { loadProfessionBundle, type ProfessionBundle } from "./content.ts";

type Queryable = { query: (q: string, args?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
type ReadyPlan = Extract<PlanV3, { status: "ready" }>;
type Exercise = { id: string; successCriteria: string[] };
interface Diagnostic { savedAt: string; stale: boolean; staleReasons: string[] }

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
export const fingerprint = (plan: ReadyPlan) => createHash("sha256").update(planFingerprintSource(plan)).digest("hex");

export function lessonExercise(bundle: ProfessionBundle, lessonId: string, exerciseId: string): Exercise | null {
  const doc = bundle.lessonDocuments.get(lessonId)?.document as unknown as { content?: { exercises?: Exercise[] } } | undefined;
  return doc?.content?.exercises?.find((e) => e.id === exerciseId) ?? null;
}

export async function activePlanRow(db: Queryable, accountId: string, professionId: string, lock = false) {
  const r = await db.query(
    `SELECT * FROM career_v3_plan_versions WHERE account_id=$1 AND profession_id=$2 AND status='active'${lock ? " FOR UPDATE" : ""}`,
    [accountId, professionId],
  );
  return r.rows[0] ?? null;
}

/** Why a stored plan version can no longer be worked on: content, versions or the diagnostic changed. */
export function versionStaleReasons(row: Record<string, unknown>, bundle: ProfessionBundle, d: Diagnostic | null): string[] {
  const reasons = planStaleReasons(row.payload as PlanV3, bundle.engine, bundle.library);
  if (!d || d.savedAt !== iso(row.diagnostic_saved_at)) reasons.push("diagnostic_resubmitted");
  else if (d.stale) reasons.push(...d.staleReasons);
  return reasons;
}

/**
 * Stores the plan as the active version. The same content (same fingerprint and diagnostic) reuses the
 * active version, so rebuilding never resets progress. A different plan supersedes the active version:
 * its progress stays as history and is not copied.
 */
export async function ensurePlanVersion(tx: PoolClient, accountId: string, professionId: string, plan: ReadyPlan, diagnosticSavedAt: string,
  bundle: ProfessionBundle, supersedeReasons: string[]) {
  const fp = fingerprint(plan);
  const active = await activePlanRow(tx, accountId, professionId, true);
  if (active && active.fingerprint === fp && iso(active.diagnostic_saved_at) === diagnosticSavedAt) return { id: active.id as string, created: false };
  if (active) {
    await tx.query("UPDATE career_v3_plan_versions SET status='superseded', superseded_at=now(), superseded_reasons=$2::jsonb, updated_at=now() WHERE id=$1",
      [active.id, JSON.stringify(supersedeReasons)]);
  }
  const id = randomUUID();
  await tx.query(
    `INSERT INTO career_v3_plan_versions(id,account_id,profession_id,fingerprint,model_version,progress_model,diagnostic_version,diagnostic_saved_at,versions,payload,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,'active')`,
    [id, accountId, professionId, fp, plan.modelVersion, PROGRESS_MODEL, plan.versions.diagnostic, diagnosticSavedAt, JSON.stringify(plan.versions), JSON.stringify(plan)],
  );
  for (const s of plan.steps) {
    const ex = lessonExercise(bundle, s.lessonId, s.exerciseId);
    if (!ex || !ex.successCriteria?.length) throw new CareerError(503, "Урок маршрута не содержит проверяемого упражнения");
    await tx.query(
      `INSERT INTO career_v3_step_progress(plan_version_id,account_id,position,step_stable_id,lesson_id,lesson_version,exercise_id,criteria_count)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, accountId, s.position, s.stableId, s.lessonId, s.lessonVersion, s.exerciseId, ex.successCriteria.length],
    );
  }
  await event(active ? "v3_plan_superseded" : "v3_plan_started", accountId, null, tx);
  return { id, created: true };
}

const stepView = (r: Record<string, unknown>) => ({
  position: r.position as number, stableId: r.step_stable_id as string, lessonId: r.lesson_id as string, lessonVersion: r.lesson_version as string,
  exerciseId: r.exercise_id as string, state: r.state as StepState, criteriaMet: (r.criteria_met as boolean[] | null) ?? null,
  completionMet: (r.completion_met as boolean[] | null) ?? null, completedAt: iso(r.completed_at), updatedAt: iso(r.updated_at),
});

export async function readProgress(db: Queryable, accountId: string, professionId: string, d: Diagnostic | null) {
  const bundle = loadProfessionBundle(professionId);
  const history = (await db.query(
    `SELECT v.id, v.created_at, v.superseded_at, v.superseded_reasons, count(p.*) FILTER (WHERE p.state='done')::int AS done
       FROM career_v3_plan_versions v LEFT JOIN career_v3_step_progress p ON p.plan_version_id=v.id AND p.account_id=v.account_id
      WHERE v.account_id=$1 AND v.profession_id=$2 AND v.status='superseded'
      GROUP BY v.id ORDER BY v.created_at DESC LIMIT 10`,
    [accountId, professionId],
  )).rows.map((h) => ({ createdAt: iso(h.created_at), supersededAt: iso(h.superseded_at), reasons: (h.superseded_reasons as string[]) ?? [], done: h.done as number, total: 30 }));
  const active = await activePlanRow(db, accountId, professionId);
  if (!active) return { plan: null, history };
  const rows = (await db.query("SELECT * FROM career_v3_step_progress WHERE plan_version_id=$1 AND account_id=$2 ORDER BY position", [active.id, accountId])).rows;
  const quizzes = Object.fromEntries((await db.query(
    "SELECT lesson_id, lesson_version, passed, attempts, correct, total, answers FROM career_v3_quiz_results WHERE plan_version_id=$1 AND account_id=$2",
    [active.id, accountId],
  )).rows.map((q) => [q.lesson_id, { lessonVersion: q.lesson_version, passed: q.passed, attempts: q.attempts, correct: q.correct, total: q.total, answers: q.answers }]));
  const steps = rows.map(stepView);
  const staleReasons = versionStaleReasons(active, bundle, d);
  return {
    planVersionId: active.id as string, plan: active.payload as ReadyPlan, startedAt: iso(active.created_at),
    stale: staleReasons.length > 0, staleReasons, steps, quizzes, summary: summarize(steps.map((s) => s.state)),
    resumePosition: resumePosition((active.cursor_position as number | null) ?? null, steps), history,
  };
}

/** Locks the active version and the addressed step; refuses stale plans and position/ID mismatches. */
async function withStep<T>(accountId: string, professionId: string, position: number, stableId: unknown, d: Diagnostic,
  fn: (tx: PoolClient, ctx: { version: Record<string, unknown>; row: Record<string, unknown>; step: PlanStepV3; bundle: ProfessionBundle }) => Promise<T>) {
  if (!Number.isInteger(position) || position < 1 || position > 30) throw new CareerError(404, "Шаг не найден");
  if (typeof stableId !== "string" || stableId.length > 80) throw new CareerError(400, "Не указан шаг маршрута");
  const bundle = loadProfessionBundle(professionId);
  return transaction(async (tx) => {
    const version = await activePlanRow(tx, accountId, professionId, true);
    if (!version) throw new CareerError(409, "Маршрут ещё не собран");
    const reasons = versionStaleReasons(version, bundle, d);
    if (reasons.length) throw Object.assign(new CareerError(409, "Маршрут устарел: прогресс сохранён как история, соберите новый маршрут"), { errors: reasons });
    const row = (await tx.query("SELECT * FROM career_v3_step_progress WHERE plan_version_id=$1 AND account_id=$2 AND position=$3 FOR UPDATE",
      [version.id, accountId, position])).rows[0];
    if (!row || row.step_stable_id !== stableId) throw new CareerError(409, "Шаг не совпадает с вашим текущим маршрутом — обновите страницу");
    const step = (version.payload as ReadyPlan).steps.find((s) => s.position === position)!;
    return fn(tx, { version, row, step, bundle });
  });
}

async function quizPassed(tx: Queryable, versionId: unknown, accountId: string, lessonId: unknown, lessonVersion: unknown) {
  const q = (await tx.query("SELECT passed FROM career_v3_quiz_results WHERE plan_version_id=$1 AND account_id=$2 AND lesson_id=$3 AND lesson_version=$4",
    [versionId, accountId, lessonId, lessonVersion])).rows[0];
  return q?.passed === true;
}

export function startStep(accountId: string, professionId: string, position: number, stableId: unknown, d: Diagnostic) {
  return withStep(accountId, professionId, position, stableId, d, async (tx, { version, row }) => {
    await tx.query("UPDATE career_v3_plan_versions SET cursor_position=$2, updated_at=now() WHERE id=$1", [version.id, position]);
    if (row.state === "not_started") {
      const r = await tx.query("UPDATE career_v3_step_progress SET state='in_progress', started_at=now(), updated_at=now() WHERE plan_version_id=$1 AND position=$2 RETURNING *",
        [version.id, position]);
      return stepView(r.rows[0]);
    }
    return stepView(row);
  });
}

export function saveSelfCheck(accountId: string, professionId: string, position: number, stableId: unknown, criteriaMet: unknown, d: Diagnostic) {
  return withStep(accountId, professionId, position, stableId, d, async (tx, { version, row }) => {
    if (row.state === "done") return { ...stepView(row), unchanged: true };
    const met = checkBooleans(criteriaMet, row.criteria_count as number, "Самопроверка");
    const passed = await quizPassed(tx, version.id, accountId, row.lesson_id, row.lesson_version);
    const state = deriveState({ started: true, criteriaMet: met, criteriaCount: row.criteria_count as number, quizPassed: passed, completedAt: null });
    const r = await tx.query(
      `UPDATE career_v3_step_progress SET criteria_met=$3::jsonb, state=$4, started_at=coalesce(started_at, now()), updated_at=now()
        WHERE plan_version_id=$1 AND position=$2 RETURNING *`,
      [version.id, position, JSON.stringify(met), state],
    );
    await tx.query("UPDATE career_v3_plan_versions SET cursor_position=$2, updated_at=now() WHERE id=$1", [version.id, position]);
    return stepView(r.rows[0]);
  });
}

export async function submitQuiz(accountId: string, professionId: string, lessonId: string, answers: unknown, d: Diagnostic) {
  if (!/^[A-Z]{2,5}-[0-9]{2,3}(?:-EX)?$/.test(lessonId)) throw new CareerError(404, "Урок не найден");
  const bundle = loadProfessionBundle(professionId);
  return transaction(async (tx) => {
    const version = await activePlanRow(tx, accountId, professionId, true);
    if (!version) throw new CareerError(409, "Маршрут ещё не собран");
    const reasons = versionStaleReasons(version, bundle, d);
    if (reasons.length) throw Object.assign(new CareerError(409, "Маршрут устарел: прогресс сохранён как история, соберите новый маршрут"), { errors: reasons });
    const rows = (await tx.query("SELECT * FROM career_v3_step_progress WHERE plan_version_id=$1 AND account_id=$2 AND lesson_id=$3 FOR UPDATE",
      [version.id, accountId, lessonId])).rows;
    if (!rows.length) throw new CareerError(404, "Этого урока нет в вашем маршруте");
    const lessonVersion = rows[0].lesson_version as string;
    const doc = bundle.library.published.find((l) => l.id === lessonId && l.version === lessonVersion)?.document;
    if (!doc) throw new CareerError(409, "Версия урока изменилась — соберите новый маршрут");
    const grade = gradeQuiz(doc.content.quiz as QuizQuestion[], answers);
    const prev = (await tx.query("SELECT passed, answers FROM career_v3_quiz_results WHERE plan_version_id=$1 AND account_id=$2 AND lesson_id=$3",
      [version.id, accountId, lessonId])).rows[0];
    // A passed mini-test stays passed; a later attempt is counted but never erases the earlier pass.
    const passed = grade.passed || prev?.passed === true;
    const keep = !grade.passed && prev?.passed === true;
    await tx.query(
      `INSERT INTO career_v3_quiz_results(plan_version_id,account_id,lesson_id,lesson_version,answers,correct,total,passed)
       VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
       ON CONFLICT(plan_version_id,lesson_id) DO UPDATE SET attempts=career_v3_quiz_results.attempts+1, updated_at=now(),
         answers=CASE WHEN $9 THEN career_v3_quiz_results.answers ELSE EXCLUDED.answers END,
         correct=CASE WHEN $9 THEN career_v3_quiz_results.correct ELSE EXCLUDED.correct END,
         passed=CASE WHEN $9 THEN career_v3_quiz_results.passed ELSE EXCLUDED.passed END`,
      [version.id, accountId, lessonId, lessonVersion, JSON.stringify(grade.answers), grade.correct, grade.total, grade.passed, keep],
    );
    for (const row of rows) {
      if (row.state === "done") continue;
      const state = deriveState({ started: !!row.started_at, criteriaMet: row.criteria_met as boolean[] | null, criteriaCount: row.criteria_count as number, quizPassed: passed, completedAt: null });
      if (state !== row.state) await tx.query("UPDATE career_v3_step_progress SET state=$3, updated_at=now() WHERE plan_version_id=$1 AND position=$2", [version.id, row.position, state]);
    }
    const attempts = (await tx.query("SELECT attempts FROM career_v3_quiz_results WHERE plan_version_id=$1 AND lesson_id=$2", [version.id, lessonId])).rows[0].attempts as number;
    return { lessonId, attempt: { correct: grade.correct, total: grade.total, passed: grade.passed, results: grade.results }, passed, attempts };
  });
}

export function completeStep(accountId: string, professionId: string, position: number, stableId: unknown, completionMet: unknown, d: Diagnostic) {
  return withStep(accountId, professionId, position, stableId, d, async (tx, { version, row, step }) => {
    // Idempotent: a repeated completion changes nothing and never counts twice.
    if (row.state === "done") return { ...stepView(row), alreadyDone: true };
    const met = checkBooleans(completionMet, step.completionCriteria.length, "Критерии выполнения шага");
    const passed = await quizPassed(tx, version.id, accountId, row.lesson_id, row.lesson_version);
    const state = deriveState({ started: !!row.started_at, criteriaMet: row.criteria_met as boolean[] | null, criteriaCount: row.criteria_count as number, quizPassed: passed, completedAt: null });
    const verdict = canComplete(state, step, met);
    if (!verdict.ok) throw new CareerError(409, verdict.reason!);
    const r = await tx.query(
      `UPDATE career_v3_step_progress SET state='done', completed_at=now(), completion_met=$3::jsonb, updated_at=now()
        WHERE plan_version_id=$1 AND position=$2 AND state<>'done' RETURNING *`,
      [version.id, position, JSON.stringify(met)],
    );
    const rest = (await tx.query("SELECT position, state FROM career_v3_step_progress WHERE plan_version_id=$1 ORDER BY position", [version.id])).rows;
    const next = resumePosition(null, rest.map((x) => ({ position: x.position as number, state: x.state as StepState })));
    await tx.query("UPDATE career_v3_plan_versions SET cursor_position=$2, updated_at=now() WHERE id=$1", [version.id, next ?? position]);
    await event("v3_step_completed", accountId, null, tx);
    return { ...stepView(r.rows[0]), alreadyDone: false, nextPosition: next };
  });
}

export { ProgressInputError };
export const defaultDb = () => careerPool();
