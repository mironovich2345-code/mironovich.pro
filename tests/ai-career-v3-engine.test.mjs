// AI Career 3.0 engine: lesson library, diagnostic, readiness guard, profession plug-in contract.
// Approved lessons below are in-memory SYNTHETIC FIXTURES built inside this test; they are never
// written to content/ and the server loader cannot read them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { buildLibrary, learnerCatalog, lessonForLearner, UNAVAILABLE_MESSAGE } from "../lib/career-v3/library.ts";
import {
  evaluateDiagnostic, validateAnswers, validateDiagnosticConfig, taskShortlist, followUpsDue,
  parseSafetyCondition, questionnaire, DiagnosticConfigError,
} from "../lib/career-v3/diagnostic.ts";
import { assessPlanReadiness, PLAN_STEPS_REQUIRED } from "../lib/career-v3/contracts.ts";
import { schemaIssues } from "../lib/career-v3/json-schema.ts";
import { schemaCheck } from "../scripts/career/validate-v3-content.mjs";
import { loadProfessionBundle, professionConfig, loadRegistry, ProfessionUnavailableError } from "../lib/server/career-v3/content.ts";

const load = (p) => JSON.parse(readFileSync(p, "utf8"));
const TODAY = "2026-11-18";
const bundle = loadProfessionBundle("sales_manager", TODAY);
const registry = loadRegistry();
const role = load("content/career/v3/roles/sales-manager.json");
const curriculum = load("content/career/v3/curriculum.json");
const lessonSchema = load("content/career/v3/schemas/lesson.schema.json");
const stepSchema = load("content/career/v3/schemas/plan-step.schema.json");
const prototype = load("content/career/v3/examples/safety-lesson.prototype.json");
const fixtures = load("tests/fixtures/career-v3/pilot-profiles.json");
const ctx = bundle.diagnostic;
const clone = (x) => structuredClone(x);
const profile = (id) => clone(fixtures.profiles.find((p) => p.id === id).answers);

// ---------- synthetic fixture factory (approved lessons exist only inside tests) ----------
const FIXTURE_DOWNLOAD = "content/career/v3/examples/safety-lesson.prototype.json";
function approvedLesson(id, { moduleId = "safety", scenarioId = null, prerequisites = [], subtypeIds, levels } = {}) {
  const l = clone(prototype);
  l.id = id;
  l.status = "approved";
  l.moduleId = moduleId;
  l.title = "[SYNTHETIC FIXTURE] " + l.title;
  l.audience.scenarioId = scenarioId;
  if (subtypeIds) l.audience.subtypeIds = subtypeIds;
  if (levels) l.audience.levels = levels;
  l.prerequisites = prerequisites;
  l.quality = { ...l.quality, reviewedOn: "2026-11-18", canBePublished: true };
  l.sourcePolicy = { factualClaimsChecked: true, timeSensitive: true, nextReviewOn: "2027-05-18" };
  l.downloads = [{ id: "DL-FX-" + id, title: "Синтетическая фикстура для тестов", kind: "worksheet", repositoryPath: FIXTURE_DOWNLOAD }];
  return l;
}
function publish(cur, ...ids) {
  const c = clone(cur);
  for (const id of ids) {
    const slot = c.slots.find((s) => s.id === id);
    slot.status = "published";
    slot.publishedLessonId = id;
  }
  return c;
}
function steps(lessonId, n, exerciseId = "TASK-01", templateId = "TPL-01") {
  return Array.from({ length: n }, (_, i) => ({
    stepId: "STEP-" + String(i + 1).padStart(2, "0"), position: i + 1, lessonId, exerciseId, linkedTaskId: "T09",
    learningGoal: "Синтетический шаг фикстуры для проверки контракта конструктора без пользовательского доступа.",
    action: "Выполнить упражнение синтетической фикстуры и сверить результат по критериям; шаг существует только в тестах движка.",
    templateId, expectedArtifact: "Проверенный учебный артефакт синтетической фикстуры.",
    completionCriteria: ["Критерий синтетической фикстуры выполнен.", "Результат сверен с образцом фикстуры.", "Данные фикстуры остались вымышленными."], metricId: "crm_completeness",
    safetyNote: "Только вымышленные данные; фикстура недоступна пользователям и не является уроком.", isCalendarDay: false,
  }));
}
const SAFETY = ["SAF-01", "SAF-02", "SAF-03", "SAF-04"];
function library({ lessons, cur = curriculum, planCandidates = [], exists = (p) => p === FIXTURE_DOWNLOAD, today = TODAY, r = role }) {
  return buildLibrary({
    professionId: "sales_manager", today, curriculum: cur, role: r, lessonSchema, stepSchema,
    lessons: lessons.map((document, i) => ({ path: `fixture/${document?.id ?? i}.json`, document })),
    planCandidates: planCandidates.map((document, i) => ({ path: `fixture/plan-${i}.json`, document })), fileExists: exists,
  });
}
const safetyLessons = () => SAFETY.map((id) => approvedLesson(id));
const fullCurriculum = () => publish(curriculum, ...SAFETY, "SAL-05");
const sal05 = () => approvedLesson("SAL-05", { moduleId: "practice", scenarioId: "S05", prerequisites: ["SAF-01"] });
const exclusions = (index, id) => index.entries.find((e) => e.id === id).exclusions;

