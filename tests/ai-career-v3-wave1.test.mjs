import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { loadWave1, validateWave1, hygieneIssues } from "../scripts/career/validate-v3-wave1.mjs";
import { WAVE1_IDS } from "../scripts/career/wave1-lessons.mjs";

const base = loadWave1();
const fresh = () => structuredClone(base);
const issues = (ctx) => validateWave1(ctx).join("; ");

test("wave 1 lessons pass the full gate", () => {
  assert.deepEqual(validateWave1(base), []);
  assert.deepEqual(WAVE1_IDS, ["VAL-01", "TRD-01", "MAP-01", "SAL-01"]);
});

test("lessons stay in review, unpublished, with unchecked facts and planned slots", () => {
  for (const id of WAVE1_IDS) {
    const l = base.lessons[id];
    assert.equal(l.status, "review");
    assert.equal(l.quality.canBePublished, false);
    assert.equal(l.sourcePolicy.factualClaimsChecked, false);
    const slot = base.catalog.slots.find((s) => s.id === id);
    assert.equal(slot.status, "planned");
    assert.equal(slot.publishedLessonId, null);
  }
  const ctx = fresh();
  ctx.lessons["SAL-01"].status = "approved";
  ctx.lessons["VAL-01"].sourcePolicy.factualClaimsChecked = true;
  ctx.catalog.slots.find((s) => s.id === "MAP-01").publishedLessonId = "MAP-01";
  const out = issues(ctx);
  assert.match(out, /SAL-01: must stay in review/);
  assert.match(out, /VAL-01: facts not yet checked/);
  assert.match(out, /MAP-01: slot must stay unpublished/);
});

test("each lesson has the full LESSON_STANDARD structure and a manual route", () => {
  for (const id of WAVE1_IDS) {
    const c = base.lessons[id].content;
    assert.ok(c.explanations.length >= 4 && c.workedExamples.length >= 2 && c.procedure.length >= 5, id);
    assert.ok(c.exercises.length >= 2 && c.quiz.length >= 5 && c.summary.length >= 5, id);
    assert.ok(c.templates.some((t) => t.kind === "prompt") && c.templates.some((t) => t.kind !== "prompt"), id);
    for (const ex of c.exercises) assert.ok(ex.sampleSolution.length > 400, ex.id + " has a full sample result");
    assert.match(base.lessons[id].security.ifToolForbidden, /вручную/);
  }
});

test("exercise feasibility: every key finding is in the input and addressed by the sample solution", () => {
  const drift = fresh();
  const ex = drift.lessons["SAL-01"].content.exercises[0];
  ex.syntheticInput = ex.syntheticInput.replace("третий завод в Казани", "новый склад");
  assert.match(issues(drift), /key quote not in input: третий завод в Казани/);
  const weak = fresh();
  const ex2 = weak.lessons["MAP-01"].content.exercises[0];
  ex2.sampleSolution = ex2.sampleSolution.replace("О3 — недопустима", "О3 — допустима");
  assert.match(issues(weak), /sample solution misses: О3 — недопустима/);
});

test("VAL-01 arithmetic is recomputed from raw rows, including review time", () => {
  const n = base.practice["VAL-01"].exercises[1].answerKey.numbers;
  assert.equal(n.afterAvgMinutes, 10);
  assert.equal(n.changePercentRounded, 29);
  const ctx = fresh();
  ctx.practice["VAL-01"].exercises[1].answerKey.numbers.afterAvgMinutes = 3; // generation-only time
  assert.match(issues(ctx), /after average includes review/);
});

test("sources are registered, from reviewed hosts and back every legal citation", () => {
  const unreg = fresh();
  unreg.lessons["SAL-01"].content.explanations[0].body += " См. 152-ФЗ, ст. 19.";
  assert.match(issues(unreg), /unregistered legal citation 152-ФЗ, ст\. 19/);
  const drift = fresh();
  drift.lessons["TRD-01"].sources[0].supportsClaim += " И ещё вывод.";
  assert.match(issues(drift), /source SRC-ARXIV-GPTS-ARE-GPTS differs from registry/);
  const host = fresh();
  host.lessons["TRD-01"].sources[0].url = "https://example.org/report";
  assert.match(issues(host), /source host not reviewed/);
  const lim = base.registry.sources.find((s) => s.id === "SRC-ARXIV-GENAI-AT-WORK").methodologicalLimits;
  assert.match(lim, /Одна компания/);
});

