// AI Career 3.0 "Мои результаты" (#47) on the dedicated local synthetic PostgreSQL with the local-only
// SYNTHETIC FIXTURE library (CAREER_V3_FIXTURE_LIBRARY=1). No real providers, lessons or personal data.
// Usage: npm run career:test:v3-results
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
  writeFileSync(FILE, JSON.stringify({ syntheticFixture: true, notForUsers: true, curriculum: src.curriculum, lessons: src.lessons, planCandidates: src.planCandidates, downloadPaths: [FIXTURE_DOWNLOAD] }));
};
writeFixture();

const { careerPool } = await import("../lib/server/career/db.ts");
const auth = await import("../lib/server/career/auth.ts");
const orders = await import("../lib/server/career/orders.ts");
const { completeLocalFixture } = await import("../lib/server/career/payments.ts");
const store = await import("../lib/server/career-v3/store.ts");
const { conditionsFor } = await import("../lib/career-v3/results.ts");
const db = careerPool();
const P = "sales_manager";
const profiles = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles;
let checks = 0;
const pass = (n) => { checks++; console.log("PASS", n); };
const sql = (q, a = []) => db.query(q, a);
const rejects = (p, status, re) => assert.rejects(p, (e) => e.status === status && (!re || re.test(e.message)), `expected ${status} ${re ?? ""}`);
const forUnit = (unit) => Object.fromEntries(conditionsFor(unit).map((k) => [k, true]));
const TODAY = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

async function learner(profileId) {
  const email = `demo-${randomUUID().slice(0, 12)}@example.invalid`;
  const otp = await auth.requestOtp(email);
  const { code } = await (await fetch(new URL("/fixture/mail/" + encodeURIComponent(email), process.env.CAREER_PROVIDER_FIXTURE_URL), { headers: { "x-fixture-key": process.env.CAREER_FIXTURE_CONTROL_SECRET } })).json();
  const id = await auth.sessionAccount(await auth.verifyOtp(otp.challengeId, code));
  if (profileId) {
    const o = await orders.createOrder(id, "initial", true, true);
    const row = (await sql("SELECT payment_id FROM career_orders WHERE id=$1", [o.id])).rows[0];
    await completeLocalFixture(row.payment_id);
    await orders.webhookPayment(row.payment_id);
    await store.saveV3Diagnostic(id, P, profiles.find((p) => p.id === profileId).answers);
  }
  return { id, email };
}
const measurement = (unit, o = {}) => ({
  unit,
  baseline: { value: unit === "minutes" ? 19 : 50, sampleSize: 4, measuredOn: daysAgo(9) },
  after: { value: unit === "minutes" ? 2.5 : 75, sampleSize: 4, measuredOn: daysAgo(2) },
  reviewMinutes: unit === "minutes" ? 7 : null, fixMinutes: unit === "minutes" ? 3.5 : null, errorsFound: 3,
  conditions: forUnit(unit), limitations: ["learning_effect"], ...o,
});