// ================= Library =================

test("repository library: nothing is delivered while v3 lessons are not approved", () => {
  const lib = bundle.library;
  assert.deepEqual(lib.issues.filter((i) => i.severity === "error"), []);
  assert.equal(lib.availability.status, "unavailable");
  assert.equal(lib.availability.reason, "no_approved_lessons");
  assert.equal(lib.availability.message, UNAVAILABLE_MESSAGE);
  assert.equal(lib.published.length, 0);
  assert.equal(lib.planCandidates.length, 0);
  const catalog = learnerCatalog(lib);
  assert.equal(catalog.status, "unavailable");
  assert.deepEqual(catalog.lessons, []);
  assert.equal(lessonForLearner(lib, "SAF-01-EX"), null);
  const proto = lib.entries.find((e) => e.id === "SAF-01-EX");
  assert.equal(proto.status, "prototype");
  assert.ok(proto.exclusions.includes("prototype"));
  assert.ok(lib.slots.every((s) => s.deliverableLessonId === null));
});

test("a fully approved and published synthetic fixture lesson is delivered", () => {
  const lib = library({ lessons: safetyLessons(), cur: publish(curriculum, ...SAFETY) });
  assert.deepEqual(lib.issues, []);
  assert.equal(lib.availability.status, "available");
  assert.deepEqual(lib.published.map((l) => l.id), SAFETY);
  const catalog = learnerCatalog(lib);
  assert.equal(catalog.lessons.length, 4);
  assert.ok(!("document" in catalog.lessons[0]), "catalog exposes metadata, not the raw document");
  assert.ok(lessonForLearner(lib, "SAF-01"));
});

test("review, draft, prototype and retired lessons are never delivered", () => {
  for (const [status, reason] of [["review", "review_pending"], ["draft", "draft"], ["prototype", "prototype"], ["retired", "retired"]]) {
    const l = approvedLesson("SAF-01");
    l.status = status;
    const lib = library({ lessons: [l], cur: publish(curriculum, "SAF-01") });
    assert.equal(lib.published.length, 0, status);
    assert.ok(exclusions(lib, "SAF-01").includes(reason), status);
    assert.equal(lib.availability.reason, "no_approved_lessons");
  }
});

test("approval needs an explicit curriculum publication; draftLessonId (PR #57 style) is not publication", () => {
  const cur = clone(curriculum);
  cur.slots.find((s) => s.id === "SAF-01").draftLessonId = "SAF-01";
  const lib = library({ lessons: [approvedLesson("SAF-01")], cur });
  assert.deepEqual(exclusions(lib, "SAF-01"), ["not_published_in_curriculum"]);
  assert.match(lib.issues.map((i) => i.code).join(), /approved_not_deliverable/);
  const pointerOnly = clone(curriculum);
  pointerOnly.slots.find((s) => s.id === "SAF-01").publishedLessonId = "SAF-01"; // status still "planned"
  assert.equal(library({ lessons: [approvedLesson("SAF-01")], cur: pointerOnly }).published.length, 0);
});

