import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { processAnalysisPolicy as policy } from "../../config/process-analysis.ts";

export type AnalysisUsage = { inputTokens: number; outputTokens: number };
export type AnalysisOutcome = "completed" | "refusal" | "invalid" | "failed";
export interface AnalysisBudget {
  reserve(): Promise<{ ok: true; id: string } | { ok: false; reason: "limit" | "unavailable" }>;
  finish(id: string, outcome: AnalysisOutcome, usage: AnalysisUsage | null): Promise<void>;
  trip(): Promise<void>;
}
export const usageMicroUsd = (u: AnalysisUsage): number => Math.ceil((u.inputTokens * policy.inputMicroUsdPerMillion + u.outputTokens * policy.outputMicroUsdPerMillion) / 1_000_000);

/** One shared PostgreSQL ledger; reservations are never refunded, even on timeout.
 * No visitor IDs, IPs, request text or model text are stored. */
export class PostgresAnalysisBudget implements AnalysisBudget {
  private pool: Pool;
  private budgetId: string;
  constructor(pool: Pool, budgetId: string) { this.pool = pool; this.budgetId = budgetId; }
  async reserve(): ReturnType<AnalysisBudget["reserve"]> {
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");
      // All replicas lock the same pre-provisioned row. Never create/replenish it in application code.
      const { rows } = await client.query(`SELECT *, clock_timestamp() AS db_now FROM process_analysis_budgets WHERE id=$1 FOR UPDATE`, [this.budgetId]);
      const b = rows[0];
      if (!b || !b.enabled || b.model !== policy.model || Number(b.reservation_micro_usd) !== policy.reservationMicroUsd || b.db_now < b.starts_at || b.db_now >= b.ends_at) {
        await client.query("ROLLBACK"); return { ok: false, reason: "unavailable" };
      }
      const { rows: [counts] } = await client.query(`SELECT
        count(*) FILTER (WHERE created_at >= clock_timestamp()-interval '60 seconds')::int AS recent,
        count(*) FILTER (WHERE created_at >= date_trunc('day',clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS daily,
        count(*) FILTER (WHERE outcome='reserved' AND lease_until>clock_timestamp())::int AS active
        FROM process_analysis_reservations WHERE budget_id=$1`, [this.budgetId]);
      if (Number(b.used_requests) >= Number(b.max_requests) || Number(b.reserved_micro_usd) + policy.reservationMicroUsd > Number(b.max_micro_usd) || counts.recent >= 5 || counts.daily >= 30 || counts.active >= 2) {
        await client.query("ROLLBACK"); return { ok: false, reason: "limit" };
      }
      const id = randomUUID();
      await client.query("UPDATE process_analysis_budgets SET used_requests=used_requests+1, reserved_micro_usd=reserved_micro_usd+$2 WHERE id=$1", [this.budgetId, policy.reservationMicroUsd]);
      await client.query(`INSERT INTO process_analysis_reservations(id,budget_id,reserved_micro_usd) VALUES($1,$2,$3)`, [id, this.budgetId, policy.reservationMicroUsd]);
      await client.query("COMMIT");
      return { ok: true, id };
    } catch {
      if (client) await client.query("ROLLBACK").catch(() => {});
      return { ok: false, reason: "unavailable" };
    } finally { client?.release(); }
  }
  async finish(id: string, outcome: AnalysisOutcome, usage: AnalysisUsage | null) {
    await this.pool.query(`UPDATE process_analysis_reservations SET outcome=$3, input_tokens=$4, output_tokens=$5, usage_micro_usd=$6 WHERE id=$1 AND budget_id=$2 AND outcome='reserved'`, [id, this.budgetId, outcome, usage?.inputTokens ?? null, usage?.outputTokens ?? null, usage ? usageMicroUsd(usage) : null]);
  }
  async trip() { await this.pool.query("UPDATE process_analysis_budgets SET enabled=false WHERE id=$1", [this.budgetId]); }
}

let shared: AnalysisBudget | undefined;
export function sharedAnalysisBudget(env: Readonly<Record<string, string | undefined>>): AnalysisBudget {
  if (shared) return shared;
  const connectionString = env.PROCESS_ANALYSIS_DATABASE_URL;
  if (!connectionString) throw new Error("budget_unconfigured");
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // Use the configured CA trust; never disable certificate verification for a remote database.
  if (!local && ["disable", "no-verify", "prefer", "allow"].includes(url.searchParams.get("sslmode") ?? "")) throw new Error("budget_tls_required");
  // pg connection-string SSL options must not override rejectUnauthorized.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  const pool = new Pool({ connectionString: url.toString(), ssl: local ? false : { rejectUnauthorized: true }, max: 3, connectionTimeoutMillis: 2000, query_timeout: 2000, statement_timeout: 2000, idle_in_transaction_session_timeout: 3000 });
  pool.on("error", () => { /* No raw driver errors: they may include credentials. Reserve fails closed. */ });
  shared = new PostgresAnalysisBudget(pool, env.PROCESS_ANALYSIS_BUDGET_ID ?? "");
  return shared;
}
