// Dedicated local synthetic PostgreSQL/SMTP/provider required. No real provider calls.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
process.loadEnvFile(".env.career.local");
const { careerConfig } = await import("../lib/server/career/config.ts");
const cfg = careerConfig();
assert(cfg.local && cfg.mode === "fixture");
const { careerPool } = await import("../lib/server/career/db.ts");
const db = careerPool();
const auth = await import("../lib/server/career/auth.ts"),
  orders = await import("../lib/server/career/orders.ts"),
  analysis = await import("../lib/server/career/analysis.ts");
const { syntheticAnswers } = await import("../lib/career-diagnostic.ts");
const { completeLocalFixture } =
  await import("../lib/server/career/payments.ts");
let checks = 0;
const pass = (name) => {
  checks++;
  console.log("PASS", name);
};
const sql = (q, args = []) => db.query(q, args);
const count = async (q, args = []) => (await sql(q, args)).rows[0].n;
const fakeEmail = () => `demo-${randomUUID().slice(0, 12)}@example.invalid`;
async function mailCode(email) {
  const r = await fetch(
    new URL(
      "/fixture/mail/" + encodeURIComponent(email),
      process.env.CAREER_PROVIDER_FIXTURE_URL,
    ),
    { headers: { "x-fixture-key": process.env.CAREER_FIXTURE_CONTROL_SECRET } },
  );
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.match(b.code, /^\d{6}$/);
  return b.code;
}
async function login() {
  const email = fakeEmail(),
    otp = await auth.requestOtp(email),
    code = await mailCode(email),
    token = await auth.verifyOtp(otp.challengeId, code),
    id = await auth.sessionAccount(token);
  assert(id);
  return { email, otp, code, token, id };
}
try {
  assert.equal(auth.validGate(undefined), false);
  await assert.rejects(
    auth.admitTester("wrong", true),
    (e) => e.status === 403,
  );
  const gate = await auth.admitTester(process.env.CAREER_TESTER_SECRET, true);
  assert(auth.validGate(gate));
  assert.equal(auth.validGate(gate.replace(/.$/, "x")), false);
  pass("Tester gate, forged signatures and default denial");
  const before = await count("SELECT count(*)::int AS n FROM career_otp");
  await assert.rejects(
    auth.requestOtp("actual-person@example.com"),
    (e) => e.status === 400,
  );
  assert.equal(
    await count("SELECT count(*)::int AS n FROM career_otp"),
    before,
  );
  pass("Real email rejected before storage/SMTP");
  const a = await login();
  const otpRow = (
    await sql("SELECT * FROM career_otp WHERE id=$1", [a.otp.challengeId])
  ).rows[0];
  assert.notEqual(otpRow.code_hash, a.code);
  assert.equal(otpRow.code_hash.length, 64);
  assert(otpRow.consumed_at);
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_sessions WHERE token_hash=$1",
      [a.token],
    ),
    0,
  );
  await assert.rejects(
    auth.verifyOtp(a.otp.challengeId, a.code),
    (e) => e.status === 400,
  );
  pass("SMTP OTP consumed once; hashes only, session secret never stored");
  const badEmail = fakeEmail(),
    bad = await auth.requestOtp(badEmail),
    correct = await mailCode(badEmail),
    wrong = correct === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      auth.verifyOtp(bad.challengeId, wrong),
      (e) => e.status === 400,
    );
  await assert.rejects(
    auth.verifyOtp(bad.challengeId, correct),
    (e) => e.status === 400,
  );
  assert.equal(
    (
      await sql("SELECT attempts FROM career_otp WHERE id=$1", [
        bad.challengeId,
      ])
    ).rows[0].attempts,
    5,
  );
  pass("Five-attempt lock persists across failed transactions");
  const expiredEmail = fakeEmail(),
    exp = await auth.requestOtp(expiredEmail),
    expiredCode = await mailCode(expiredEmail);
  await sql(
    "UPDATE career_otp SET expires_at=now()-interval '1 second' WHERE id=$1",
    [exp.challengeId],
  );
  await assert.rejects(
    auth.verifyOtp(exp.challengeId, expiredCode),
    (e) => e.status === 400,
  );
  await assert.rejects(auth.requestOtp(expiredEmail), (e) => e.status === 429);
  pass("OTP TTL and resend cooldown enforced");
  await assert.rejects(
    orders.createOrder(a.id, "initial", false, true),
    (e) => e.status === 400,
  );
  await assert.rejects(
    orders.createOrder(a.id, "initial", true, false),
    (e) => e.status === 400,
  );
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_orders WHERE account_id=$1",
      [a.id],
    ),
    0,
  );
  pass("Adult and offer are independent required confirmations");
  const created = await Promise.all(
    [1, 2, 3].map(() => orders.createOrder(a.id, "initial", true, true)),
  );
  assert(created.every((o) => o.id === created[0].id));
  const orderId = created[0].id;
  let o = (await sql("SELECT * FROM career_orders WHERE id=$1", [orderId]))
    .rows[0];
  assert.equal(o.amount_kopeks, 199300);
  assert.equal(o.test, true);
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_confirmations WHERE order_id=$1",
      [orderId],
    ),
    2,
  );
  pass(
    "Concurrent create retries share one durable order/key/payment and two consent records",
  );
  await orders.webhookPayment(o.payment_id);
  assert.equal((await analysis.dashboard(a.id)).active, false);
  await assert.rejects(analysis.readPdf(a.id), (e) => e.status === 403);
  pass("Spoofed success notification and return cannot grant pending access");
  const b = await login();
  await assert.rejects(
    orders.refreshOrder(b.id, orderId),
    (e) => e.status === 404,
  );
  pass("Foreign order inaccessible even to another valid session");
  await completeLocalFixture(o.payment_id);
  await Promise.all([
    orders.webhookPayment(o.payment_id),
    orders.refreshOrder(a.id, orderId),
    orders.webhookPayment(o.payment_id),
  ]);
  let account = (await sql("SELECT * FROM career_accounts WHERE id=$1", [a.id]))
    .rows[0];
  assert.equal(
    new Date(account.access_until) - new Date(account.access_started_at),
    90 * 86400000,
  );
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_grants WHERE order_id=$1",
      [orderId],
    ),
    1,
  );
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_events WHERE order_id=$1 AND code='test_access_granted'",
      [orderId],
    ),
    1,
  );
  pass(
    "Independent GET + repeated webhook grants exactly one 90-day test entitlement",
  );
  await assert.rejects(
    analysis.saveDiagnostic(a.id, {
      questions: { role: "Personal free text" },
      tasks: ["table"],
    }),
    (e) => e.status === 400,
  );
  await assert.rejects(analysis.createAnalysis(a.id), (e) => e.status === 400);
  await analysis.saveDiagnostic(a.id, syntheticAnswers());
  pass("No free-text/partial diagnostics; exactly 18 coded answers required");
  await assert.rejects(
    analysis.createAnalysis(a.id, async () => {
      throw Error("synthetic_renderer_failure");
    }),
  );
  account = (await sql("SELECT * FROM career_accounts WHERE id=$1", [a.id]))
    .rows[0];
  assert.equal(account.analysis_consumed, false);
  assert.equal(account.analysis_state, "failed");
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_reports WHERE account_id=$1",
      [a.id],
    ),
    0,
  );
  pass("Technical PDF failure rolls back consumption and permits a retry");
  await Promise.all([
    analysis.createAnalysis(a.id),
    analysis.createAnalysis(a.id),
  ]);
  const existing = await analysis.createAnalysis(a.id);
  assert(existing.reused);
  assert.equal(existing.result.plan.length, 30);
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_reports WHERE account_id=$1",
      [a.id],
    ),
    1,
  );
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_events WHERE account_id=$1 AND code='analysis_completed'",
      [a.id],
    ),
    1,
  );
  await assert.rejects(
    analysis.saveDiagnostic(a.id, syntheticAnswers()),
    (e) => e.status === 409,
  );
  await assert.rejects(
    orders.createOrder(a.id, "initial", true, true),
    (e) => e.status === 409,
  );
  pass(
    "One successful report; retries/concurrency/changed inputs cannot consume or buy another analysis",
  );
  const pdf = await analysis.readPdf(a.id);
  assert.match(pdf.subarray(0, 8).toString(), /^%PDF-/);
  writeFileSync("/tmp/mironovich-career-synthetic-report.pdf", pdf);
  await assert.rejects(analysis.readPdf(b.id), (e) => e.status === 403);
  await analysis.updateProgress(a.id, 1, true);
  assert(
    (await analysis.dashboard(a.id)).progress.some(
      (p) => p.day === 1 && p.done,
    ),
  );
  await assert.rejects(
    analysis.updateProgress(a.id, 31, true),
    (e) => e.status === 400,
  );
  pass(
    "Private Unicode PDF and persisted plan progress; foreign account denied",
  );
  const originalUntil = new Date(account.access_until);
  const ext = await orders.createOrder(a.id, "extension", true, true),
    er = (await sql("SELECT * FROM career_orders WHERE id=$1", [ext.id]))
      .rows[0];
  assert.equal(er.amount_kopeks, 149000);
  await completeLocalFixture(er.payment_id);
  await orders.refreshOrder(a.id, ext.id);
  account = (await sql("SELECT * FROM career_accounts WHERE id=$1", [a.id]))
    .rows[0];
  const { addCalendarMonths } = await import("../lib/career-diagnostic.ts");
  assert.equal(
    new Date(account.access_until).toISOString(),
    addCalendarMonths(new Date(account.access_started_at), 12).toISOString(),
  );
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_reports WHERE account_id=$1",
      [a.id],
    ),
    1,
  );
  pass(
    "RUB 1490 extension: 12 calendar months from payment, no residue or extra analysis",
  );
  const providerTime = await (
    await import("../lib/server/commerce/yookassa-sandbox.ts")
  ).verifySandboxPayment(
    er.payment_id,
    ext.id,
    cfg.keys,
    (await import("../lib/server/career/payments.ts")).careerFetcher,
    "extension",
  );
  assert.equal(
    new Date(account.access_started_at).toISOString(),
    providerTime.capturedAt,
  );
  const controlPost = async (path) => {
    const r = await fetch(
      new URL(path, process.env.CAREER_PROVIDER_FIXTURE_URL),
      {
        method: "POST",
        headers: { "x-fixture-key": process.env.CAREER_FIXTURE_CONTROL_SECRET },
      },
    );
    assert.equal(r.status, 200);
  };
  await controlPost("/fixture/defer-refunds");
  const pendingRefund = await orders.refundOrder(a.id, ext.id);
  assert.equal(pendingRefund.refundStatus, "pending");
  assert.equal((await analysis.dashboard(a.id)).active, true);
  await assert.rejects(
    orders.createOrder(a.id, "extension", true, true),
    (e) => e.status === 409,
  );
  const refund = (
    await sql(
      "SELECT refund_id,refund_started_at FROM career_orders WHERE id=$1",
      [ext.id],
    )
  ).rows[0];
  assert(refund.refund_started_at);
  await sql(
    "UPDATE career_orders SET paid_at=now()-interval '9 days' WHERE id=$1",
    [ext.id],
  );
  await controlPost("/fixture/refund/" + refund.refund_id);
  await controlPost("/fixture/defer-refunds");
  await orders.webhookRefund(refund.refund_id);
  pass(
    "Pending refund preserves access, blocks further purchases and finalizes after the ordinary window",
  );
  await Promise.all([
    orders.refundOrder(a.id, ext.id),
    orders.refundOrder(a.id, ext.id),
  ]);
  account = (await sql("SELECT * FROM career_accounts WHERE id=$1", [a.id]))
    .rows[0];
  assert.equal(
    new Date(account.access_until).toISOString(),
    originalUntil.toISOString(),
  );
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_events WHERE order_id=$1 AND code='test_refund_confirmed'",
      [ext.id],
    ),
    1,
  );
  pass(
    "Independent full extension refund is idempotent and restores original period",
  );
  await orders.refundOrder(a.id, orderId);
  assert.equal((await analysis.dashboard(a.id)).active, false);
  await assert.rejects(analysis.readPdf(a.id), (e) => e.status === 403);
  await assert.rejects(
    orders.createOrder(a.id, "extension", true, true),
    (e) => e.status === 409,
  );
  pass(
    "Initial test refund revokes access; refunded initial cannot be replaced by cheaper extension",
  );
  assert.equal(
    orders
      .ordinaryRefundDeadline(new Date("2026-11-17T20:30:00Z"))
      .toISOString(),
    "2026-11-24T21:00:00.000Z",
  );
  pass("Seven-day request window excludes purchase day in Moscow calendar");
  await sql(
    "UPDATE career_accounts SET access_until=now()-interval '31 days' WHERE id=$1",
    [a.id],
  );
  const cleanup = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "scripts/career/runtime.mjs", "cleanup"],
    { encoding: "utf8" },
  );
  assert.equal(cleanup.status, 0, cleanup.stderr);
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_reports WHERE account_id=$1",
      [a.id],
    ),
    0,
  );
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_diagnostics WHERE account_id=$1",
      [a.id],
    ),
    0,
  );
  assert(
    (
      await sql("SELECT analysis_consumed FROM career_accounts WHERE id=$1", [
        a.id,
      ])
    ).rows[0].analysis_consumed,
  );
  await assert.rejects(
    orders.createOrder(a.id, "extension", true, true),
    (e) => e.status === 409,
  );
  pass(
    "Retention removes active report/answers/progress without resetting analysis entitlement",
  );
  assert.equal(
    await count(
      "SELECT count(*)::int AS n FROM career_reports WHERE account_id=$1",
      [b.id],
    ),
    0,
  );
  assert.equal(await auth.sessionAccount(b.token), b.id);
  await auth.logout(b.token);
  assert.equal(await auth.sessionAccount(b.token), null);
  pass("Second visitor isolated; logout invalidates stored session");
  const notifications = await sql(
    "SELECT kind,count(*)::int AS n,bool_and(sent_at IS NOT NULL) AS delivered FROM career_mail_outbox WHERE account_id=$1 GROUP BY kind",
    [a.id],
  );
  assert.equal(notifications.rows.length, 3);
  assert(notifications.rows.every((r) => r.n === 2 && r.delivered));
  pass(
    "Order/access/refund notifications delivered once per order with durable outbox",
  );
  // The AI pilot is not called here: preseeded counters must block the
  // request before it could reach any external provider, even with mode ON.
  const pilotAccount = await login();
  await sql(
    "UPDATE career_accounts SET access_started_at=now(),access_until=now()+interval '90 days' WHERE id=$1",
    [pilotAccount.id],
  );
  await analysis.saveDiagnostic(pilotAccount.id, syntheticAnswers());
  const oldAiEnv = {
    mode: process.env.CAREER_AI_MODE,
    enabled: process.env.CAREER_AI_ENABLED,
    key: process.env.OPENAI_API_KEY,
  };
  process.env.CAREER_AI_MODE = "openai";
  process.env.CAREER_AI_ENABLED = "1";
  process.env.OPENAI_API_KEY = "sk-" + "x".repeat(32);
  try {
    for (let i = 0; i < 3; i++)
      await sql("INSERT INTO career_ai_requests(id,account_id) VALUES($1,$2)", [
        randomUUID(), pilotAccount.id,
      ]);
    await assert.rejects(analysis.createAnalysis(pilotAccount.id), e => e.status === 429);
    const state = (await sql(
      "SELECT analysis_consumed,analysis_state FROM career_accounts WHERE id=$1",
      [pilotAccount.id],
    )).rows[0];
    assert.equal(state.analysis_consumed, false);
    assert.notEqual(state.analysis_state, "running");
    pass("Three synthetic AI calls per account in 90 days are enforced before provider access");

    // 25 global calls/day are also enforced for an otherwise unused account.
    for (let i = 0; i < 22; i++)
      await sql("INSERT INTO career_ai_requests(id,account_id) VALUES($1,$2)", [
        randomUUID(), pilotAccount.id,
      ]);
    const another = await login();
    await sql(
      "UPDATE career_accounts SET access_started_at=now(),access_until=now()+interval '90 days' WHERE id=$1",
      [another.id],
    );
    await analysis.saveDiagnostic(another.id, syntheticAnswers());
    await assert.rejects(analysis.createAnalysis(another.id), e=>e.status === 429);
    pass("25 synthetic AI calls per UTC day are enforced before provider access");
  } finally {
    if (oldAiEnv.mode === undefined) delete process.env.CAREER_AI_MODE;
    else process.env.CAREER_AI_MODE = oldAiEnv.mode;
    if (oldAiEnv.enabled === undefined) delete process.env.CAREER_AI_ENABLED;
    else process.env.CAREER_AI_ENABLED = oldAiEnv.enabled;
    if (oldAiEnv.key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldAiEnv.key;
    await sql("DELETE FROM career_ai_requests WHERE account_id=$1", [pilotAccount.id]);
  }
  console.log(
    `${checks} PostgreSQL/SMTP/provider integration scenarios passed`,
  );
} finally {
  await db.end();
}