test("publication flags, review date and safety guarantees are all required", () => {
  const cases = [
    ["not_publishable", (l) => { l.quality.canBePublished = false; }],
    ["review_not_recorded", (l) => { l.quality.reviewedOn = null; }],
    ["review_not_recorded", (l) => { l.quality.reviewedOn = "2026-12-01"; }],
    ["employer_data_allowed", (l) => { l.security.allowEmployerData = true; }],
    ["human_review_not_required", (l) => { l.security.requireHumanReview = false; }],
    ["missing_download", (l) => { l.downloads = []; }],
    ["missing_download", (l) => { l.downloads[0].repositoryPath = "content/career/v3/none.pdf"; }],
    ["foreign_role", (l) => { l.audience.roleIds = ["accountant"]; }],
  ];
  for (const [reason, mutate] of cases) {
    const l = approvedLesson("SAF-01");
    mutate(l);
    const lib = library({ lessons: [l], cur: publish(curriculum, "SAF-01") });
    assert.equal(lib.published.length, 0, reason);
    assert.ok(exclusions(lib, "SAF-01").includes(reason), reason);
  }
});

test("unconfirmed or stale sources block delivery", () => {
  const cases = [
    (l) => { l.sourcePolicy.factualClaimsChecked = false; },
    (l) => { l.sources[0].checkedOn = "2026-12-24"; },
    (l) => { l.sources[0].checkedOn = "2026-11-19"; l.quality.reviewedOn = "2026-11-18"; },
  ];
  for (const mutate of cases) {
    const l = approvedLesson("SAF-01");
    mutate(l);
    const lib = library({ lessons: [l], cur: publish(curriculum, "SAF-01"), today: "2026-12-30" });
    assert.ok(exclusions(lib, "SAF-01").includes("unverified_sources"), JSON.stringify(l.sources[0] ?? null));
  }
  const insecure = approvedLesson("SAF-01");
  insecure.sources[0].url = "http://insecure.example.com/report";
  assert.deepEqual(exclusions(library({ lessons: [insecure], cur: publish(curriculum, "SAF-01") }), "SAF-01"), ["schema_invalid"], "non-https source");
  const none = approvedLesson("SAF-01");
  none.sources = [];
  assert.equal(library({ lessons: [none], cur: publish(curriculum, "SAF-01") }).published.length, 0, "lesson without sources");
  const overdue = approvedLesson("SAF-01");
  overdue.sourcePolicy.nextReviewOn = "2026-11-01";
  assert.ok(exclusions(library({ lessons: [overdue], cur: publish(curriculum, "SAF-01") }), "SAF-01").includes("source_review_overdue"));
});

test("broken references: unknown task, scenario, prerequisite, quiz answer, module and slot", () => {
  const cases = [
    ["unknown_task", (l) => { l.audience.taskIds.push("T99"); }],
    ["unknown_scenario", (l) => { l.audience.scenarioId = "S99"; }],
    ["unknown_prerequisite", (l) => { l.prerequisites = ["XYZ-01"]; }],
    ["quiz_answer", (l) => { l.content.quiz[0].correctId = "zz"; }],
    ["module_mismatch", (l) => { l.moduleId = "trends"; }],
    ["duplicate_item", (l) => { l.content.templates[1].id = l.content.templates[0].id; }],
  ];
  for (const [code, mutate] of cases) {
    const l = approvedLesson("SAF-01");
    mutate(l);
    const lib = library({ lessons: [l], cur: publish(curriculum, "SAF-01") });
    assert.equal(lib.published.length, 0, code);
    assert.ok(lib.issues.some((i) => i.code === code && i.severity === "error"), code);
  }
  const orphan = approvedLesson("ZZZ-01");
  const lib = library({ lessons: [orphan] });
  assert.ok(exclusions(lib, "ZZZ-01").includes("unknown_slot"));
});

