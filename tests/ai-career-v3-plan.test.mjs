// AI Career 3.0 #45–#46: task map, lesson selection and 30-step plan.
// The approved library used here is the in-memory SYNTHETIC FIXTURE from
// tests/fixtures/career-v3/fixture-library.mjs; it never reaches content/ or the server loader.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildLibrary } from "../lib/career-v3/library.ts";
import { evaluateDiagnostic } from "../lib/career-v3/diagnostic.ts";
import { buildTaskMap, taskMapStaleReasons, OutdatedResultError } from "../lib/career-v3/task-map.ts";
import { selectLessons, practiceVariant } from "../lib/career-v3/selection.ts";
import { buildPlan, planStaleReasons, phaseTargets, MAX_STEPS_PER_EXERCISE, MAX_STEPS_PER_LESSON } from "../lib/career-v3/plan.ts";
import { PHASES, validateEngineConfig, metricRef } from "../lib/career-v3/engine.ts";
import { PLAN_STEPS_REQUIRED } from "../lib/career-v3/contracts.ts";
import { schemaIssues } from "../lib/career-v3/json-schema.ts";
import { loadProfessionBundle } from "../lib/server/career-v3/content.ts";
import { fixtureLibrarySources, FIXTURE_MARK } from "./fixtures/career-v3/fixture-library.mjs";

const TODAY = "2026-11-18";
const load = (p) => JSON.parse(readFileSync(p, "utf8"));
const bundle = loadProfessionBundle("sales_manager", TODAY);
const ctx = bundle.engine;
const lessonSchema = load("content/career/v3/schemas/lesson.schema.json");
const stepSchema = load("content/career/v3/schemas/plan-step.schema.json");
const profiles = load("tests/fixtures/career-v3/pilot-profiles.json").profiles;
const answersOf = (id) => structuredClone(profiles.find((p) => p.id === id).answers);
const resultOf = (id, c = ctx) => evaluateDiagnostic({ ...bundle.diagnostic, definition: c.definition, role: c.role }, answersOf(id), TODAY);
const fixtureLibrary = (opts) => buildLibrary({ professionId: "sales_manager", today: TODAY, role: ctx.role, lessonSchema, stepSchema, ...fixtureLibrarySources(opts) });
const FULL = fixtureLibrary();
const run = (id, library = FULL) => {
  const result = resultOf(id);
  const selection = selectLessons(ctx, result, library);
  const plan = buildPlan(ctx, { result, selection, library, today: TODAY });
  const map = buildTaskMap(ctx, { result, answers: answersOf(id), library, today: TODAY });
  return { result, selection, plan, map };
};
const ALL = Object.fromEntries(profiles.map((p) => [p.id, run(p.id)]));

// ================= configuration and metrics =================

test("engine config is valid and every KPI link to a workplace outcome is flagged for methodological review", () => {
  assert.deepEqual(validateEngineConfig(ctx), []);
  const kinds = ctx.engine.metricKinds;
  assert.deepEqual(Object.keys(kinds).sort(), ctx.role.metrics.map((m) => m.id).sort());
  for (const outcome of ["reply_rate", "first_response_time", "renewal_rate", "case_resolution_time"]) assert.equal(kinds[outcome], "workplace_outcome", outcome);
  assert.equal(metricRef(ctx, "reply_rate").attribution, "observed_not_attributed");
  assert.equal(metricRef(ctx, "error_rate").attribution, "exercise_result");
  const broken = { ...ctx, engine: { ...ctx.engine, disputedKpiMappings: ctx.engine.disputedKpiMappings.filter((d) => d.metricId !== "reply_rate") } };
  assert.match(validateEngineConfig(broken).join(), /conversion→reply_rate links to a workplace outcome/);
  const noKind = { ...ctx, engine: { ...ctx.engine, metricKinds: { ...kinds } } };
  delete noKind.engine.metricKinds.error_rate;
  assert.match(validateEngineConfig(noKind).join(), /error_rate has no kind/);
});

// ================= real library: honest refusal =================

