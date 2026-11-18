// Persistence for AI Career 3.0 diagnostic results (table career_v3_diagnostics, migration 005).
// Reuses the synthetic sandbox database pool and account model; never touches v2 tables.
import { careerPool, event } from "../career/db.ts";
import { CareerError } from "../career/config.ts";
import { evaluateDiagnostic, taskShortlist, validateAnswers, DIAGNOSTIC_RESULT_MODEL, type DiagnosticResultV3 } from "../../career-v3/diagnostic.ts";
import { loadProfessionBundle } from "./content.ts";

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

export async function readV3Diagnostic(accountId: string, professionId: string, db: Queryable = careerPool()) {
  await requireV3Access(accountId, db);
  const r = await db.query(
    "SELECT result, content_hash FROM career_v3_diagnostics WHERE account_id=$1 AND profession_id=$2",
    [accountId, professionId],
  );
  const row = r.rows[0];
  if (!row) return { result: null, stale: false };
  const current = loadProfessionBundle(professionId).contentHash;
  return { result: row.result as DiagnosticResultV3, stale: row.content_hash !== current };
}