test("schema-invalid and duplicate lessons are rejected with errors", () => {
  const broken = approvedLesson("SAF-01");
  delete broken.content.quiz;
  const lib = library({ lessons: [broken], cur: publish(curriculum, "SAF-01") });
  assert.deepEqual(exclusions(lib, "SAF-01"), ["schema_invalid"]);
  const badVersion = approvedLesson("SAF-02");
  badVersion.version = "1.0";
  assert.ok(exclusions(library({ lessons: [badVersion], cur: publish(curriculum, "SAF-02") }), "SAF-02").includes("schema_invalid"));
  const dup = library({ lessons: [approvedLesson("SAF-01"), approvedLesson("SAF-01")], cur: publish(curriculum, "SAF-01") });
  assert.equal(dup.published.length, 0);
  assert.ok(dup.issues.some((i) => i.code === "duplicate_id"));
});

test("a lesson whose prerequisite is not delivered is withheld (cascade)", () => {
  const draftSafety = approvedLesson("SAF-01");
  draftSafety.status = "review";
  const lib = library({ lessons: [draftSafety, sal05()], cur: publish(curriculum, "SAF-01", "SAL-05") });
  assert.equal(lib.published.length, 0);
  assert.ok(lib.issues.some((i) => i.code === "prerequisite_unavailable"));
});

test("plan-step candidates must reference existing lesson, exercise, template, task and metric", () => {
  const lessons = [...safetyLessons(), sal05()];
  const cur = fullCurriculum();
  const bad = [
    ["unknown_exercise", (s) => { s.exerciseId = "TASK-404"; }],
    ["unknown_template", (s) => { s.templateId = "TPL-404"; }],
    ["unknown_lesson", (s) => { s.lessonId = "SAL-404"; }],
    ["unknown_task", (s) => { s.linkedTaskId = "T99"; }],
    ["unknown_metric", (s) => { s.metricId = "invented_revenue"; }],
    ["schema_invalid", (s) => { s.isCalendarDay = true; }],
  ];
  for (const [code, mutate] of bad) {
    const plan = { steps: steps("SAL-05", 1) };
    mutate(plan.steps[0]);
    const lib = library({ lessons, cur, planCandidates: [plan] });
    assert.equal(lib.planCandidates.length, 0, code);
    assert.ok(lib.issues.some((i) => i.code === code), code);
  }
  const reviewOnly = sal05();
  reviewOnly.status = "review";
  const lib = library({ lessons: [...safetyLessons(), reviewOnly], cur, planCandidates: [{ steps: steps("SAL-05", 3) }] });
  assert.equal(lib.planCandidates.length, 0, "steps of non-approved lessons never become candidates");
  assert.deepEqual(lib.issues.filter((i) => i.severity === "error"), []);
});

test("structural curriculum errors make the whole library unavailable", () => {
  const cur = publish(curriculum, ...SAFETY);
  cur.roleId = "accountant";
  const lib = library({ lessons: safetyLessons(), cur });
  assert.equal(lib.availability.status, "unavailable");
  assert.equal(lib.availability.reason, "content_errors");
  assert.equal(lib.published.length, 0);
});

test("TypeScript schema checker agrees with the repository validator", () => {
  const samples = [prototype, approvedLesson("SAF-01"), Object.assign(clone(prototype), { status: "public" }), (() => { const x = clone(prototype); delete x.sources; return x; })()];
  for (const s of samples) assert.deepEqual(schemaIssues(lessonSchema, s, "x"), schemaCheck(lessonSchema, s, "x", []));
});

// ================= Server loader and profession registry =================

test("only the pilot profession is served; other IDs and planned professions are refused", () => {
  assert.equal(registry.pilotProfessionId, "sales_manager");
  assert.deepEqual(registry.professions.map((p) => p.id), ["sales_manager"]);
  assert.throws(() => professionConfig("accountant"), ProfessionUnavailableError);
  const planned = clone(registry);
  planned.professions[0].status = "planned";
  assert.throws(() => professionConfig("sales_manager", planned), ProfessionUnavailableError);
  assert.deepEqual(bundle.configIssues, []);
  assert.match(bundle.contentHash, /^[a-f0-9]{64}$/);
});

