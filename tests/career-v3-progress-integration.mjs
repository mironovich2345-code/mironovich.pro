// AI Career 3.0 progress persistence on the dedicated local synthetic PostgreSQL with the local-only
// SYNTHETIC FIXTURE library (CAREER_V3_FIXTURE_LIBRARY=1). No real providers, lessons or personal data.
// Usage: npm run career:test:v3-progress
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
process.loadEnvFile(".env.career.local");
process.env.CAREER_V3_FIXTURE_LIBRARY = "1";
const { fixtureLibrarySources, FIXTURE_DOWNLOAD } = await import("./fixtures/career-v3/fixture-library.mjs");
const FILE = ".career-v3-fixture/library.json";
const backup = existsSync(FILE) ? FILE + ".bak" : null;
if (backup) copyFileSync(FILE, backup);
const writeFixture = (mutate = (s) => s) => {
  const src = mutate(fixtureLibrarySources());
  mkdirSync(".career-v3-fixture", { recursive: true });
  writeFileSync(FILE, JSON.stringify({ syntheticFixture: true, notForUsers: true, curriculum: src.curriculum, lessons: src.lessons,
    planCandidates: src.planCandidates, downloadPaths: [FIXTURE_DOWNLOAD] }));
};
writeFixture();

const { careerConfig } = await import("../lib/server/career/config.ts");
assert(careerConfig().local && careerConfig().mode === "fixture");
const { careerPool } = await import("../lib/server/career/db.ts");
const auth = await import("../lib/server/career/auth.ts");
const orders = await import("../lib/server/career/orders.ts");
const { completeLocalFixture } = await import("../lib/server/career/payments.ts");
const store = await import("../lib/server/career-v3/store.ts");
const { loadProfessionBundle } = await import("../lib/server/career-v3/content.ts");
const { learnerLesson } = await import("../lib/server/career-v3/lessons-view.ts");
const db = careerPool();
const P = "sales_manager";
const profiles = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles;
const profile = (id) => profiles.find((p) => p.id === id).answers;
let checks = 0;
const pass = (n) => { checks++; console.log("PASS", n); };
const sql = (q, a = []) => db.query(q, a);
const rejects = (p, status, re) => assert.rejects(p, (e) => e.status === status && (!re || re.test(e.message)), `expected ${status}`);

async function login(email = `demo-${randomUUID().slice(0, 12)}@example.invalid`) {
  const otp = await auth.requestOtp(email);
  const r = await fetch(new URL("/fixture/mail/" + encodeURIComponent(email), process.env.CAREER_PROVIDER_FIXTURE_URL), { headers: { "x-fixture-key": process.env.CAREER_FIXTURE_CONTROL_SECRET } });
  const { code } = await r.json();
  const token = await auth.verifyOtp(otp.challengeId, code);
  return { id: await auth.sessionAccount(token), token, email };
}
async function withAccess(id) {
  const o = await orders.createOrder(id, "initial", true, true);
  const row = (await sql("SELECT payment_id FROM career_orders WHERE id=$1", [o.id])).rows[0];
  await completeLocalFixture(row.payment_id);
  await orders.webhookPayment(row.payment_id);
}
async function learner(profileId) {
  const u = await login();
  await withAccess(u.id);
  await store.saveV3Diagnostic(u.id, P, profile(profileId));
  await store.saveV3TaskMap(u.id, P);
  return u;
}
const lessonDoc = (id) => loadProfessionBundle(P).lessonDocuments.get(id).document;
const correctAnswers = (id) => Object.fromEntries(lessonDoc(id).content.quiz.map((q) => [q.id, q.correctId]));
const wrongAnswers = (id) => Object.fromEntries(lessonDoc(id).content.quiz.map((q) => [q.id, q.options.find((o) => o.id !== q.correctId).id]));
const criteriaCount = (s) => lessonDoc(s.lessonId).content.exercises.find((e) => e.id === s.exerciseId).successCriteria.length;
async function finishStep(u, s) {
  await store.startV3Step(u.id, P, s.position, s.stableId);
  await store.saveV3SelfCheck(u.id, P, s.position, s.stableId, Array(criteriaCount(s)).fill(true));
  await store.submitV3Quiz(u.id, P, s.lessonId, correctAnswers(s.lessonId));
  return store.completeV3Step(u.id, P, s.position, s.stableId, s.completionCriteria.map(() => true));
}