test("real repository library: task map is built from the matrix, but the learning route stays unavailable", () => {
  const result = resultOf("FX-b2b-experienced-public-tools");
  const map = buildTaskMap(ctx, { result, answers: answersOf("FX-b2b-experienced-public-tools"), library: bundle.library, today: TODAY });
  assert.equal(map.status, "ready");
  assert.equal(map.tasks.length, 3);
  assert.ok(map.tasks.every((t) => t.lessonRefs.length === 0));
  assert.deepEqual(map.learningRoute, { status: "unavailable", reason: "no_approved_lessons", message: bundle.library.availability.message });
  const selection = selectLessons(ctx, result, bundle.library);
  assert.equal(selection.status, "unavailable");
  assert.equal(selection.unavailableReason, "no_approved_lessons");
  const plan = buildPlan(ctx, { result, selection, library: bundle.library, today: TODAY });
  assert.equal(plan.status, "unavailable");
  assert.equal(plan.reason, "no_approved_lessons");
  assert.deepEqual(plan.steps, []);
});

// ================= task map =================

test("task map item: decision, matrix basis, company limits, risks, checks, skill, metric and approved lesson links", () => {
  const map = ALL["FX-b2b-experienced-public-tools"].map;
  assert.equal(map.status, "ready");
  for (const t of map.tasks) {
    const roleTask = ctx.role.tasks.find((x) => x.id === t.taskId);
    assert.equal(t.title, roleTask.title);
    assert.equal(t.basis.modeMeaning, roleTask.modeMeaning, "basis comes from the matrix");
    assert.equal(t.basis.humanResponsibility, roleTask.humanResponsibility);
    assert.ok(t.decisionLabel && t.explanation.includes(roleTask.prerequisites));
    assert.ok(t.risks.length >= 2 && t.mandatoryChecks.length >= 2);
    assert.equal(t.skill.skillId, roleTask.skillId);
    assert.equal(t.metric.metricId, roleTask.metricId);
    assert.ok(t.lessonRefs.length >= 1 && t.lessonRefs.every((r) => FULL.published.some((l) => l.id === r.lessonId && l.version === r.version)));
  }
  assert.ok(map.tasks.find((t) => t.taskId === "T11").mandatoryChecks.some((c) => /уполномоченным/.test(c)), "SAFE-04: commitments need approval");
});

test("strengths are reported only with evidence from answers; otherwise insufficient_evidence", () => {
  const exp = ALL["FX-b2b-experienced-public-tools"].map.strengths;
  assert.equal(exp.status, "evidenced");
  assert.deepEqual(exp.items.map((s) => s.id).sort(), ["STR-AI-PRACTICE", "STR-BASELINE", "STR-KNOWN-RULES", "STR-OWN-DEALS", "STR-REVIEW-HABIT"]);
  assert.ok(exp.items.every((s) => /^ответ Q\d\d: /.test(s.evidence)));
  const starter = ALL["FX-inbound-starter"].map.strengths;
  assert.equal(starter.status, "insufficient_evidence");
  assert.deepEqual(starter.items, []);
  assert.match(starter.note, /недостаточно оснований/);
});

test("growth skills follow selected tasks and safety context", () => {
  const starter = ALL["FX-inbound-starter"].map.growthSkills.map((g) => g.skillId);
  assert.ok(starter.includes("responsible_automation"), "synthetic-only mode adds responsible automation");
  assert.ok(starter.includes("impact_storytelling"), "no baseline adds impact measurement");
  const exp = ALL["FX-b2b-experienced-public-tools"].map.growthSkills.map((g) => g.skillId);
  assert.ok(!exp.includes("impact_storytelling") && !exp.includes("responsible_automation"));
});

test("safety tightens map decisions; human-only tasks stay with the person", () => {
  const banned = ALL["FX-account-ai-prohibited"].map;
  const t10 = banned.tasks.find((t) => t.taskId === "T10");
  assert.equal(t10.basis.roleMode, "conditional");
  assert.equal(t10.decision, "ai_assists");
  assert.equal(t10.basis.tightenedBySafety, true);
  assert.ok(t10.companyRestrictions.some((r) => /вручную/.test(r)));
  const high = ALL["FX-high-error-cost"].map;
  assert.equal(high.tasks.find((t) => t.taskId === "T12").decision, "human_decides");
});