test("v3 never imports the v2 synthetic diagnostic, analysis, PDF or AI provider; v2 never imports v3", () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => statSync(dir + "/" + n).isDirectory() ? walk(dir + "/" + n) : [dir + "/" + n]);
  const v3 = [...walk("lib/career-v3"), ...walk("lib/server/career-v3"), ...walk("app/api/career/v3")];
  for (const f of v3) {
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /career-diagnostic|career\/analysis|career\/ai-provider|career\/pdf|CareerSandbox/, f);
  }
  const v2 = ["lib/career-diagnostic.ts", ...walk("lib/server/career"), "app/api/career/[...action]/route.ts", "components/CareerSandbox.tsx"];
  for (const f of v2) assert.doesNotMatch(readFileSync(f, "utf8"), /career-v3/, f);
});

test("test fixtures stay out of user-facing content", () => {
  const walk = (dir) => readdirSync(dir).flatMap((n) => statSync(dir + "/" + n).isDirectory() ? walk(dir + "/" + n) : [dir + "/" + n]);
  for (const f of walk("content/career/v3").filter((x) => x.endsWith(".json"))) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, /SYNTHETIC FIXTURE|"syntheticFixture"/, f);
  }
  assert.equal(fixtures.syntheticFixture, true);
  assert.equal(fixtures.notForUsers, true);
  const loader = readFileSync("lib/server/career-v3/content.ts", "utf8");
  assert.match(loader, /content\/career\/v3\//);
  assert.doesNotMatch(loader, /tests\/fixtures/);
});

test("v3 API route is sandbox-gated exactly like the v2 cabinet", () => {
  const route = readFileSync("app/api/career/v3/[...action]/route.ts", "utf8");
  for (const guard of ["careerConfig()", "validGate(", "sessionAccount(", "limit(", 'get("origin")', 'get("host")', "MAX_BODY"]) assert.ok(route.includes(guard), guard);
  assert.ok(existsSync("migrations/career/005_v3_diagnostic.sql"));
  const sql = readFileSync("migrations/career/005_v3_diagnostic.sql", "utf8");
  assert.match(sql, /CAREER_TEST_DATABASE_REQUIRED/);
  assert.match(sql, /CHECK \(synthetic\)/);
  assert.doesNotMatch(sql, /ALTER TABLE career_diagnostics|DROP /i);
});

// ================= Diagnostic =================

test("approved questionnaire is used unchanged: 18 primary questions, at most 2 follow-ups, no free text", () => {
  const q = questionnaire(ctx);
  assert.equal(q.questions.length, 18);
  assert.equal(q.followUps.length, 2);
  assert.equal(q.maxTotalQuestions, 20);
  assert.equal(q.noFreeText, true);
  assert.ok([...q.questions, ...q.followUps].every((x) => ["single", "multi", "matrix_task_multi"].includes(x.kind)));
  assert.deepEqual(validateDiagnosticConfig(ctx), []);
});