test("no outcome promises, replacement claims, real contacts or wrong weekdays outside quoted errors", () => {
  assert.ok(hygieneIssues("Курс гарантирует рост дохода", "body").length);
  assert.ok(hygieneIssues("ИИ заменит менеджеров к 2030 году", "body").length);
  assert.deepEqual(hygieneIssues("ИИ заменит менеджеров к 2030 году", "syntheticInput"), [], "quoted errors for the learner are allowed");
  assert.ok(hygieneIssues("пишите на ivan@mail.ru", "body").length);
  assert.ok(hygieneIssues("сайт severpro.ru", "body").length);
  assert.deepEqual(hygieneIssues("сайт severpro-demo.example", "body"), []);
  assert.ok(hygieneIssues("созвон в пятницу, 28.11", "body").length);
  const ctx = fresh();
  ctx.lessons["VAL-01"].content.summary[0] += " Это гарантирует рост выручки.";
  assert.match(issues(ctx), /outcome promise/);
});

test("TRD-01 never claims inevitable replacement and keeps methodological limits visible", () => {
  const t = JSON.stringify(base.lessons["TRD-01"]);
  assert.match(t, /не прогнозируют сроки/);
  assert.match(t, /одна компания или одна платформа/);
  assert.match(t, /14%/, "version differences are shown");
  assert.doesNotMatch(t.replace(/«[^«»]*»/g, ""), /неизбежно замен/);
});

test("SAL-01 uses only fictional, marked companies and rejects personal data from social networks", () => {
  const t = JSON.stringify(base.lessons["SAL-01"]);
  assert.match(t, /СеверПро-Демо/);
  assert.match(t, /\.example/);
  const key = base.practice["SAL-01"].exercises[0].answerKey.findings.map((f) => f.type);
  assert.ok(key.includes("personal_data") && key.includes("hypothesis_as_fact") && key.filter((x) => x.startsWith("invented")).length >= 4);
});

test("plan candidates: ≤4 per lesson, every exercise covered, doing first without a prompt, distinct follow-ups", () => {
  const steps = base.plan.steps;
  assert.equal(steps.length, 15);
  for (const id of WAVE1_IDS) assert.ok(steps.filter((s) => s.lessonId === id).length <= 4);
  const promptFirst = fresh();
  const s = promptFirst.plan.steps.find((x) => x.lessonId === "SAL-01");
  s.templateId = "TPL-SAL01-PROMPT-BRIEF";
  assert.match(issues(promptFirst), /doing an exercise must not require a prompt/);
  const rephrase = fresh();
  const [a, b] = rephrase.plan.steps.filter((x) => x.exerciseId === "MAP01-TASK-1");
  b.expectedArtifact = a.expectedArtifact; b.completionCriteria = [...a.completionCriteria];
  assert.match(issues(rephrase), /repeated action or artifact|repeats/);
  const tooMany = fresh();
  for (let i = 0; i < 2; i++) tooMany.plan.steps.push({ ...structuredClone(tooMany.plan.steps[0]), stepId: "STEP-9" + i, position: tooMany.plan.steps.length + 1, action: tooMany.plan.steps[0].action + " Дополнительно " + i, expectedArtifact: tooMany.plan.steps[0].expectedArtifact + " " + i });
  assert.match(issues(tooMany), /more than 4 steps for VAL-01/);
});

test("validator and worksheet CLIs pass; existing v3 content validator still passes", () => {
  for (const args of [["scripts/career/validate-v3-wave1.mjs"], ["scripts/career/wave1-lessons.mjs", "--check"], ["scripts/career/validate-v3-content.mjs"]]) {
    const r = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(r.status, 0, args[0] + "\n" + r.stderr);
  }
});
