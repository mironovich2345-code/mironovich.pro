import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../..", import.meta.url)));
if (existsSync(".env.career.local")) process.loadEnvFile(".env.career.local");
const { careerConfig } = await import("../../lib/server/career/config.ts");
const c = careerConfig();
const { Pool } = await import("pg");
const run = (args) => {
  const r = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(r.status ?? 1);
};
switch (process.argv[2]) {
  case "migrate": {
    const p = new Pool({ connectionString: c.databaseUrl, max: 1 });
    const tx = await p.connect();
    try {
      await tx.query("BEGIN");
      for (const name of readdirSync("migrations/career")
        .filter((n) => /^\d+.*\.sql$/.test(n))
        .sort())
        await tx.query(readFileSync("migrations/career/" + name, "utf8"));
      await tx.query("COMMIT");
      console.log("Synthetic career schema ready");
    } catch (e) {
      await tx.query("ROLLBACK");
      throw e;
    } finally {
      tx.release();
      await p.end();
    }
    break;
  }
  case "cleanup": {
    const p = new Pool({ connectionString: c.databaseUrl, max: 1 });
    const tx = await p.connect();
    try {
      await tx.query("BEGIN");
      await tx.query(
        "DELETE FROM career_reports USING career_accounts a WHERE career_reports.account_id=a.id AND a.access_until < now()-interval '30 days'",
      );
      await tx.query(
        "DELETE FROM career_diagnostics USING career_accounts a WHERE career_diagnostics.account_id=a.id AND a.access_until < now()-interval '30 days'",
      );
      await tx.query(
        "DELETE FROM career_progress USING career_accounts a WHERE career_progress.account_id=a.id AND a.access_until < now()-interval '30 days'",
      );
      await tx.query(
        "DELETE FROM career_otp WHERE expires_at < now()-interval '1 day'",
      );
      await tx.query(
        "DELETE FROM career_sessions WHERE expires_at < now() OR revoked_at IS NOT NULL",
      );
      await tx.query(
        "DELETE FROM career_rate_buckets WHERE expires_at < now()",
      );
      await tx.query("COMMIT");
      console.log("Synthetic retention cleanup completed");
    } catch (e) {
      await tx.query("ROLLBACK");
      throw e;
    } finally {
      tx.release();
      await p.end();
    }
    break;
  }
  case "mail": {
    const { flushCareerMail } = await import("../../lib/server/career/mail.ts");
    const { careerPool } = await import("../../lib/server/career/db.ts");
    try {
      await flushCareerMail();
      console.log("Synthetic mail outbox processed");
    } finally {
      await careerPool().end();
    }
    break;
  }
  case "build":
    process.env.NEXT_PUBLIC_SITE_URL = c.origin;
    process.env.NEXT_PUBLIC_YANDEX_METRICA_ID = "";
    run(["node_modules/next/dist/bin/next", "build"]);
    break;
  case "start":
    process.env.NEXT_PUBLIC_SITE_URL = c.origin;
    process.env.NEXT_PUBLIC_YANDEX_METRICA_ID = "";
    run([
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      c.local ? "127.0.0.1" : "0.0.0.0",
      "--port",
      process.env.PORT || new URL(c.origin).port || "3000",
    ]);
    break;
  default:
    throw Error(
      "Usage: node --experimental-strip-types scripts/career/runtime.mjs migrate|build|start|cleanup|mail",
    );
}