test("three synthetic pilot profiles get different tasks, restrictions and learning parameters", () => {
  const today = TODAY;
  const b2b = evaluateDiagnostic(ctx, profile("FX-b2b-experienced-public-tools"), today);
  const inbound = evaluateDiagnostic(ctx, profile("FX-inbound-starter"), today);
  const banned = evaluateDiagnostic(ctx, profile("FX-account-ai-prohibited"), today);

  assert.deepEqual([b2b.profile.subtype, inbound.profile.subtype, banned.profile.subtype], ["outbound_b2b", "inbound", "account"]);
  assert.deepEqual([b2b.profile.level, inbound.profile.level, banned.profile.level], ["experienced", "starter", "independent"]);
  assert.deepEqual([b2b.profile.explanationDepth, inbound.profile.explanationDepth, banned.profile.explanationDepth], ["advanced", "basic", "standard"]);

  assert.equal(b2b.safety.mode, "approved_tools_public_data");
  assert.equal(b2b.safety.aiToolUseInPractice, true);
  assert.deepEqual(b2b.safety.appliedRules.map((r) => r.id), ["SAFE-03", "SAFE-04", "SAFE-05"]);
  assert.equal(inbound.safety.mode, "synthetic_only");
  assert.deepEqual(inbound.safety.appliedRules.map((r) => r.id), ["SAFE-01", "SAFE-02", "SAFE-04", "SAFE-05"]);
  assert.equal(banned.safety.mode, "synthetic_only");
  assert.equal(banned.safety.aiToolUseInPractice, false);
  assert.deepEqual(banned.safety.appliedRules.map((r) => r.id), ["SAFE-01", "SAFE-02", "SAFE-03", "SAFE-04", "SAFE-05"]);
  for (const r of [b2b, inbound, banned]) {
    assert.equal(r.safety.realEmployerDataAllowed, false);
    assert.deepEqual(r.safety.mandatorySlots, SAFETY);
    assert.ok(r.tasks.selected.every((t) => t.humanReviewRequired === true && t.automationAllowed === false));
  }

  const ids = (r) => r.tasks.selected.map((t) => t.taskId);
  assert.deepEqual(ids(b2b), ["T01", "T11", "T13"]);
  assert.deepEqual(ids(inbound), ["T07", "T10"]);
  assert.deepEqual(ids(banned), ["T19", "T10"]);
  assert.ok(inbound.tasks.selected.every((t) => t.practiceMode === "synthetic_practice"));
  assert.ok(b2b.tasks.selected.every((t) => t.practiceMode === "approved_tools_public_data"));
  const t10 = banned.tasks.selected.find((t) => t.taskId === "T10");
  assert.equal(t10.roleMode, "conditional");
  assert.equal(t10.decision, "ai_assists", "safety downgrades partial automation to assisted drafting");
  assert.ok(t10.restrictions.some((x) => /учебных вымышленных/.test(x)));

  assert.notDeepEqual(b2b.scenarios, inbound.scenarios);
  assert.notDeepEqual(inbound.scenarios, banned.scenarios);
  assert.equal(inbound.measurement.baselineRequired, true);
  assert.equal(b2b.measurement.baselineRequired, false);
  assert.notDeepEqual(b2b.measurement.metricIds, banned.measurement.metricIds);
  assert.deepEqual([b2b.learning.sessionMinutes, inbound.learning.sessionMinutes, banned.learning.sessionMinutes], [45, 30, 15]);
  assert.equal(inbound.company.policyContact, "manager");
  assert.equal(inbound.answeredQuestions, 19);
  assert.equal(b2b.answeredQuestions, 18);
});

test("safety rules take precedence over personalization", () => {
  const base = profile("FX-b2b-experienced-public-tools");
  base.Q03 = ["qualification"];
  base.Q04 = ["T02"]; // conditional task: partial automation possible only under safe conditions
  base.Q14 = "minor";
  base.Q16 = "within_limits";
  const free = evaluateDiagnostic(ctx, base, TODAY);
  assert.equal(free.tasks.selected[0].decision, "ai_can_take_part");
  assert.equal(free.tasks.selected[0].automationAllowed, true);
  for (const [q, v] of [["Q14", "money"], ["Q12", "general_only"], ["Q13", ["personal"]], ["Q11", ["none"]]]) {
    const a = clone(base);
    a[q] = v;
    if (q === "Q12") a.F01 = "it";
    const r = evaluateDiagnostic(ctx, a, TODAY);
    assert.equal(r.tasks.selected[0].automationAllowed, false, q);
    assert.equal(r.tasks.selected[0].decision, "ai_assists", q);
  }
  const experienced = clone(base);
  experienced.Q12 = "prohibited";
  experienced.Q10 = "advanced";
  const r = evaluateDiagnostic(ctx, experienced, TODAY);
  assert.equal(r.safety.mode, "synthetic_only", "seniority and AI experience never lift a ban");
  assert.equal(r.profile.explanationDepth, "advanced");
});