test("outdated diagnostic or matrix: map refuses to build and stored maps become stale", () => {
  const result = resultOf("FX-diagnostic-changed");
  const map = buildTaskMap(ctx, { result, answers: answersOf("FX-diagnostic-changed"), library: FULL, today: TODAY });
  assert.deepEqual(taskMapStaleReasons(map, ctx, FULL), []);
  const newDiag = { ...ctx, definition: { ...ctx.definition, schemaVersion: "ai-career-diagnostic-v3-draft2" } };
  const newRole = { ...ctx, role: { ...ctx.role, schemaVersion: "ai-career-role-matrix-v2" } };
  assert.deepEqual(taskMapStaleReasons(map, newDiag, FULL), ["diagnostic_version_changed"]);
  assert.deepEqual(taskMapStaleReasons(map, newRole, FULL), ["role_matrix_version_changed"]);
  assert.throws(() => buildTaskMap(newDiag, { result, answers: answersOf("FX-diagnostic-changed"), library: FULL, today: TODAY }), OutdatedResultError);
  assert.equal(selectLessons(newDiag, result, FULL).unavailableReason, "diagnostic_outdated");
  assert.equal(buildPlan(newDiag, { result, selection: selectLessons(ctx, result, FULL), library: FULL, today: TODAY }).reason, "diagnostic_outdated");
  assert.ok(taskMapStaleReasons(map, ctx, fixtureLibrary({ dropSlots: ["SAL-02"] })).includes("delivered_lessons_changed"));
});

// ================= selection =================

test("selection uses only delivered lessons; review/draft/prototype/planned never enter a route", () => {
  for (const status of ["review", "draft", "prototype"]) {
    const src = fixtureLibrarySources();
    src.lessons.find((l) => l.document.id === "SAL-05").document.status = status;
    const lib = buildLibrary({ professionId: "sales_manager", today: TODAY, role: ctx.role, lessonSchema, stepSchema, ...src });
    const { selection, plan } = (() => { const result = resultOf("FX-inbound-starter"); const selection = selectLessons(ctx, result, lib); return { selection, plan: buildPlan(ctx, { result, selection, library: lib, today: TODAY }) }; })();
    assert.ok(!selection.items.some((i) => i.lessonId === "SAL-05"), status);
    if (plan.status === "ready") assert.ok(!plan.steps.some((s) => s.lessonId === "SAL-05"), status);
  }
  const planned = fixtureLibrarySources();
  const slot = planned.curriculum.slots.find((s) => s.id === "SAL-02");
  slot.status = "planned";
  const lib = buildLibrary({ professionId: "sales_manager", today: TODAY, role: ctx.role, lessonSchema, stepSchema, ...planned });
  assert.ok(!selectLessons(ctx, resultOf("FX-inbound-starter"), lib).items.some((i) => i.lessonId === "SAL-02"));
});

test("all four safety lessons are mandatory; missing one blocks the whole route", () => {
  for (const r of Object.values(ALL)) {
    const mandatory = r.selection.items.filter((i) => i.mandatory).map((i) => i.lessonId).sort();
    assert.deepEqual(mandatory, ["SAF-01", "SAF-02", "SAF-03", "SAF-04"]);
  }
  const lib = fixtureLibrary({ dropSlots: ["SAF-03"] });
  const result = resultOf("FX-b2b-experienced-public-tools");
  const sel = selectLessons(ctx, result, lib);
  assert.equal(sel.unavailableReason, "mandatory_module_missing");
  assert.match(sel.coverageGaps.join(), /SAF-03/);
  assert.equal(buildPlan(ctx, { result, selection: sel, library: lib, today: TODAY }).status, "unavailable");
});

test("subtype, level and work relevance filter lessons", () => {
  const starter = ALL["FX-inbound-starter"].selection;
  assert.ok(starter.excluded.some((x) => x.lessonId === "SAL-07" && ["level_mismatch", "subtype_mismatch"].includes(x.reason)), "negotiation lesson is not for an inbound starter");
  assert.ok(starter.excluded.some((x) => x.lessonId === "SAL-06" && x.reason === "level_mismatch"), "lost-deals analysis is for independent+experienced");
  assert.ok(!starter.items.some((i) => i.lessonId === "TRD-03"));
  const b2b = ALL["FX-b2b-experienced-public-tools"].selection;
  assert.ok(b2b.items.some((i) => i.lessonId === "SAL-07"));
  assert.ok(b2b.excluded.some((x) => x.lessonId === "SAL-02" && x.reason === "not_relevant_to_selected_work") ||
    !b2b.items.some((i) => i.lessonId === "SAL-02"));
  for (const r of Object.values(ALL)) {
    for (const i of r.selection.items) {
      const l = FULL.published.find((x) => x.id === i.lessonId);
      assert.ok(l.levels.includes(r.result.profile.level));
    }
  }
});

