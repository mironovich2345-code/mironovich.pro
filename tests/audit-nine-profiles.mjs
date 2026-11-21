// AUDIT #49 — full learner path for the nine synthetic pilot profiles on the REAL written lessons, temporarily
// approved only inside the git-ignored local fixture (scripts/career/audit-approved-fixture.mjs).
// sign-in → diagnostic → task map → 30 distinct steps → lessons → exercises + mini-tests → progress → sign-out →
// sign-in → resume → measurements → three reports → PDF → repeated diagnostic → stale plan → rebuild → history.
// Usage: node scripts/career/audit-approved-fixture.mjs && node --experimental-strip-types tests/audit-nine-profiles.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
process.loadEnvFile(".env.career.local");
process.env.CAREER_V3_FIXTURE_LIBRARY = "1";
const fixture = JSON.parse(readFileSync(".career-v3-fixture/library.json", "utf8"));
assert.match(fixture.note, /AUDIT #49/, "run scripts/career/audit-approved-fixture.mjs first");
const { careerPool } = await import("../lib/server/career/db.ts");
const auth = await import("../lib/server/career/auth.ts");
const orders = await import("../lib/server/career/orders.ts");
const { completeLocalFixture } = await import("../lib/server/career/payments.ts");
const store = await import("../lib/server/career-v3/store.ts");
const { loadProfessionBundle } = await import("../lib/server/career-v3/content.ts");
const { learnerLesson } = await import("../lib/server/career-v3/lessons-view.ts");
const { conditionsFor } = await import("../lib/career-v3/results.ts");
const db = careerPool();
const P = "sales_manager";
const profiles = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles.filter((p) => p.id !== "FX-diagnostic-changed");
const sql = (q, a = []) => db.query(q, a);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const TECH = /[0-9a-f]{8}-[0-9a-f]{4}-|@example|demo-|STEP-\d{2}|TPL-[A-Z0-9-]+|\b(SAF|SAL|MAP|TRD|VAL)\d{2}-TASK-\d\b/;
const PROMISE = /(рост|увеличени\S*|повыш\S*)\s+(вашего\s+|вашей\s+)?(доход|зарплат|выручк|продаж|конверси)|гарантир|благодаря ИИ|ИИ повысил|\d+\s*(₽|руб)/i;

async function login(email) {
  await sql("UPDATE career_otp SET created_at=created_at-interval '2 minutes' WHERE email=$1", [email]);
  const otp = await auth.requestOtp(email);
  const { code } = await (await fetch(new URL("/fixture/mail/" + encodeURIComponent(email), process.env.CAREER_PROVIDER_FIXTURE_URL), { headers: { "x-fixture-key": process.env.CAREER_FIXTURE_CONTROL_SECRET } })).json();
  const token = await auth.verifyOtp(otp.challengeId, code);
  return { id: await auth.sessionAccount(token), token };
}
const bundle = loadProfessionBundle(P);
assert.equal(bundle.libraryMode, "synthetic_fixture");
const doc = (id) => bundle.lessonDocuments.get(id).document;

const rows = [];
try {
  for (const p of profiles) {
    const email = `demo-${randomUUID().slice(0, 12)}@example.invalid`;
    let s = await login(email);
    const o = await orders.createOrder(s.id, "initial", true, true);
    const pay = (await sql("SELECT payment_id FROM career_orders WHERE id=$1", [o.id])).rows[0];
    await completeLocalFixture(pay.payment_id);
    await orders.webhookPayment(pay.payment_id);
    const diag = await store.saveV3Diagnostic(s.id, P, p.answers);
    const map = await store.saveV3TaskMap(s.id, P);
    assert.equal(map.taskMap.status, "ready", p.id);
    const built = await store.saveV3Plan(s.id, P);
    assert.equal(built.plan.status, "ready", `${p.id}: route`);
    const plan = built.plan;
    assert.equal(plan.steps.length, 30);
    assert.equal(new Set(plan.steps.map((x) => x.stableId)).size, 30, `${p.id}: 30 distinct steps`);
    const phases = new Set(plan.steps.map((x) => x.phase));
    assert.equal(phases.size, 6, `${p.id}: all six phases`);
    if (plan.variant === "manual_without_ai") assert.ok(plan.steps.every((x) => x.templateKind !== "prompt"), `${p.id}: no prompts in manual mode`);
    const lessonIds = [...new Set(plan.steps.map((x) => x.lessonId))];
    for (const id of lessonIds) {
      const l = learnerLesson(P, id).lesson;
      assert.equal(l.id, id);
      assert.ok(!l.title.includes("[SYNTHETIC FIXTURE]"), `${id} is a real lesson text`);
    }
    let quizAttempts = 0;
    for (const step of plan.steps) {
      if (step.position === 11) {
        await auth.logout(s.token);
        s = await login(email);
        const pr = await store.readV3Progress(s.id, P);
        assert.equal(pr.summary.done, 10, `${p.id}: progress kept after sign-in`);
        assert.equal(pr.resumePosition, 11, `${p.id}: resume at step 11`);
      }
      const ex = doc(step.lessonId).content.exercises.find((e) => e.id === step.exerciseId);
      await store.startV3Step(s.id, P, step.position, step.stableId);
      await store.saveV3SelfCheck(s.id, P, step.position, step.stableId, ex.successCriteria.map(() => true));
      const pr = await store.readV3Progress(s.id, P);
      if (!pr.quizzes[step.lessonId]?.passed) {
        const quiz = doc(step.lessonId).content.quiz;
        const wrong = await store.submitV3Quiz(s.id, P, step.lessonId, Object.fromEntries(quiz.map((q) => [q.id, q.options.find((x) => x.id !== q.correctId).id])));
        assert.equal(wrong.passed, false);
        const right = await store.submitV3Quiz(s.id, P, step.lessonId, Object.fromEntries(quiz.map((q) => [q.id, q.correctId])));
        assert.equal(right.passed, true);
        quizAttempts += 2;
      }
      const done = await store.completeV3Step(s.id, P, step.position, step.stableId, step.completionCriteria.map(() => true));
      assert.equal(done.state, "done");
    }
    const finished = await store.readV3Progress(s.id, P);
    assert.deepEqual([finished.summary.done, finished.summary.percent, finished.resumePosition], [30, 100, null], `${p.id}: 30/30`);

    const results = await store.readV3Results(s.id, P);
    const eligible = results.measurements.filter((m) => m.eligible);
    let ok = 0;
    for (const m of eligible) {
      const unit = m.units.find((u) => u !== "minutes") ?? m.units[0];
      const minutes = unit === "minutes";
      const r = await store.saveV3Measurement(s.id, P, m.position, m.stableId, m.metric.id, {
        unit, baseline: { value: minutes ? 19 : 50, sampleSize: 4, measuredOn: daysAgo(9) }, after: { value: minutes ? 2.5 : 75, sampleSize: 4, measuredOn: daysAgo(2) },
        reviewMinutes: minutes ? 7 : null, fixMinutes: minutes ? 3.5 : null, errorsFound: 2,
        conditions: Object.fromEntries(conditionsFor(unit).map((k) => [k, true])), limitations: [],
      });
      if (r.comparison.status === "ok") ok++;
    }
    const reports = [];
    for (const kind of ["results", "pilot", "development"]) {
      const rep = await store.v3Report(s.id, P, kind);
      assert.equal(rep.sections.length, 6);
      assert.doesNotMatch(rep.text, TECH, `${p.id} ${kind}: technical data`);
      assert.doesNotMatch(rep.text, PROMISE, `${p.id} ${kind}: promise`);
      assert.ok(!rep.text.includes(email));
      const pdf = await store.v3ReportPdf(s.id, P, kind);
      assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
      reports.push(pdf.length);
      if (p === profiles[0]) writeFileSync(`/tmp/audit-report-${kind}.txt`, rep.text);
    }
    await store.saveV3Diagnostic(s.id, P, p.answers);
    const stale = await store.readV3Progress(s.id, P);
    assert.ok(stale.stale && stale.staleReasons.includes("diagnostic_resubmitted"), `${p.id}: stale after repeated diagnostic`);
    await assert.rejects(store.startV3Step(s.id, P, 1, plan.steps[0].stableId), (e) => e.status === 409);
    const rebuilt = await store.saveV3Plan(s.id, P, undefined, { rebuild: true });
    const after = await store.readV3Results(s.id, P);
    assert.equal(after.history[0].done, 30);
    assert.equal(after.history[0].measurements, eligible.length);
    assert.equal(after.summary.done, 0);
    rows.push({ profile: p.id.replace("FX-", ""), variant: plan.variant, lessons: lessonIds.length, steps: 30, phases: [...phases].length,
      quizAttempts, measureSlots: `${eligible.length}/${results.measurements.length}`, comparisonsOk: ok, pdfKb: reports.map((b) => Math.round(b / 1024)).join("/"),
      staleThenRebuilt: rebuilt.plan.status === "ready", diagnosticSaved: !!diag.savedAt });
    console.log("PASS", p.id, JSON.stringify(rows.at(-1)));
  }
  console.table(rows);
  writeFileSync("/tmp/audit-nine-profiles.json", JSON.stringify(rows, null, 2));
  console.log(`audit nine profiles: ${rows.length} profiles passed the full path`);
} finally {
  await db.end();
}
