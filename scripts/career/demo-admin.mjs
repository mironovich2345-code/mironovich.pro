#!/usr/bin/env node
// Operator commands for the CLOSED CLOUD DEMO of AI Career 3.0. Refuses to run unless the full demo
// configuration is valid (lib/server/career-demo/config.ts) — the same fail-closed check the server uses.
// Run inside the demo service (Railway: `railway ssh` into ai-career-v3-demo, or as its pre-deploy command for migrate).
//   migrate                    apply migrations/career/*.sql to the demo DB (guards require the demo setting);
//                              then adds the optional one-time bootstrap invite from CAREER_V3_DEMO_BOOTSTRAP_INVITE
//   invite [label] [days]      create ONE one-time invite code (printed once, stored only as an HMAC digest)
//   reset <email>              one-time password reset code, valid 1 hour (after confirming the person out of band)
//   delete <email>             delete an account and all its data
//   purge                      retention: remove accounts 7 days after access ends, spent sessions and counters
//   revoke-invites             revoke every unused invite
//   status                     counts only (no emails)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../..", import.meta.url)));
if (existsSync(".env.career-demo.local")) process.loadEnvFile(".env.career-demo.local");
const cfg = await import("../../lib/server/career-demo/config.ts");
const problems = cfg.demoProblems();
if (problems.length) {
  console.error("Демо закрыто — команда не выполнена. Проблемы конфигурации:\n- " + problems.join("\n- "));
  process.exit(2);
}
const c = cfg.demoConfig();
const [cmd, a1, a2] = process.argv.slice(2);
if (cmd === "migrate") {
  const { Pool } = await import("pg");
  const p = new Pool({ connectionString: c.databaseUrl, max: 1 });
  const tx = await p.connect();
  try {
    await tx.query("BEGIN");
    const db = (await tx.query("SELECT current_database() AS n")).rows[0].n;
    if (db !== cfg.DEMO_DATABASE_NAME) throw new Error("подключение не к базе демо");
    await tx.query("SELECT set_config($1,$2,true)", [cfg.DEMO_MIGRATION_SETTING, cfg.DEMO_MIGRATION_VALUE]);
    for (const name of readdirSync("migrations/career").filter((n) => /^\d+.*\.sql$/.test(n)).sort())
      await tx.query(readFileSync("migrations/career/" + name, "utf8"));
    await tx.query("COMMIT");
    console.log("Схема закрытого демо готова");
    // Optional first invite from the Railway variable (value never printed): added once, never revived.
    const auth = await import("../../lib/server/career-demo/auth.ts");
    const { careerPool } = await import("../../lib/server/career/db.ts");
    const state = await auth.ensureBootstrapInvite(process.env.CAREER_V3_DEMO_BOOTSTRAP_INVITE);
    console.log({ absent: "Стартовое приглашение не задано", invalid: "Стартовое приглашение имеет неверный формат и пропущено", added: "Стартовое приглашение добавлено (действует 7 дней, одноразовое)", exists: "Стартовое приглашение уже было добавлено ранее" }[state]);
    await careerPool().end();
  } catch (e) {
    await tx.query("ROLLBACK");
    console.error("Миграция не выполнена:", e.message);
    process.exitCode = 1;
  } finally {
    tx.release();
    await p.end();
  }
  process.exit();
}
const auth = await import("../../lib/server/career-demo/auth.ts");
const { careerPool } = await import("../../lib/server/career/db.ts");
try {
  if (cmd === "invite") console.log(await auth.createInvite(a1 ?? "", a2 ? Number(a2) : 14));
  else if (cmd === "reset") { const code = a1 && (await auth.issueResetCode(a1)); console.log(code || "Аккаунт не найден"); }
  else if (cmd === "delete") console.log(a1 && (await auth.deleteByEmail(a1)) ? "Удалено" : "Аккаунт не найден");
  else if (cmd === "purge") console.log(JSON.stringify(await auth.purgeExpired()));
  else if (cmd === "revoke-invites") console.log("Отозвано: " + (await auth.revokeOpenInvites()));
  else if (cmd === "status") console.log(JSON.stringify(await auth.demoStatus()));
  else { console.error("Команды: migrate | invite [label] [days] | reset <email> | delete <email> | purge | revoke-invites | status"); process.exitCode = 1; }
} finally {
  await careerPool().end();
}