test("AI ban: manual variant, no prompt templates, no real tools anywhere in the route", () => {
  for (const id of ["FX-account-ai-prohibited", "FX-inbound-starter"]) {
    const { selection, plan } = ALL[id];
    assert.equal(selection.variant, "manual_without_ai");
    assert.equal(plan.status, "ready");
    assert.ok(plan.steps.every((s) => s.templateKind !== "prompt"), id);
    assert.ok(plan.steps.every((s) => s.restrictions[0].startsWith("ИИ не используется")), id);
  }
  assert.equal(practiceVariant(ALL["FX-no-policy"].result), "synthetic_practice");
  assert.ok(ALL["FX-no-policy"].plan.steps.every((s) => /вымышленные учебные данные/.test(s.restrictions[0])));
  assert.equal(practiceVariant(ALL["FX-b2b-experienced-public-tools"].result), "approved_tools_public_data");
});

test("prerequisites are pulled in and a lesson with an unavailable prerequisite is dropped", () => {
  const lib = fixtureLibrary({ dropSlots: ["VAL-01"] });
  const result = resultOf("FX-b2b-experienced-public-tools");
  const sel = selectLessons(ctx, result, lib);
  assert.equal(sel.status, "ready");
  assert.ok(!sel.items.some((i) => i.lessonId === "VAL-02"), "VAL-02 requires VAL-01");
});

// ================= plan =================

test("every ready plan: exactly 30 unique steps from approved candidates, all six phases, no calendar days, no padding", () => {
  for (const [id, { plan, selection }] of Object.entries(ALL)) {
    assert.equal(plan.status, "ready", id);
    assert.equal(plan.steps.length, PLAN_STEPS_REQUIRED, id);
    assert.deepEqual(plan.steps.map((s) => s.position), Array.from({ length: 30 }, (_, i) => i + 1));
    assert.equal(new Set(plan.steps.map((s) => s.stableId)).size, 30, id);
    assert.equal(new Set(plan.steps.map((s) => `${s.lessonId}|${s.exerciseId}|${s.templateId}`)).size, 30, id + " exercise+template repeated");
    assert.equal(new Set(plan.steps.map((s) => s.action)).size, 30, id + " repeated action");
    assert.equal(new Set(plan.steps.map((s) => `${s.lessonId}|${s.exerciseId}|${s.phase}`)).size, 30, id + " same exercise twice in one phase (prompt/manual alternatives)");
    for (const ph of PHASES) assert.ok(plan.phaseCounts[ph] >= 1, `${id}: phase ${ph}`);
    const perLesson = {}, perExercise = {};
    for (const s of plan.steps) {
      perLesson[s.lessonId] = (perLesson[s.lessonId] ?? 0) + 1;
      perExercise[s.lessonId + s.exerciseId] = (perExercise[s.lessonId + s.exerciseId] ?? 0) + 1;
      const candidate = FULL.planCandidates.find((c) => c.lessonId === s.lessonId && c.stepId === s.stableId.split("/")[1]);
      assert.ok(candidate, "step comes from an approved candidate");
      assert.equal(s.action, candidate.action, "action is not paraphrased");
      const lesson = FULL.published.find((l) => l.id === s.lessonId);
      assert.ok(lesson.exerciseIds.includes(s.exerciseId) && lesson.templateIds.includes(s.templateId));
      assert.ok(selection.items.some((i) => i.lessonId === s.lessonId));
      assert.equal(s.isCalendarDay, false);
      assert.ok(s.why.reasons.length > 0 && s.why.text.startsWith("Шаг выбран"));
      assert.ok(s.restrictions.length >= 2 && s.completionCriteria.length >= 2 && s.expectedArtifact && s.learningGoal);
      const { stableId, phase, lessonVersion, lessonTitle, templateKind, variant, metric, restrictions, why, estimatedMinutes, session, ...core } = s;
      void stableId; void phase; void lessonVersion; void lessonTitle; void templateKind; void variant; void metric; void restrictions; void why; void estimatedMinutes; void session;
      assert.deepEqual(schemaIssues(stepSchema, core, "step"), [], "step keeps the plan-step schema");
    }
    assert.ok(Object.values(perLesson).every((n) => n <= MAX_STEPS_PER_LESSON), id);
    assert.ok(Object.values(perExercise).every((n) => n <= MAX_STEPS_PER_EXERCISE), id);
    assert.ok(Object.keys(perLesson).length >= 10, id + " uses at least 10 different lessons");
    const order = plan.steps.map((s) => PHASES.indexOf(s.phase));
    const firstNonSafety = plan.steps.findIndex((s) => s.phase !== "safety");
    assert.ok(plan.steps.slice(0, firstNonSafety).every((s) => s.phase === "safety"), id + " safety comes first");
    assert.ok(order.slice(firstNonSafety + 1).every((v, i, a) => i === 0 || v >= a[i - 1]), id + " phases in order");
  }
});