test("server validation rejects missing, unknown, free-text and out-of-range answers", () => {
  const good = profile("FX-b2b-experienced-public-tools");
  const bad = (mutate) => { const a = clone(good); mutate(a); const v = validateAnswers(ctx, a); assert.equal(v.ok, false); return v.errors.map((e) => e.questionId + ":" + e.code).join(","); };
  assert.equal(validateAnswers(ctx, good).ok, true);
  assert.match(bad((a) => { delete a.Q07; }), /Q07:missing/);
  assert.match(bad((a) => { a.Q99 = "x"; }), /Q99:unknown_question/);
  assert.match(bad((a) => { a.Q05 = "Клиент ООО Ромашка, тел. +7 912 000 00 00"; }), /Q05:invalid_option/);
  assert.match(bad((a) => { a.Q01 = ["outbound_b2b"]; }), /Q01:type/);
  assert.match(bad((a) => { a.Q03 = ["research", "proposal", "negotiation", "crm"]; }), /Q03:count/);
  assert.match(bad((a) => { a.Q11 = ["chat", "none"]; }), /Q11:exclusive/);
  assert.match(bad((a) => { a.Q18 = ["quality", "quality"]; }), /Q18:duplicate/);
  assert.match(bad((a) => { a.Q04 = ["T07"]; }), /Q04:invalid_option/, "inbound task is not offered to an outbound profile");
  assert.match(bad((a) => { a.Q04 = ["T01", "none_of_these"]; }), /Q04:exclusive/);
  assert.match(bad((a) => { a.F02 = "inbound"; }), /F02:not_applicable/);
  assert.match(bad((a) => { a.Q12 = "unknown"; }), /F01:missing/);
  assert.equal(validateAnswers(ctx, null).ok, false);
  assert.equal(validateAnswers(ctx, [good]).ok, false);
  assert.throws(() => evaluateDiagnostic(ctx, { ...good, Q02: "guru" }, TODAY), /invalid_answers/);
});

test("mixed role uses the approved clarifier and the 20-question ceiling", () => {
  const a = profile("FX-inbound-starter");
  a.Q01 = "mixed";
  assert.deepEqual(followUpsDue(ctx.definition, a).map((f) => f.id), ["F01", "F02"]);
  assert.match(validateAnswers(ctx, a).errors.map((e) => e.questionId).join(), /F02/);
  a.F02 = "account";
  const r = evaluateDiagnostic(ctx, a, TODAY);
  assert.equal(r.answeredQuestions, 20);
  assert.equal(r.profile.subtype, "account");
  assert.equal(r.profile.subtypeSource, "F02");
  assert.deepEqual(r.profile.secondarySubtypes, ["outbound_b2b", "inbound"]);
});

test("task shortlist follows subtype and work areas, max 10, and 'none of these' leads to a training example", () => {
  for (const sub of ["outbound_b2b", "inbound", "account", "mixed"]) {
    const list = taskShortlist(ctx, { Q01: sub, Q03: ["crm", "proposal", "account"] });
    assert.ok(list.length > 0 && list.length <= 10, sub);
    const allowed = ctx.definition.optionsSourceRules.matrix_task_multi.roleFilters[sub];
    for (const o of list) assert.ok(role.tasks.find((t) => t.id === o.value).subtypeIds.some((s) => allowed.includes(s)), sub + " " + o.value);
  }
  assert.deepEqual(taskShortlist(ctx, { Q01: "inbound" }), []);
  const a = profile("FX-inbound-starter");
  a.Q04 = ["none_of_these"];
  const r = evaluateDiagnostic(ctx, a, TODAY);
  assert.deepEqual(r.tasks.selected, []);
  assert.equal(r.tasks.fallback.kind, "training_example");
  assert.ok(r.scenarios.length > 0, "scenarios still come from the shortlist, without claiming real work");
});

test("results never infer job loss, savings or consent", () => {
  const all = fixtures.profiles.map((p) => JSON.stringify(evaluateDiagnostic(ctx, p.answers, TODAY)));
  for (const s of all) {
    assert.doesNotMatch(s, /\d+\s?%/);
    assert.match(s, /вероятность потери работы/); // only as an explicit prohibited inference
    assert.match(s, /"realEmployerDataAllowed":false/);
  }
});

test("diagnostic configuration fails closed", () => {
  assert.throws(() => parseSafetyCondition("Q12 maybe prohibited"), DiagnosticConfigError);
  const noEffect = { ...ctx, binding: { ...ctx.binding, safetyEffects: { ...ctx.binding.safetyEffects } } };
  delete noEffect.binding.safetyEffects["SAFE-03"];
  assert.match(validateDiagnosticConfig(noEffect).join(), /SAFE-03 has no engine effect/);
  assert.throws(() => evaluateDiagnostic(noEffect, profile("FX-inbound-starter"), TODAY), DiagnosticConfigError);
  const badBinding = { ...ctx, binding: { ...ctx.binding, company: { ...ctx.binding.company, policyApproved: ["yes_all"] } } };
  assert.match(validateDiagnosticConfig(badBinding).join(), /no option yes_all/);
  const freeText = { ...ctx, definition: { ...ctx.definition, noFreeText: false } };
  assert.match(validateDiagnosticConfig(freeText).join(), /free text/);
});

