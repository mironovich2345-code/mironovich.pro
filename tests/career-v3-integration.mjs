// AI Career 3.0 persistence integration. Same dedicated local synthetic PostgreSQL / fake SMTP /
// fake payment provider as tests/career-integration.mjs. No real provider calls, no real data.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
process.loadEnvFile(".env.career.local");
const { careerConfig } = await import("../lib/server/career/config.ts");
const cfg = careerConfig();
assert(cfg.local && cfg.mode === "fixture");
const { careerPool } = await import("../lib/server/career/db.ts");
const auth = await import("../lib/server/career/auth.ts");
const orders = await import("../lib/server/career/orders.ts");
const { completeLocalFixture } = await import("../lib/server/career/payments.ts");
const store = await import("../lib/server/career-v3/store.ts");
const db = careerPool();
const fixtures = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8"));
let checks = 0;
const pass = (name) => { checks++; console.log("PASS", name); };
const sql = (q, args = []) => db.query(q, args);

async function login() {
  const email = `demo-${randomUUID().slice(0, 12)}@example.invalid`;
  const otp = await auth.requestOtp(email);
  const r = await fetch(new URL("/fixture/mail/" + encodeURIComponent(email), process.env.CAREER_PROVIDER_FIXTURE_URL),
    { headers: { "x-fixture-key": process.env.CAREER_FIXTURE_CONTROL_SECRET } });
  const { code } = await r.json();
  const token = await auth.verifyOtp(otp.challengeId, code);
  return auth.sessionAccount(token);
}
async function withAccess(id) {
  const o = await orders.createOrder(id, "initial", true, true);
  const row = (await sql("SELECT payment_id FROM career_orders WHERE id=$1", [o.id])).rows[0];
  await completeLocalFixture(row.payment_id);
  await orders.webhookPayment(row.payment_id);
}

try {
  const v2Before = (await sql("SELECT count(*)::int AS n FROM career_diagnostics")).rows[0].n;
  const noAccess = await login();
  await assert.rejects(store.saveV3Diagnostic(noAccess, "sales_manager", fixtures.profiles[0].answers), (e) => e.status === 403);
  pass("v3 diagnostic requires an active synthetic access grant");

  const id = await login();
  await withAccess(id);
  await assert.rejects(store.saveV3Diagnostic(id, "sales_manager", { Q01: "inbound", Q05: "ООО Пример, +7 900 000 00 00" }),
    (e) => e.status === 400 && Array.isArray(e.errors) && e.errors.some((x) => x.questionId === "Q05" && x.code === "invalid_option"));
  assert.equal((await sql("SELECT count(*)::int AS n FROM career_v3_diagnostics WHERE account_id=$1", [id])).rows[0].n, 0);
  pass("server rejects free text and incomplete answers without persisting anything");

  await assert.rejects(store.saveV3Diagnostic(id, "accountant", fixtures.profiles[0].answers), (e) => e.status === 404);
  pass("non-pilot profession is refused");

  const results = [];
  for (const p of fixtures.profiles) {
    const account = p === fixtures.profiles[0] ? id : await login();
    if (account !== id) await withAccess(account);
    const saved = await store.saveV3Diagnostic(account, "sales_manager", p.answers);
    const read = await store.readV3Diagnostic(account, "sales_manager");
    assert.deepEqual(read.result, saved.result);
    assert.equal(read.stale, false);
    const row = (await sql("SELECT model_version, content_hash, synthetic, answers FROM career_v3_diagnostics WHERE account_id=$1", [account])).rows[0];
    assert.equal(row.model_version, "career-v3-diagnostic-result/1");
    assert.match(row.content_hash, /^[a-f0-9]{64}$/);
    assert.equal(row.synthetic, true);
    assert.deepEqual(Object.keys(row.answers).sort(), Object.keys(p.answers).sort());
    results.push(saved.result);
  }
  assert.deepEqual(results.map((r) => r.safety.mode), ["approved_tools_public_data", "synthetic_only", "synthetic_only"]);
  pass("three synthetic profiles persist versioned, differing v3 results");

  const again = await store.saveV3Diagnostic(id, "sales_manager", fixtures.profiles[0].answers);
  assert.ok(again.savedAt);
  assert.equal((await sql("SELECT count(*)::int AS n FROM career_v3_diagnostics WHERE account_id=$1", [id])).rows[0].n, 1);
  pass("re-submission updates one row per account and profession");

  await sql("UPDATE career_v3_diagnostics SET content_hash=$2 WHERE account_id=$1", [id, "0".repeat(64)]);
  assert.equal((await store.readV3Diagnostic(id, "sales_manager")).stale, true);
  pass("results computed on older content are flagged stale");

  assert.equal((await sql("SELECT count(*)::int AS n FROM career_diagnostics")).rows[0].n, v2Before);
  pass("v2 career_diagnostics table is untouched by v3");

  await assert.rejects(sql("INSERT INTO career_v3_diagnostics(account_id,profession_id,model_version,diagnostic_version,content_hash,answers,result,synthetic) VALUES($1,'sales_manager','career-v3-diagnostic-result/1','x',$2,'{}','{}',false)", [id, "a".repeat(64)]));
  pass("database refuses non-synthetic v3 rows");
  console.log(`v3 integration: ${checks} checks passed`);
} finally {
  await db.end();
}