test("profiles differ in content and order, not just a permutation of the same 30 rows", () => {
  const ids = (k) => new Set(ALL[k].plan.steps.map((s) => s.stableId));
  const overlap = (a, b) => [...ids(a)].filter((x) => ids(b).has(x)).length;
  // Different subtype and/or level: most of the plan differs.
  for (const [a, b, max] of [
    ["FX-inbound-starter", "FX-b2b-experienced-public-tools", 17],
    ["FX-b2b-experienced-public-tools", "FX-account-approved", 20],
    ["FX-inbound-starter", "FX-account-ai-prohibited", 22],
  ]) assert.ok(overlap(a, b) <= max, `${a} vs ${b}: ${overlap(a, b)} shared steps of 30`);
  // Shared steps across subtypes come only from mandatory safety and common modules — practice steps never overlap.
  const practice = (k) => new Set(ALL[k].plan.steps.filter((x) => x.lessonId.startsWith("SAL-")).map((x) => x.stableId));
  const sharedPractice = [...practice("FX-inbound-starter")].filter((x) => practice("FX-b2b-experienced-public-tools").has(x));
  assert.deepEqual(sharedPractice, [], "inbound starter and B2B experienced share no practice steps");
  // Same subtype and level, different company rules: prompt work is replaced and every restriction changes.
  const ok = ALL["FX-account-approved"].plan, banned = ALL["FX-account-ai-prohibited"].plan;
  assert.ok(30 - overlap("FX-account-approved", "FX-account-ai-prohibited") >= 4);
  assert.ok(ok.steps.some((s) => s.templateKind === "prompt") && !banned.steps.some((s) => s.templateKind === "prompt"));
  assert.ok(banned.steps.every((s) => !ok.steps.some((o) => o.stableId === s.stableId && o.restrictions[0] === s.restrictions[0])));
  const practiceLessons = (k) => new Set(ALL[k].plan.steps.filter((s) => s.lessonId.startsWith("SAL-")).map((s) => s.lessonId));
  assert.notDeepEqual([...practiceLessons("FX-inbound-starter")].sort(), [...practiceLessons("FX-b2b-experienced-public-tools")].sort());
  assert.notDeepEqual([...practiceLessons("FX-account-approved")].sort(), [...practiceLessons("FX-b2b-experienced-public-tools")].sort());
  const signatures = new Set(Object.values(ALL).filter((r) => r !== ALL["FX-diagnostic-changed"]).map((r) => r.plan.steps.map((s) => s.stableId).join()));
  assert.equal(signatures.size, profiles.length - 1, "every distinct profile has its own plan");
  assert.ok(ALL["FX-inbound-starter"].plan.phaseCounts.safety > ALL["FX-b2b-experienced-public-tools"].plan.phaseCounts.safety, "starters get more safety groundwork");
  assert.ok(ALL["FX-high-error-cost"].plan.phaseCounts.verify >= 6, "high error cost gets more verification");
  assert.ok(ALL["FX-b2b-experienced-public-tools"].plan.phaseCounts.next_level > ALL["FX-inbound-starter"].plan.phaseCounts.next_level);
});

test("no baseline: a measurement step comes right after the safety block", () => {
  for (const id of ["FX-no-baseline", "FX-inbound-starter", "FX-minimal-time"]) {
    const steps = ALL[id].plan.steps;
    const first = steps.findIndex((s) => s.phase !== "safety");
    assert.equal(steps[first].phase, "measure", id);
    assert.ok(steps[first].why.reasons.includes("baseline_first"), id);
  }
  const b2b = ALL["FX-b2b-experienced-public-tools"].plan.steps;
  assert.notEqual(b2b[b2b.findIndex((s) => s.phase !== "safety")].phase, "measure");
});

