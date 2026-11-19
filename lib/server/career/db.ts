import { Pool, type PoolClient } from "pg";
import { careerConfig } from "./config.ts";
import { demoConfig } from "../career-demo/config.ts";
let pool: Pool | undefined;
// The closed cloud demo (lib/server/career-demo/config.ts) has its own fully validated database;
// otherwise the synthetic sandbox configuration applies unchanged (and throws outside the sandbox).
export function careerPool() {
  const databaseUrl = demoConfig()?.databaseUrl ?? careerConfig().databaseUrl;
  if (!pool)
    pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
  return pool;
}
export async function transaction<T>(
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  const tx = await careerPool().connect();
  try {
    await tx.query("BEGIN");
    const value = await fn(tx);
    await tx.query("COMMIT");
    return value;
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}
export async function event(
  code: string,
  accountId: string | null = null,
  orderId: string | null = null,
  db: Pick<PoolClient, "query"> = careerPool(),
) {
  await db.query(
    "INSERT INTO career_events(code,account_id,order_id) VALUES($1,$2,$3)",
    [code, accountId, orderId],
  );
}
