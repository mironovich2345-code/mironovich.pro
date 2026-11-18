// Integration check for PR #57 + #59 + #60 + #61 + wave 1 (temporary integration branch only).
// Real lessons are read from content/; "approval" below is simulated IN MEMORY to probe the engine
// and is never written anywhere.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { buildLibrary, learnerCatalog } from "../lib/career-v3/library.ts";
import { evaluateDiagnostic } from "../lib/career-v3/diagnostic.ts";
import { selectLessons } from "../lib/career-v3/selection.ts";
import { buildPlan } from "../lib/career-v3/plan.ts";
import { buildTaskMap } from "../lib/career-v3/task-map.ts";
import { loadProfessionBundle } from "../lib/server/career-v3/content.ts";
import { fixtureLibrarySources } from "./fixtures/career-v3/fixture-library.mjs";

const TODAY = "2026-11-18";
const load = (p) => JSON.parse(readFileSync(p, "utf8"));
const bundle = loadProfessionBundle("sales_manager", TODAY);
const ctx = bundle.engine;
const lessonSchema = load("content/career/v3/schemas/lesson.schema.json");
const stepSchema = load("content/career/v3/schemas/plan-step.schema.json");
const profiles = load("tests/fixtures/career-v3/pilot-profiles.json").profiles;
const SAFETY = ["SAF-01", "SAF-02", "SAF-03", "SAF-04"];
const REAL = [...SAFETY, "SAL-02", "SAL-05", "VAL-01", "TRD-01", "MAP-01", "SAL-01"];
const lessonFiles = REAL.map((id) => ({ path: `content/career/v3/lessons/${id}.json`, document: load(`content/career/v3/lessons/${id}.json`) }));
const candidateFiles = ["safety.json", "sales-practice.json", "wave1.json"].map((f) => ({ path: "content/career/v3/plan-candidates/" + f, document: load("content/career/v3/plan-candidates/" + f) }));
const exists = (p) => !p.includes("..") && spawnSync("test", ["-f", p]).status === 0;

/** In-memory what-if: the six real lessons approved and their slots published. Nothing is written. */
function simulatedApproval() {
  const curriculum = structuredClone(load("content/career/v3/curriculum.json"));
  for (const s of curriculum.slots) if (REAL.includes(s.id)) { s.status = "published"; s.publishedLessonId = s.id; }
  const lessons = lessonFiles.map((f) => {
    const d = structuredClone(f.document);
    d.status = "approved"; d.quality.canBePublished = true; d.quality.reviewedOn = TODAY; d.sourcePolicy.factualClaimsChecked = true;
    return { path: f.path, document: d };
  });
  return buildLibrary({ professionId: "sales_manager", today: TODAY, curriculum, role: ctx.role, lessonSchema, stepSchema, lessons, planCandidates: candidateFiles, fileExists: exists });
}

test("JSON schemas are untouched by all four PRs and every real lesson passes them", () => {
  const diff = spawnSync("git", ["diff", "--quiet", "origin/main", "--", "content/career/v3/schemas"]);
  assert.equal(diff.status, 0, "lesson/plan-step schemas differ from main");
  const lib = bundle.library;
  assert.deepEqual(lib.issues.filter((i) => i.severity === "error"), []);
  for (const id of REAL) assert.ok(!lib.entries.find((e) => e.id === id).exclusions.includes("schema_invalid"), id);
});

test("IDs are unique across PRs: lessons, exercises, templates, worked examples, quizzes, step candidates", () => {
  const all = (pick) => lessonFiles.flatMap((f) => pick(f.document));
  for (const [name, pick] of [
    ["lessons", (d) => [d.id]], ["exercises", (d) => d.content.exercises.map((x) => x.id)], ["templates", (d) => d.content.templates.map((x) => x.id)],
    ["workedExamples", (d) => d.content.workedExamples.map((x) => x.id)], ["quiz", (d) => d.content.quiz.map((x) => x.id)], ["procedure", (d) => d.content.procedure.map((x) => x.id)],
  ]) { const ids = all(pick); assert.equal(new Set(ids).size, ids.length, name); }
  const steps = candidateFiles.flatMap((f) => f.document.steps.map((s) => `${s.lessonId}/${s.stepId}`));
  assert.equal(new Set(steps).size, steps.length);
  assert.equal(steps.length, 31);
});