test("minimal learning time: same 30 steps packed into more, shorter sessions — still not calendar days", () => {
  const short = ALL["FX-minimal-time"].plan, normal = ALL["FX-account-approved"].plan;
  assert.equal(short.sessionMinutes, 15);
  assert.ok(short.steps.at(-1).session > normal.steps.at(-1).session);
  assert.ok(short.steps.every((s) => s.isCalendarDay === false));
});

test("mixed duties: lead subtype from the clarifier drives practice, secondary subtype may add lessons", () => {
  const m = ALL["FX-mixed-duties"];
  assert.equal(m.result.profile.subtype, "inbound");
  assert.ok(m.plan.steps.some((s) => s.lessonId === "SAL-02" || s.lessonId === "SAL-05"));
});

test("metrics in steps: workplace outcomes are observed only, never claimed as a training result", () => {
  for (const { plan } of Object.values(ALL)) {
    for (const s of plan.steps.filter((x) => x.metric)) {
      if (s.metric.kind === "workplace_outcome") {
        assert.equal(s.metric.attribution, "observed_not_attributed");
        assert.ok(s.restrictions.some((r) => /не приписывается/.test(r)));
      } else assert.equal(s.metric.attribution, "exercise_result");
    }
    assert.doesNotMatch(JSON.stringify(plan), /увелич\w* выручк|рост конверси|сэконом\w* \d/i);
  }
});

test("not enough distinct material → unavailable with the list of what is missing (no padding)", () => {
  const noTrends = fixtureLibrary({ dropModules: ["trends"] });
  const r = run("FX-b2b-experienced-public-tools", noTrends);
  assert.equal(r.plan.status, "unavailable");
  assert.equal(r.plan.reason, "insufficient_material");
  assert.ok(r.plan.gaps.some((g) => g.phase === "next_level" && g.available === 0));
  assert.deepEqual(r.plan.steps, []);
  const thin = fixtureLibrary({ dropModules: ["task_mapping", "value"] });
  const t = run("FX-inbound-starter", thin);
  assert.equal(t.plan.status, "unavailable");
  assert.ok(t.plan.gaps.some((g) => g.phase === "total" && g.available < 30));
});

test("stored plans become stale when a lesson is withdrawn, its version changes or the diagnostic changes", () => {
  const { plan } = ALL["FX-account-approved"];
  assert.deepEqual(planStaleReasons(plan, ctx, FULL), []);
  const someLesson = plan.steps.find((s) => s.lessonId.startsWith("SAL-")).lessonId;
  assert.ok(planStaleReasons(plan, ctx, fixtureLibrary({ dropSlots: [someLesson] })).includes(`lesson_withdrawn:${someLesson}`));
  const bumped = fixtureLibrarySources();
  bumped.lessons.find((l) => l.document.id === someLesson).document.version = "1.1.0";
  const lib = buildLibrary({ professionId: "sales_manager", today: TODAY, role: ctx.role, lessonSchema, stepSchema, ...bumped });
  assert.ok(planStaleReasons(plan, ctx, lib).includes(`lesson_version_changed:${someLesson}`));
  assert.ok(planStaleReasons(plan, { ...ctx, definition: { ...ctx.definition, schemaVersion: "x" } }, FULL).includes("diagnostic_version_changed"));
});

test("phase targets react to level, error cost, baseline and goals", () => {
  const t = (id) => phaseTargets(ALL[id].result);
  assert.ok(t("FX-inbound-starter").safety > t("FX-b2b-experienced-public-tools").safety);
  assert.ok(t("FX-high-error-cost").verify > t("FX-account-approved").verify);
  assert.ok(t("FX-no-baseline").measure > t("FX-high-error-cost").measure - 1);
});

test("fixture lessons are marked and never appear in the real library", () => {
  assert.ok(FULL.published.every((l) => l.title.startsWith(FIXTURE_MARK)));
  assert.ok(bundle.library.published.length === 0);
  assert.ok(!JSON.stringify(bundle.library).includes(FIXTURE_MARK));
});

test("the fixture demo document is regenerated from the engine (no hand-edited results)", async () => {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/career/render-v3-engine-demo.mjs", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync("docs/products/ai-career-v3/examples/engine-demo-fixture.md", "utf8"), /SYNTHETIC FIXTURE/);
});
