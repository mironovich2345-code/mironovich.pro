import { randomUUID } from "node:crypto";
import { careerPool, transaction, event } from "./db.ts";
import { CareerError } from "./config.ts";
import {
  validateCareerAnswers,
  generateSyntheticAnalysis,
  type CareerResult,
} from "../../career-diagnostic.ts";
import { careerPdf } from "./pdf.ts";
export async function requireAccess(accountId: string, db = careerPool()) {
  const r = await db.query("SELECT * FROM career_accounts WHERE id=$1", [
    accountId,
  ]);
  const a = r.rows[0];
  if (!a || !a.access_until || new Date(a.access_until).getTime() <= Date.now())
    throw new CareerError(403, "Учебный доступ отсутствует или истёк");
  return a;
}
export async function saveDiagnostic(accountId: string, value: unknown) {
  const valid = validateCareerAnswers(value);
  if (!valid)
    throw new CareerError(
      400,
      "Требуются ровно 18 учебных ответов и 1–5 заданий из списка. Свободные/персональные данные не принимаются.",
    );
  await transaction(async (tx) => {
    const a = (
      await tx.query("SELECT * FROM career_accounts WHERE id=$1 FOR UPDATE", [
        accountId,
      ])
    ).rows[0];
    if (!a?.access_until || new Date(a.access_until).getTime() <= Date.now())
      throw new CareerError(403, "Нет действующего учебного доступа");
    if (a.analysis_consumed || a.analysis_state === "running")
      throw new CareerError(
        409,
        "Результат уже создан или создаётся; новый анализ не включён",
      );
    await tx.query(
      "INSERT INTO career_diagnostics(account_id,answers) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET answers=EXCLUDED.answers,updated_at=now()",
      [accountId, JSON.stringify(valid)],
    );
  });
  return { saved: true };
}
export async function createAnalysis(
  accountId: string,
  render: typeof careerPdf = careerPdf,
) {
  const token = randomUUID();
  const claim = await transaction(async (tx) => {
    const a = (
      await tx.query("SELECT * FROM career_accounts WHERE id=$1 FOR UPDATE", [
        accountId,
      ])
    ).rows[0];
    if (!a?.access_until || new Date(a.access_until).getTime() <= Date.now())
      throw new CareerError(403, "Нет действующего учебного доступа");
    if (a.analysis_consumed) {
      const r = await tx.query(
        "SELECT result FROM career_reports WHERE account_id=$1",
        [accountId],
      );
      if (!r.rowCount)
        throw new CareerError(410, "Ранее созданный результат удалён");
      return { existing: r.rows[0].result as CareerResult };
    }
    if (
      a.analysis_state === "running" &&
      new Date(a.analysis_lease_until).getTime() > Date.now()
    )
      return { pending: true };
    const d = await tx.query(
      "SELECT answers FROM career_diagnostics WHERE account_id=$1",
      [accountId],
    );
    const answers = validateCareerAnswers(d.rows[0]?.answers);
    if (!answers) throw new CareerError(400, "Сначала сохраните 18 ответов");
    await tx.query(
      "UPDATE career_accounts SET analysis_state='running',analysis_token=$2,analysis_lease_until=$3 WHERE id=$1",
      [accountId, token, new Date(Date.now() + 120000)],
    );
    return { answers };
  });
  if ("existing" in claim)
    return { status: "completed", result: claim.existing, reused: true };
  if ("pending" in claim) return { status: "running" };
  try {
    const result = generateSyntheticAnalysis(claim.answers!),
      pdf = await render(result);
    await transaction(async (tx) => {
      const a = (
        await tx.query("SELECT * FROM career_accounts WHERE id=$1 FOR UPDATE", [
          accountId,
        ])
      ).rows[0];
      if (a.analysis_token !== token || a.analysis_consumed)
        throw new CareerError(409, "Результат уже обработан");
      if (!a.access_until || new Date(a.access_until).getTime() <= Date.now())
        throw new CareerError(403, "Срок доступа истёк");
      await tx.query(
        "INSERT INTO career_reports(account_id,id,result,pdf) VALUES($1,$2,$3,$4)",
        [accountId, randomUUID(), JSON.stringify(result), pdf],
      );
      await tx.query(
        "UPDATE career_accounts SET analysis_consumed=true,analysis_state='completed',analysis_token=NULL,analysis_lease_until=NULL WHERE id=$1",
        [accountId],
      );
      await event("analysis_completed", accountId, null, tx);
    });
    return { status: "completed", result, reused: false };
  } catch (error) {
    await careerPool().query(
      "UPDATE career_accounts SET analysis_state='failed',analysis_token=NULL,analysis_lease_until=NULL WHERE id=$1 AND analysis_token=$2 AND NOT analysis_consumed",
      [accountId, token],
    );
    await event("analysis_failed", accountId);
    throw error;
  }
}
export async function readPdf(accountId: string) {
  await requireAccess(accountId);
  const r = await careerPool().query(
    "SELECT pdf FROM career_reports WHERE account_id=$1",
    [accountId],
  );
  if (!r.rowCount) throw new CareerError(404, "Отчёт не создан");
  return r.rows[0].pdf as Buffer;
}
export async function dashboard(accountId: string) {
  const [a, o, d, r, p] = await Promise.all([
    careerPool().query(
      "SELECT email,access_started_at,access_until,analysis_consumed,analysis_state,grant_order_id FROM career_accounts WHERE id=$1",
      [accountId],
    ),
    careerPool().query(
      "SELECT id,kind,amount_kopeks,status,created_at,paid_at,confirmation_url FROM career_orders WHERE account_id=$1 ORDER BY created_at DESC",
      [accountId],
    ),
    careerPool().query(
      "SELECT answers FROM career_diagnostics WHERE account_id=$1",
      [accountId],
    ),
    careerPool().query(
      "SELECT result FROM career_reports WHERE account_id=$1",
      [accountId],
    ),
    careerPool().query(
      "SELECT day,done FROM career_progress WHERE account_id=$1 ORDER BY day",
      [accountId],
    ),
  ]);
  const account = a.rows[0];
  const active =
    account?.access_until &&
    new Date(account.access_until).getTime() > Date.now();
  return {
    account,
    orders: o.rows.map((x) => ({
      id: x.id,
      kind: x.kind,
      amountKopeks: x.amount_kopeks,
      status: x.status,
      createdAt: x.created_at,
      paidAt: x.paid_at,
      confirmationUrl: x.confirmation_url,
    })),
    answers: active ? d.rows[0]?.answers : null,
    result: active ? r.rows[0]?.result : null,
    reportRetained: !!r.rowCount,
    progress: active ? p.rows : [],
    active: !!active,
    synthetic: true,
  };
}
export async function updateProgress(
  accountId: string,
  day: unknown,
  done: unknown,
) {
  await requireAccess(accountId);
  if (
    !Number.isInteger(day) ||
    Number(day) < 1 ||
    Number(day) > 30 ||
    typeof done !== "boolean"
  )
    throw new CareerError(400, "Неверный номер шага");
  if (
    !(
      await careerPool().query(
        "SELECT 1 FROM career_reports WHERE account_id=$1",
        [accountId],
      )
    ).rowCount
  )
    throw new CareerError(409, "Сначала создайте план");
  await careerPool().query(
    "INSERT INTO career_progress(account_id,day,done) VALUES($1,$2,$3) ON CONFLICT(account_id,day) DO UPDATE SET done=EXCLUDED.done",
    [accountId, day, done],
  );
  return { saved: true };
}