try {
  const v2Progress = (await sql("SELECT count(*)::int AS n FROM career_progress")).rows[0].n;

  // 1. No access.
  const none = await login();
  await rejects(store.readV3Progress(none.id, P), 403);
  await rejects(store.startV3Step(none.id, P, 1, "SAF-01@1.0.0/STEP-01"), 403);
  pass("no access: progress cannot be read or written without an active synthetic access grant");

  // 2. Plan version: built once, reused, 30 progress rows.
  const a = await learner("FX-b2b-experienced-public-tools");
  assert.equal((await store.readV3Progress(a.id, P)).plan, null);
  const built = await store.saveV3Plan(a.id, P);
  assert.equal(built.plan.status, "ready");
  assert.equal(built.reused, false);
  const again = await store.saveV3Plan(a.id, P);
  assert.equal(again.planVersionId, built.planVersionId);
  assert.equal(again.reused, true);
  const rebuiltSame = await store.saveV3Plan(a.id, P, undefined, { rebuild: true });
  assert.equal(rebuiltSame.planVersionId, built.planVersionId, "an identical rebuild keeps the same version");
  const rows = (await sql("SELECT state, lesson_version FROM career_v3_step_progress WHERE plan_version_id=$1", [built.planVersionId])).rows;
  assert.equal(rows.length, 30);
  assert.ok(rows.every((r) => r.state === "not_started"));
  let pr = await store.readV3Progress(a.id, P);
  assert.deepEqual(pr.summary, { total: 30, done: 0, selfChecked: 0, inProgress: 0, notStarted: 30, percent: 0 });
  assert.equal(pr.resumePosition, 1);
  pass("plan version stored once with 30 progress rows; repeated or identical rebuilds never reset it");

  // 3. Full step path with server-side conditions.
  const steps = built.plan.steps;
  const s1 = steps[0];
  await rejects(store.completeV3Step(a.id, P, 1, s1.stableId, s1.completionCriteria.map(() => true)), 409, /критерии упражнения/);
  const started = await store.startV3Step(a.id, P, 1, s1.stableId);
  assert.equal(started.state, "in_progress");
  await assert.rejects(store.saveV3SelfCheck(a.id, P, 1, s1.stableId, [true]), (e) => e.code === "invalid_checklist");
  await assert.rejects(store.saveV3SelfCheck(a.id, P, 1, s1.stableId, Array(criteriaCount(s1)).fill("ООО Ромашка")), (e) => e.code === "invalid_checklist");
  let st = await store.saveV3SelfCheck(a.id, P, 1, s1.stableId, Array(criteriaCount(s1)).fill(true));
  assert.equal(st.state, "in_progress", "criteria alone are not enough");
  const failed = await store.submitV3Quiz(a.id, P, s1.lessonId, wrongAnswers(s1.lessonId));
  assert.equal(failed.passed, false);
  assert.equal((await store.readV3Progress(a.id, P)).steps[0].state, "in_progress");
  await assert.rejects(store.submitV3Quiz(a.id, P, s1.lessonId, { ...correctAnswers(s1.lessonId), [lessonDoc(s1.lessonId).content.quiz[0].id]: "Клиент сказал да" }), (e) => e.code === "invalid_option");
  const ok = await store.submitV3Quiz(a.id, P, s1.lessonId, correctAnswers(s1.lessonId));
  assert.equal(ok.passed, true);
  assert.equal(ok.attempts, 2);
  assert.equal((await store.readV3Progress(a.id, P)).steps[0].state, "self_checked");
  await rejects(store.completeV3Step(a.id, P, 1, s1.stableId, s1.completionCriteria.map((_, i) => i === 0)), 409, /Подтвердите все критерии/);
  const done = await store.completeV3Step(a.id, P, 1, s1.stableId, s1.completionCriteria.map(() => true));
  assert.equal(done.state, "done");
  assert.equal(done.alreadyDone, false);
  pass("a step is completed only after the exercise self-check, a passed mini-test and every step criterion; free text and wrong shapes are refused");

  // 4. Repeated and concurrent submissions never count twice.
  const firstAt = done.completedAt;
  const repeat = await store.completeV3Step(a.id, P, 1, s1.stableId, s1.completionCriteria.map(() => true));
  assert.equal(repeat.alreadyDone, true);
  assert.equal(repeat.completedAt, firstAt);
  const unchanged = await store.saveV3SelfCheck(a.id, P, 1, s1.stableId, Array(criteriaCount(s1)).fill(false));
  assert.equal(unchanged.state, "done");
  const failAfterPass = await store.submitV3Quiz(a.id, P, s1.lessonId, wrongAnswers(s1.lessonId));
  assert.equal(failAfterPass.passed, true, "a later wrong attempt does not erase a pass");
  const s2 = steps[1];
  await store.startV3Step(a.id, P, 2, s2.stableId);
  await store.saveV3SelfCheck(a.id, P, 2, s2.stableId, Array(criteriaCount(s2)).fill(true));
  await store.submitV3Quiz(a.id, P, s2.lessonId, correctAnswers(s2.lessonId));
  const burst = await Promise.allSettled(Array.from({ length: 6 }, () => store.completeV3Step(a.id, P, 2, s2.stableId, s2.completionCriteria.map(() => true))));
  const fresh = burst.filter((r) => r.status === "fulfilled" && r.value.alreadyDone === false).length;
  assert.equal(fresh, 1, "exactly one concurrent completion is recorded");
  pr = await store.readV3Progress(a.id, P);
  assert.equal(pr.summary.done, 2);
  assert.equal((await sql("SELECT count(*)::int AS n FROM career_events WHERE account_id=$1 AND code='v3_step_completed'", [a.id])).rows[0].n, 2);
  pass("repeated and concurrent completions are idempotent: 2 steps, 2 completion events");

  // 5. Resume after sign-out and sign-in.
  const s3 = steps[2];
  await store.startV3Step(a.id, P, 3, s3.stableId);
  await auth.logout(a.token);
  assert.equal(await auth.sessionAccount(a.token), null);
  // The v2 one-code-per-minute guard stays on; the test only ages the previous synthetic code.
  await sql("UPDATE career_otp SET created_at=created_at-interval '2 minutes' WHERE email=$1", [a.email]);
  const back = await login(a.email);
  assert.equal(back.id, a.id);
  pr = await store.readV3Progress(back.id, P);
  assert.equal(pr.resumePosition, 3);
  assert.equal(pr.summary.done, 2);
  assert.equal(pr.summary.percent, 6);
  assert.deepEqual(pr.steps.slice(0, 3).map((s) => s.state), ["done", "done", "in_progress"]);
  pass("sign-out → sign-in: same account, progress and the resume position (step 3) are restored");

  // 6. Another account and forged step IDs.
  const b = await learner("FX-b2b-experienced-public-tools");
  const bPlan = await store.saveV3Plan(b.id, P);
  assert.notEqual(bPlan.planVersionId, built.planVersionId);
  await rejects(store.startV3Step(b.id, P, 5, steps[4].stableId + "x"), 409, /не совпадает/);
  await rejects(store.startV3Step(a.id, P, 5, steps[5].stableId), 409, /не совпадает/);
  await rejects(store.startV3Step(a.id, P, 31, steps[0].stableId), 404);
  await rejects(store.submitV3Quiz(a.id, P, "SAL-99", {}), 404);
  await finishStep(b, bPlan.plan.steps[0]);
  assert.equal((await store.readV3Progress(a.id, P)).summary.done, 2, "B's work never changes A's progress");
  assert.equal((await store.readV3Progress(b.id, P)).summary.done, 1);
  await assert.rejects(sql("UPDATE career_v3_step_progress SET account_id=$1 WHERE plan_version_id=$2 AND position=4", [b.id, built.planVersionId]), /foreign key/);
  await assert.rejects(sql("INSERT INTO career_v3_quiz_results(plan_version_id,account_id,lesson_id,lesson_version,answers,correct,total,passed) VALUES($1,$2,'VAL-05','1.0.0','{}',1,1,true)", [built.planVersionId, b.id]), /foreign key/);
  pass("another account: separate plan versions; forged positions/IDs refused; the database refuses rows across accounts");

  // 7. Lesson version change: the plan becomes history, progress is not carried over.
  const target = steps.find((s, i) => i >= 2 && !s.lessonId.startsWith("SAF-")).lessonId;
  writeFixture((src) => { src.lessons.find((l) => l.document.id === target).document.version = "1.1.0"; return src; });
  pr = await store.readV3Progress(a.id, P);
  assert.equal(pr.stale, true);
  assert.ok(pr.staleReasons.includes(`lesson_version_changed:${target}`));
  assert.equal(pr.summary.done, 2, "stale progress is still readable");
  await rejects(store.startV3Step(a.id, P, 4, steps[3].stableId), 409, /устарел/);
  await rejects(store.saveV3Plan(a.id, P), 409, /подтвердите сборку/);
  const rebuilt = await store.saveV3Plan(a.id, P, undefined, { rebuild: true });
  assert.notEqual(rebuilt.planVersionId, built.planVersionId);
  pr = await store.readV3Progress(a.id, P);
  assert.equal(pr.stale, false);
  assert.equal(pr.summary.done, 0, "old results are not transferred automatically");
  assert.deepEqual(Object.keys(pr.quizzes), []);
  assert.equal(pr.history.length, 1);
  assert.equal(pr.history[0].done, 2);
  assert.ok(pr.history[0].reasons.includes(`lesson_version_changed:${target}`));
  assert.ok(pr.plan.steps.some((s) => s.stableId.startsWith(`${target}@1.1.0/`)));
  pass(`lesson version change (${target} 1.0.0 → 1.1.0): plan stale and read-only; explicit rebuild starts a new version, 2 old steps stay in history`);

  // 8. Lesson withdrawal.
  const withdrawn = pr.plan.steps.find((s, i) => i >= 4 && !s.lessonId.startsWith("SAF-") && s.lessonId !== target).lessonId;
  writeFixture((src) => {
    src.lessons.find((l) => l.document.id === target).document.version = "1.1.0";
    src.lessons = src.lessons.filter((l) => l.document.id !== withdrawn);
    src.planCandidates[0].document.steps = src.planCandidates[0].document.steps.filter((s) => s.lessonId !== withdrawn);
    const slot = src.curriculum.slots.find((s) => s.id === withdrawn);
    slot.status = "planned"; slot.publishedLessonId = null;
    return src;
  });
  pr = await store.readV3Progress(a.id, P);
  assert.ok(pr.staleReasons.includes(`lesson_withdrawn:${withdrawn}`));
  assert.throws(() => learnerLesson(P, withdrawn), (e) => e.status === 404);
  await rejects(store.submitV3Quiz(a.id, P, pr.plan.steps[0].lessonId, correctAnswers(pr.plan.steps[0].lessonId)), 409, /устарел/);
  pass(`lesson withdrawal (${withdrawn}): lesson unavailable, plan stale, no further progress until an explicit rebuild`);
  writeFixture();

  // 9. Diagnostic resubmission makes the plan stale as well.
  const c = await learner("FX-no-policy");
  await store.saveV3Plan(c.id, P);
  await store.saveV3Diagnostic(c.id, P, profile("FX-no-policy"));
  assert.ok((await store.readV3Progress(c.id, P)).staleReasons.includes("diagnostic_resubmitted"));
  pass("re-submitting the diagnostic marks the plan stale (history kept, no silent transfer)");

  // 10. Manual learning without AI.
  const m = await learner("FX-account-ai-prohibited");
  const mp = await store.saveV3Plan(m.id, P);
  assert.equal(mp.plan.variant, "manual_without_ai");
  const kinds = mp.plan.steps.map((s) => s.templateKind);
  assert.ok(!kinds.includes("prompt"), "no prompt templates in a manual plan");
  const md = await finishStep(m, mp.plan.steps[0]);
  assert.equal(md.state, "done");
  assert.equal((await store.readV3Progress(m.id, P)).summary.done, 1);
  pass("manual learning without AI: a route without prompts is completed through the same checks");

  // 11. Database guards.
  const pv = mp.planVersionId;
  await assert.rejects(sql("UPDATE career_v3_step_progress SET state='done' WHERE plan_version_id=$1 AND position=2", [pv]), /check/i);
  await assert.rejects(sql("UPDATE career_v3_step_progress SET state='finished' WHERE plan_version_id=$1 AND position=2", [pv]), /check/i);
  await assert.rejects(sql("UPDATE career_v3_step_progress SET criteria_met='[true]' WHERE plan_version_id=$1 AND position=2 AND criteria_count<>1", [pv]), /check/i);
  await assert.rejects(sql("UPDATE career_v3_step_progress SET synthetic=false WHERE plan_version_id=$1", [pv]), /check/i);
  await assert.rejects(sql("UPDATE career_v3_plan_versions SET status='active', superseded_at=NULL WHERE account_id=$1 AND status='superseded'", [a.id]), /unique|duplicate/i);
  pass("database refuses fake completion, unknown states, wrong checklist sizes, non-synthetic rows and two active plans");

  assert.equal((await sql("SELECT count(*)::int AS n FROM career_progress")).rows[0].n, v2Progress);
  pass("v2 career_progress is untouched");
  console.log(`v3 progress integration: ${checks} checks passed`);
} finally {
  if (backup) { copyFileSync(backup, FILE); rmSync(backup); } else writeFixture();
  await db.end();
}