try {
  const v2Progress = (await sql("SELECT count(*)::int AS n FROM career_progress")).rows[0].n;

  // 1. Access and empty state.
  const none = await learner(null);
  await rejects(store.readV3Results(none.id, P), 403);
  const a = await learner("FX-b2b-experienced-public-tools");
  assert.equal((await store.readV3Results(a.id, P)).plan, null);
  await rejects(store.v3Report(a.id, P, "results"), 409);
  pass("no access → 403; without a route the section is empty and no report is built from nothing");

  // 2. Slots and a full comparison.
  const plan = (await store.saveV3Plan(a.id, P)).plan;
  let r = await store.readV3Results(a.id, P);
  const eligible = r.measurements.filter((m) => m.eligible);
  const workplace = r.measurements.filter((m) => !m.eligible);
  assert.ok(eligible.length >= 2, "at least two measurement steps with exercise metrics");
  const slot = eligible.find((m) => m.units.includes("minutes")) ?? eligible[0];
  const unit = slot.units[0];
  const saved = await store.saveV3Measurement(a.id, P, slot.position, slot.stableId, slot.metric.id, measurement(unit));
  assert.equal(saved.revision, 1);
  assert.equal(saved.comparison.status, "ok");
  if (unit === "minutes") {
    assert.equal(saved.comparison.after, 13);
    assert.equal(saved.comparison.absDiff, -6);
    assert.deepEqual(saved.comparison.relative, { value: -32 });
  } else assert.equal(saved.comparison.percentagePoints, 25);
  pass(`measurement saved for step ${slot.position} (${slot.metric.id}, ${unit}); server formulas include review and fix time`);

  // 3. Repeated submission updates the same row.
  const again = await store.saveV3Measurement(a.id, P, slot.position, slot.stableId, slot.metric.id, measurement(unit));
  assert.equal(again.revision, 2);
  assert.equal((await sql("SELECT count(*)::int AS n FROM career_v3_measurements WHERE account_id=$1", [a.id])).rows[0].n, 1);
  pass("repeated submission replaces the measurement (revision 2), never duplicates it");

  // 4. Forged step, metric and other account.
  await rejects(store.saveV3Measurement(a.id, P, slot.position, slot.stableId + "x", slot.metric.id, measurement(unit)), 409, /не совпадает/);
  const other = eligible.find((m) => m.metric.id !== slot.metric.id);
  const wrongMetric = other ? other.metric.id : "error_rate" === slot.metric.id ? "research_time" : "error_rate";
  await rejects(store.saveV3Measurement(a.id, P, slot.position, slot.stableId, wrongMetric, measurement(unit)), 409, /Показатель не совпадает/);
  const plain = plan.steps.find((s) => !["measure", "value"].includes(s.phase));
  await rejects(store.saveV3Measurement(a.id, P, plain.position, plain.stableId, slot.metric.id, measurement(unit)), 409, /не предусмотрен/);
  const b = await learner("FX-b2b-experienced-public-tools");
  await store.saveV3Plan(b.id, P);
  const rb = await store.readV3Results(b.id, P);
  const bs = rb.measurements.find((m) => m.position === slot.position) ?? rb.measurements.find((m) => m.eligible);
  await store.saveV3Measurement(b.id, P, bs.position, bs.stableId, bs.metric.id, measurement(bs.units[0], { limitations: [] }));
  assert.equal((await sql("SELECT revision FROM career_v3_measurements WHERE account_id=$1", [a.id])).rows[0].revision, 2, "B never touches A's row");
  assert.equal((await store.readV3Results(b.id, P)).measurements.filter((m) => m.input).length, 1);
  const bVersion = (await sql("SELECT id FROM career_v3_plan_versions WHERE account_id=$1 AND status='active'", [b.id])).rows[0].id;
  await assert.rejects(sql("UPDATE career_v3_measurements SET account_id=$1 WHERE account_id=$2", [a.id, b.id]), /foreign key/);
  await assert.rejects(sql("UPDATE career_v3_measurements SET plan_version_id=$1 WHERE account_id=$2", [bVersion, a.id]), /foreign key|duplicate/);
  pass("forged step ID, substituted metric, a step without measurement and another account are refused; the database blocks cross-account rows");

  // 5. Invalid values.
  for (const [o, code] of [
    [{ baseline: { value: -5, sampleSize: 4, measuredOn: daysAgo(9) } }, "invalid_number"],
    [{ after: { value: 2, sampleSize: 0, measuredOn: daysAgo(2) } }, "invalid_number"],
    [{ after: { value: 2, sampleSize: 4, measuredOn: "2099-01-01" } }, "invalid_date"],
    [{ unit: "rubles" }, "invalid_unit"],
    [{ comment: "ООО Ромашка, договор 17" }, "unexpected_field"],
    [{ limitations: ["Наш внутренний процесс"] }, "invalid_limitations"],
    [{ conditions: { sameTaskType: true } }, "invalid_conditions"],
  ]) await assert.rejects(store.saveV3Measurement(a.id, P, slot.position, slot.stableId, slot.metric.id, measurement(unit, o)), (e) => e.code === code, code);
  pass("negative, zero-sample, future, unknown-unit, free-text and unknown-code inputs are refused with clear messages");

  // 6. Division by zero, missing baseline, non-comparable conditions.
  const zero = await store.saveV3Measurement(a.id, P, slot.position, slot.stableId, slot.metric.id, measurement(unit, { baseline: { value: 0, sampleSize: 4, measuredOn: daysAgo(9) } }));
  assert.equal(zero.comparison.relative.value, null);
  assert.match(zero.comparison.relative.explanation, /делить на него нельзя/);
  const noBase = await store.saveV3Measurement(a.id, P, slot.position, slot.stableId, slot.metric.id, measurement(unit, { baseline: null }));
  assert.equal(noBase.comparison.status, "insufficient");
  assert.match(noBase.comparison.reasons.join(" "), /Нет исходного замера/);
  const nonComp = await store.saveV3Measurement(a.id, P, slot.position, slot.stableId, slot.metric.id, measurement(unit, { conditions: { ...forUnit(unit), sameMethod: false } }));
  assert.equal(nonComp.comparison.conclusion, "Недостаточно оснований для вывода");
  if (unit === "minutes") {
    const noFix = await store.saveV3Measurement(a.id, P, slot.position, slot.stableId, slot.metric.id, measurement(unit, { fixMinutes: null }));
    assert.equal(noFix.comparison.status, "insufficient", "audit #49: an empty fix time is not treated as zero");
  }
  const pctSlot = eligible.find((x) => x.units.some((u) => u !== "minutes"));
  if (pctSlot) {
    const u2 = pctSlot.units.find((u) => u !== "minutes");
    const pc = await store.saveV3Measurement(a.id, P, pctSlot.position, pctSlot.stableId, pctSlot.metric.id, measurement(u2));
    assert.equal(pc.comparison.status, "ok", `audit #49: a ${u2} measurement is comparable without the time-only condition`);
    await sql("DELETE FROM career_v3_measurements WHERE account_id=$1 AND position=$2", [a.id, pctSlot.position]);
  }
  await store.saveV3Measurement(a.id, P, slot.position, slot.stableId, slot.metric.id, measurement(unit));
  pass("division by zero explained instead of a percent; missing baseline and non-comparable conditions → «Недостаточно оснований для вывода»");

  // 7. Workplace outcomes are never compared.
  if (workplace.length) {
    const w = workplace[0];
    await rejects(store.saveV3Measurement(a.id, P, w.position, w.stableId, w.metric.id, measurement("count")), 409, /Рабочий показатель/);
  }
  await assert.rejects(sql(`INSERT INTO career_v3_measurements(plan_version_id,account_id,position,step_stable_id,metric_id,metric_kind,variant,unit,conditions)
    SELECT plan_version_id,account_id,position,step_stable_id,'renewal_rate','workplace_outcome','synthetic_practice','percent','{}' FROM career_v3_step_progress WHERE account_id=$1 AND position=$2`, [a.id, plain.position]), /check/i);
  pass(`workplace outcomes are not recorded or compared (${workplace.length ? workplace.map((w) => w.metric.id).join(", ") + " refused" : "database guard"})`);

  // 8. Reports and PDF without technical data.
  for (const kind of ["results", "pilot", "development"]) {
    const rep = await store.v3Report(a.id, P, kind);
    assert.equal(rep.sections.length, 6);
    assert.match(rep.text, /Учебные данные/);
    assert.match(rep.text, /не доказана и не утверждается/);
    assert.match(rep.text, /Даты замеров: /);
    assert.doesNotMatch(rep.text, new RegExp(a.email.replace(/[.]/g, "\\.")));
    assert.doesNotMatch(rep.text, /[0-9a-f]{8}-[0-9a-f]{4}-|@example|STEP-\d{2}|TPL-|token/i);
    const pdf = await store.v3ReportPdf(a.id, P, kind);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 2000);
    assert.ok(!pdf.includes(Buffer.from(a.email)) && !pdf.includes(Buffer.from(a.id)));
  }
  pass("three report variants and PDFs: training notice, dates, no proven business link, no email, IDs or tokens");

  // 9. Lesson version change and withdrawal.
  const target = plan.steps.find((s) => !s.lessonId.startsWith("SAF-")).lessonId;
  writeFixture((src) => { src.lessons.find((l) => l.document.id === target).document.version = "1.1.0"; return src; });
  r = await store.readV3Results(a.id, P);
  assert.equal(r.stale, true);
  assert.equal(r.lessons.find((l) => l.lessonId === target).status, "outdated");
  assert.equal(r.measurements.filter((m) => m.input).length, 1, "stale results remain readable");
  await rejects(store.saveV3Measurement(a.id, P, slot.position, slot.stableId, slot.metric.id, measurement(unit)), 409, /устарел/);
  assert.match((await store.v3Report(a.id, P, "results")).text, /прежней версии маршрута/);
  await store.saveV3Plan(a.id, P, undefined, { rebuild: true });
  r = await store.readV3Results(a.id, P);
  assert.equal(r.measurements.filter((m) => m.input).length, 0, "measurements are not carried over");
  assert.equal(r.history[0].measurements, 1);
  const withdrawn = r.lessons.find((l) => !l.lessonId.startsWith("SAF-") && l.lessonId !== target).lessonId;
  writeFixture((src) => {
    src.lessons.find((l) => l.document.id === target).document.version = "1.1.0";
    src.lessons = src.lessons.filter((l) => l.document.id !== withdrawn);
    src.planCandidates[0].document.steps = src.planCandidates[0].document.steps.filter((s) => s.lessonId !== withdrawn);
    const s = src.curriculum.slots.find((x) => x.id === withdrawn); s.status = "planned"; s.publishedLessonId = null;
    return src;
  });
  r = await store.readV3Results(a.id, P);
  assert.equal(r.lessons.find((l) => l.lessonId === withdrawn).status, "withdrawn");
  // audit #49: history is keyed by plan-version UUID — two superseded versions with the same timestamp keep their own counts.
  await store.saveV3Plan(a.id, P, undefined, { rebuild: true });
  await sql("UPDATE career_v3_plan_versions SET created_at=(SELECT min(created_at) FROM career_v3_plan_versions WHERE account_id=$1) WHERE account_id=$1 AND status='superseded'", [a.id]);
  const hist = (await store.readV3Results(a.id, P)).history;
  assert.equal(hist.length, 2);
  assert.deepEqual(hist.map((h) => h.measurements).sort(), [0, 1], "each superseded version keeps its own measurement count");
  assert.ok(hist.every((h) => !("planVersionId" in h) && !JSON.stringify(h).match(/[0-9a-f]{8}-[0-9a-f]{4}-/)), "no plan-version UUID is sent to the client");
  pass(`lesson change (${target}) → results stale and read-only, rebuilt route starts without measurements, history keeps 1; withdrawal (${withdrawn}) is marked`);
  writeFixture();

  // 10. Database guards and no duplication of progress.
  await assert.rejects(sql("UPDATE career_v3_measurements SET unit='percent', baseline_value=150 WHERE account_id=$1", [b.id]), /check/i);
  await assert.rejects(sql("UPDATE career_v3_measurements SET baseline_value=-1 WHERE account_id=$1", [b.id]), /check/i);
  await assert.rejects(sql("UPDATE career_v3_measurements SET after_on=baseline_on-1 WHERE account_id=$1", [b.id]), /check/i);
  await assert.rejects(sql("UPDATE career_v3_measurements SET synthetic=false WHERE account_id=$1", [b.id]), /check/i);
  await assert.rejects(sql("UPDATE career_v3_measurements SET limitations=ARRAY['свободный текст'] WHERE account_id=$1", [b.id]), /check/i);
  const cols = (await sql("SELECT column_name FROM information_schema.columns WHERE table_name='career_v3_measurements'")).rows.map((x) => x.column_name);
  assert.ok(!cols.some((c) => /state|completed|criteria/.test(c)), "progress is not duplicated in the measurements table");
  assert.equal((await sql("SELECT count(*)::int AS n FROM career_progress")).rows[0].n, v2Progress);
  pass("database refuses out-of-range, negative, reversed-date, non-synthetic and free-text rows; progress not duplicated; v2 untouched");
  console.log(`v3 results integration: ${checks} checks passed (${TODAY})`);
} finally {
  if (backup) { copyFileSync(backup, FILE); rmSync(backup); } else writeFixture();
  await db.end();
}