// ================= Plan readiness (constructor contract) =================

test("no approved lessons → no plan, no placeholder steps", () => {
  const r = evaluateDiagnostic(ctx, profile("FX-inbound-starter"), TODAY);
  const readiness = assessPlanReadiness(bundle.library, r);
  assert.equal(readiness.status, "unavailable");
  assert.equal(readiness.reason, "no_approved_lessons");
  assert.equal(readiness.eligibleSteps, 0);
  assert.ok(!("steps" in readiness) && !("candidateStepIds" in readiness));
});

test("readiness requires the mandatory safety module, a covered scenario and 30 fitting step candidates", () => {
  const r = evaluateDiagnostic(ctx, profile("FX-inbound-starter"), TODAY); // inbound, starter, tasks T07/T10 → S02, S05
  const noSafety = library({ lessons: [sal05()].map((l) => ({ ...l, prerequisites: [] })), cur: publish(curriculum, "SAL-05") });
  assert.equal(assessPlanReadiness(noSafety, r).reason, "mandatory_module_missing");

  const few = library({ lessons: [...safetyLessons(), sal05()], cur: fullCurriculum(), planCandidates: [{ steps: steps("SAL-05", 12) }] });
  const partial = assessPlanReadiness(few, r);
  assert.equal(partial.reason, "insufficient_steps");
  assert.equal(partial.eligibleSteps, 12);

  const wrongSubtype = sal05();
  wrongSubtype.audience.subtypeIds = ["account"];
  const mismatch = library({ lessons: [...safetyLessons(), wrongSubtype], cur: fullCurriculum(), planCandidates: [{ steps: steps("SAL-05", 30) }] });
  assert.equal(assessPlanReadiness(mismatch, r).reason, "scenario_not_covered");

  const enough = library({ lessons: [...safetyLessons(), sal05()], cur: fullCurriculum(), planCandidates: [{ steps: steps("SAL-05", PLAN_STEPS_REQUIRED) }] });
  const ok = assessPlanReadiness(enough, r);
  assert.equal(ok.status, "ready_for_construction");
  assert.equal(ok.eligibleSteps, 30);
});

// ================= Second profession without new business logic =================

test("a second profession plugs in through content and binding only (in-memory synthetic fixture)", () => {
  const fxRole = clone(role);
  fxRole.roleId = "fx_support_agent";
  fxRole.roleName = "[SYNTHETIC FIXTURE] Специалист поддержки";
  const fxCur = clone(curriculum);
  fxCur.roleId = "fx_support_agent";
  const fxCtx = { professionId: "fx_support_agent", definition: clone(ctx.definition), role: fxRole, curriculum: fxCur, binding: clone(ctx.binding) };
  assert.deepEqual(validateDiagnosticConfig(fxCtx), []);
  const r = evaluateDiagnostic(fxCtx, profile("FX-account-ai-prohibited"), TODAY);
  assert.equal(r.professionId, "fx_support_agent");
  assert.equal(r.safety.mode, "synthetic_only");
  const lessonForOtherRole = approvedLesson("SAF-01");
  lessonForOtherRole.audience.roleIds = ["fx_support_agent"];
  const lib = buildLibrary({ professionId: "fx_support_agent", today: TODAY, curriculum: publish(fxCur, "SAF-01"), role: fxRole, lessonSchema, stepSchema,
    lessons: [{ path: "fixture/SAF-01.json", document: lessonForOtherRole }], planCandidates: [], fileExists: (p) => p === FIXTURE_DOWNLOAD });
  assert.equal(lib.availability.status, "available");
  const salesLib = library({ lessons: [lessonForOtherRole], cur: publish(curriculum, "SAF-01") });
  assert.ok(exclusions(salesLib, "SAF-01").includes("foreign_role"), "lessons never leak across professions");
});
