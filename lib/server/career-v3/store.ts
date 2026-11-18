// Persistence for AI Career 3.0 diagnostic results (table career_v3_diagnostics, migration 005).
// Reuses the synthetic sandbox database pool and account model; never touches v2 tables.
import { careerPool, event } from "../career/db.ts";
import { CareerError } from "../career/config.ts";
import { evaluateDiagnostic, taskShortlist, validateAnswers, DIAGNOSTIC_RESULT_MODEL, type DiagnosticResultV3 } from "../../career-v3/diagnostic.ts";
import { loadProfessionBundle } from "./content.ts";
import { resultOutdatedReasons } from "../../career-v3/engine.ts";
import { buildTaskMap, taskMapStaleReasons } from "../../career-v3/task-map.ts";
import { selectLessons } from "../../career-v3/selection.ts";
import { buildPlan, planStaleReasons } from "../../career-v3/plan.ts";
import type { PlanV3, TaskMapV3 } from "../../career-v3/contracts.ts";
import type { DiagnosticAnswers } from "../../career-v3/types.ts";

type Queryable = { query: (q: string, args?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

export async function requireV3Access(accountId: string, db: Queryable = careerPool()) {
  const r = await db.query("SELECT access_until FROM career_accounts WHERE id=$1", [accountId]);
  const until = r.rows[0]?.access_until as string | Date | null | undefined;
  if (!until || new Date(until).getTime() <= Date.now()) throw new CareerError(403, "Учебный доступ отсутствует или истёк");
}

function bundleOrFail(professionId: string) {
  const bundle = loadProfessionBundle(professionId);
  if (bundle.configIssues.length) throw new CareerError(503, "Конфигурация диагностики v3 не прошла проверку");
  return bundle;
}

export function taskOptionsFor(professionId: string, answers: unknown) {
  const bundle = bundleOrFail(professionId);
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new CareerError(400, "Неверные ответы");
  return { options: taskShortlist(bundle.diagnostic, answers as Record<string, string | string[]>).map(({ value, label }) => ({ value, label })) };
}

export async function saveV3Diagnostic(accountId: string, professionId: string, answers: unknown, db: Queryable = careerPool()) {
  await requireV3Access(accountId, db);
  const bundle = bundleOrFail(professionId);
  const today = new Date().toISOString().slice(0, 10);
  const checked = validateAnswers(bundle.diagnostic, answers);
  if (!checked.ok) throw Object.assign(new CareerError(400, "Ответы не прошли проверку"), { errors: checked.errors });
  let result: DiagnosticResultV3;
  try {
    result = evaluateDiagnostic(bundle.diagnostic, answers, today);
  } catch (e) {
    const errors = (e as { errors?: unknown }).errors;
    if (errors) throw Object.assign(new CareerError(400, "Ответы не прошли проверку"), { errors });
    throw new CareerError(503, "Диагностика v3 недоступна");
  }
  const r = await db.query(
    `INSERT INTO career_v3_diagnostics(account_id,profession_id,model_version,diagnostic_version,content_hash,answers,result)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
     ON CONFLICT(account_id,profession_id) DO UPDATE SET model_version=EXCLUDED.model_version,
       diagnostic_version=EXCLUDED.diagnostic_version, content_hash=EXCLUDED.content_hash,
       answers=EXCLUDED.answers, result=EXCLUDED.result, updated_at=now()
     RETURNING updated_at`,
    [accountId, professionId, DIAGNOSTIC_RESULT_MODEL, result.diagnosticVersion, bundle.contentHash,
      JSON.stringify(checked.answers), JSON.stringify(result)],
  );
  await event("v3_diagnostic_saved", accountId, null, db as Parameters<typeof event>[3]);
  return { result, savedAt: new Date(r.rows[0].updated_at as string).toISOString() };
}

interface StoredDiagnostic {
  result: DiagnosticResultV3;
  answers: DiagnosticAnswers;
  savedAt: string;
  stale: boolean;
  staleReasons: string[];
  contentChanged: boolean;
}

async function loadDiagnostic(accountId: string, professionId: string, db: Queryable): Promise<StoredDiagnostic | null> {
  const r = await db.query(
    "SELECT result, answers, content_hash, updated_at FROM career_v3_diagnostics WHERE account_id=$1 AND profession_id=$2",
    [accountId, professionId],
  );
  const row = r.rows[0];
  if (!row) return null;
  const bundle = loadProfessionBundle(professionId);
  const result = row.result as DiagnosticResultV3;
  const staleReasons = resultOutdatedReasons(bundle.engine, result);
  return {
    result, answers: row.answers as DiagnosticAnswers, savedAt: new Date(row.updated_at as string).toISOString(),
    stale: staleReasons.length > 0, staleReasons, contentChanged: row.content_hash !== bundle.contentHash,
  };
}

/** stale: the questionnaire, role matrix or result model changed — the diagnostic must be retaken. */
export async function readV3Diagnostic(accountId: string, professionId: string, db: Queryable = careerPool()) {
  await requireV3Access(accountId, db);
  const d = await loadDiagnostic(accountId, professionId, db);
  if (!d) return { result: null, stale: false, staleReasons: [], contentChanged: false };
  return { result: d.result, stale: d.stale, staleReasons: d.staleReasons, contentChanged: d.contentChanged };
}

async function usableDiagnostic(accountId: string, professionId: string, db: Queryable) {
  await requireV3Access(accountId, db);
  const d = await loadDiagnostic(accountId, professionId, db);
  if (!d) throw new CareerError(409, "Сначала пройдите диагностику");
  if (d.stale) throw Object.assign(new CareerError(409, "Диагностика устарела: пройдите её заново"), { errors: d.staleReasons });
  return d;
}

async function saveArtifact(db: Queryable, accountId: string, professionId: string, kind: "task_map" | "plan", modelVersion: string, diagnosticSavedAt: string, payload: unknown) {
  const r = await db.query(
    `INSERT INTO career_v3_artifacts(account_id,profession_id,kind,model_version,diagnostic_saved_at,payload)
     VALUES($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT(account_id,profession_id,kind) DO UPDATE SET model_version=EXCLUDED.model_version,
       diagnostic_saved_at=EXCLUDED.diagnostic_saved_at, payload=EXCLUDED.payload, updated_at=now()
     RETURNING updated_at`,
    [accountId, professionId, kind, modelVersion, diagnosticSavedAt, JSON.stringify(payload)],
  );
  return new Date(r.rows[0].updated_at as string).toISOString();
}

async function readArtifact(db: Queryable, accountId: string, professionId: string, kind: "task_map" | "plan") {
  const r = await db.query(
    "SELECT payload, diagnostic_saved_at FROM career_v3_artifacts WHERE account_id=$1 AND profession_id=$2 AND kind=$3",
    [accountId, professionId, kind],
  );
  const row = r.rows[0];
  return row ? { payload: row.payload, diagnosticSavedAt: new Date(row.diagnostic_saved_at as string).toISOString() } : null;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function saveV3TaskMap(accountId: string, professionId: string, db: Queryable = careerPool()) {
  const d = await usableDiagnostic(accountId, professionId, db);
  const bundle = bundleOrFail(professionId);
  const taskMap = buildTaskMap(bundle.engine, { result: d.result, answers: d.answers, library: bundle.library, today: today() });
  const savedAt = await saveArtifact(db, accountId, professionId, "task_map", taskMap.modelVersion, d.savedAt, taskMap);
  return { taskMap, savedAt };
}

export async function readV3TaskMap(accountId: string, professionId: string, db: Queryable = careerPool()) {
  await requireV3Access(accountId, db);
  const a = await readArtifact(db, accountId, professionId, "task_map");
  if (!a) return { taskMap: null, stale: false, staleReasons: [] };
  const bundle = loadProfessionBundle(professionId);
  const d = await loadDiagnostic(accountId, professionId, db);
  const reasons = taskMapStaleReasons(a.payload as TaskMapV3, bundle.engine, bundle.library);
  if (!d || d.savedAt !== a.diagnosticSavedAt) reasons.push("diagnostic_resubmitted");
  return { taskMap: a.payload as TaskMapV3, stale: reasons.length > 0, staleReasons: reasons };
}

export async function v3LessonSelection(accountId: string, professionId: string, db: Queryable = careerPool()) {
  const d = await usableDiagnostic(accountId, professionId, db);
  const bundle = bundleOrFail(professionId);
  return selectLessons(bundle.engine, d.result, bundle.library);
}

export async function saveV3Plan(accountId: string, professionId: string, db: Queryable = careerPool()) {
  const d = await usableDiagnostic(accountId, professionId, db);
  const bundle = bundleOrFail(professionId);
  const selection = selectLessons(bundle.engine, d.result, bundle.library);
  const plan = buildPlan(bundle.engine, { result: d.result, selection, library: bundle.library, today: today() });
  // An unavailable plan is returned but never stored as if it were a plan.
  const savedAt = plan.status === "ready" ? await saveArtifact(db, accountId, professionId, "plan", plan.modelVersion, d.savedAt, plan) : null;
  return { plan, savedAt };
}

export async function readV3Plan(accountId: string, professionId: string, db: Queryable = careerPool()) {
  await requireV3Access(accountId, db);
  const a = await readArtifact(db, accountId, professionId, "plan");
  if (!a) return { plan: null, stale: false, staleReasons: [] };
  const bundle = loadProfessionBundle(professionId);
  const d = await loadDiagnostic(accountId, professionId, db);
  const reasons = planStaleReasons(a.payload as PlanV3, bundle.engine, bundle.library);
  if (!d || d.savedAt !== a.diagnosticSavedAt) reasons.push("diagnostic_resubmitted");
  return { plan: a.payload as PlanV3, stale: reasons.length > 0, staleReasons: reasons };
}