test("all 31 step candidates resolve to existing lessons, exercises, templates, tasks and metrics", () => {
  const lib = simulatedApproval();
  assert.deepEqual(lib.issues.filter((i) => i.severity === "error"), []);
  assert.equal(lib.planCandidates.length, 31, "every candidate is accepted once its lesson is delivered");
});

test("real library: review material is not published; honest unavailable status everywhere", () => {
  const lib = bundle.library;
  for (const id of REAL) {
    const e = lib.entries.find((x) => x.id === id);
    assert.equal(e.status, "review", id);
    assert.equal(e.deliverable, false, id);
    assert.ok(e.exclusions.includes("review_pending") && e.exclusions.includes("not_published_in_curriculum"), id);
  }
  const cur = load("content/career/v3/curriculum.json");
  assert.ok(cur.slots.every((s) => s.status === "planned" && s.publishedLessonId === null));
  assert.ok(cur.slots.filter((s) => s.draftLessonId).length >= 4, "PR #57 draft pointers present but not publication");
  assert.equal(lib.availability.reason, "no_approved_lessons");
  assert.deepEqual(learnerCatalog(lib).lessons, []);
  const r = evaluateDiagnostic(bundle.diagnostic, profiles[0].answers, TODAY);
  const sel = selectLessons(ctx, r, lib);
  assert.equal(sel.unavailableReason, "no_approved_lessons");
  const plan = buildPlan(ctx, { result: r, selection: sel, library: lib, today: TODAY });
  assert.equal(plan.status, "unavailable");
  assert.deepEqual(plan.steps, []);
  assert.equal(buildTaskMap(ctx, { result: r, answers: profiles[0].answers, library: lib, today: TODAY }).learningRoute.status, "unavailable");
});

test("what-if approval of the ten real lessons: safety is mandatory, practice differs by profile, plan still refuses honestly", () => {
  const lib = simulatedApproval();
  assert.equal(lib.published.length, 10);
  const out = {};
  for (const p of profiles) {
    const r = evaluateDiagnostic(bundle.diagnostic, p.answers, TODAY);
    const sel = selectLessons(ctx, r, lib);
    const plan = buildPlan(ctx, { result: r, selection: sel, library: lib, today: TODAY });
    out[p.id] = { sel, plan };
    if (sel.status === "ready") assert.deepEqual(sel.items.filter((i) => i.mandatory).map((i) => i.lessonId).sort(), SAFETY);
    assert.equal(plan.status, "unavailable", p.id);
    assert.deepEqual(plan.steps, []);
  }
  assert.equal(out["FX-b2b-experienced-public-tools"].sel.variant, "approved_tools_public_data");
  assert.equal(out["FX-account-ai-prohibited"].sel.variant, "manual_without_ai");
  assert.equal(out["FX-no-policy"].sel.variant, "synthetic_practice");
  const practice = (id) => out[id].sel.items.filter((i) => i.moduleId === "practice").map((i) => i.lessonId).sort();
  assert.deepEqual(practice("FX-inbound-starter"), ["SAL-02", "SAL-05"]);
  assert.ok(practice("FX-b2b-experienced-public-tools").includes("SAL-01"), "SAL-01 makes B2B profiles selectable");
  assert.ok(!practice("FX-inbound-starter").includes("SAL-01"), "SAL-01 is not offered to inbound");
  assert.equal(out["FX-high-error-cost"].sel.unavailableReason, "nothing_fits_profile", "proposal-only B2B still waits for SAL-03");
  for (const [id, r] of Object.entries(out)) {
    if (r.sel.status !== "ready") continue;
    assert.ok(r.plan.gaps.every((g) => g.phase === "total"), id + ": all six stages now have material");
    assert.ok(r.plan.gaps.find((g) => g.phase === "total").available < 30, id);
  }
});

test("the same engine builds a full route on the isolated approved test fixture", () => {
  const lib = buildLibrary({ professionId: "sales_manager", today: TODAY, role: ctx.role, lessonSchema, stepSchema, ...fixtureLibrarySources() });
  const r = evaluateDiagnostic(bundle.diagnostic, profiles[0].answers, TODAY);
  const plan = buildPlan(ctx, { result: r, selection: selectLessons(ctx, r, lib), library: lib, today: TODAY });
  assert.equal(plan.status, "ready");
  assert.equal(plan.steps.length, 30);
});
