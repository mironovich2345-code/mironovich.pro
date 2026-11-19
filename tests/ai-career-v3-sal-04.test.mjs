import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { loadPack, validatePack, hygieneIssues } from "../scripts/career/validate-v3-lesson-pack.mjs";
import { PACKS } from "../scripts/career/v3-lesson-packs.mjs";

const base = loadPack("sal-04");
const fresh = () => structuredClone(base);
const issues = (ctx) => validatePack(ctx).join("; ");
const L = (ctx) => ctx.lessons["SAL-04"];
const K = (ctx, i) => ctx.practice["SAL-04"].exercises[i];

test("SAL-04 passes the full gate", () => {
  assert.deepEqual(validatePack(base), []);
  assert.deepEqual(PACKS["sal-04"].ids, ["SAL-04"]);
});

test("stays in review, unpublished, with unchecked facts and a planned slot", () => {
  const l = L(base);
  assert.equal(l.status, "review");
  assert.equal(l.quality.canBePublished, false);
  assert.equal(l.sourcePolicy.factualClaimsChecked, false);
  const slot = base.catalog.slots.find((s) => s.id === "SAL-04");
  assert.equal(slot.status, "planned");
  assert.equal(slot.publishedLessonId, null);
  const ctx = fresh();
  L(ctx).status = "approved";
  ctx.catalog.slots.find((s) => s.id === "SAL-04").status = "published";
  const out = issues(ctx);
  assert.match(out, /must stay in review/);
  assert.match(out, /slot must stay unpublished/);
});

test("scenario S04: tasks belong to the scenario and differ from SAL-03 (S03: proposal tasks)", () => {
  const a = L(base).audience;
  assert.equal(a.scenarioId, "S04");
  assert.deepEqual(a.taskIds, ["T05", "T13"]);
  const s04 = base.role.scenarios.find((s) => s.id === "S04");
  const s03 = base.role.scenarios.find((s) => s.id === "S03");
  for (const t of a.taskIds) { assert.ok(s04.taskIds.includes(t)); assert.ok(!s03.taskIds.includes(t)); }
  const ctx = fresh();
  L(ctx).audience.taskIds.push("T11");
  assert.match(issues(ctx), /task T11 not in scenario/);
});

test("full structure: six theory sections, two worked examples, manual route, prompts restricted", () => {
  const c = L(base).content;
  assert.ok(c.explanations.length >= 6 && c.workedExamples.length === 2 && c.procedure.length >= 6 && c.quiz.length >= 5);
  const headings = c.explanations.map((x) => x.heading).join(" | ");
  for (const h of [/Вопрос, сомнение, возражение и отказ/, /настоящую причину/, /ИИ помогает готовить варианты/, /нельзя выдумывать/, /манипуляцию/, /выбирает человек/]) assert.match(headings, h);
  assert.match(L(base).security.ifToolForbidden, /вручную/);
  const prompt = fresh();
  const t = L(prompt).content.templates.find((x) => x.id === "TPL-SAL04-PROMPT-OPTIONS");
  t.body = t.body.replace("Не выбирай лучший вариант — выбирать будет человек.", "Выбери лучший вариант.");
  assert.match(issues(prompt), /options prompt must forbid invented terms and leave the choice to the human/);
});

test("exercise 1: classification, respected refusal and invented motives in the answer key", () => {
  const types = K(base, 0).answerKey.types.map((t) => t.type);
  assert.deepEqual(types, ["question", "objection", "doubt", "objection", "question", "refusal"]);
  const ctx = fresh();
  const ex = L(ctx).content.exercises[0];
  ex.sampleSolution = ex.sampleSolution.replaceAll("не писать до", "написать раньше");
  assert.match(issues(ctx), /refusal must be respected/);
  const key = fresh();
  K(key, 0).answerKey.findings = K(key, 0).answerKey.findings.filter((f) => f.type !== "invented_motive");
  assert.match(issues(key), /exercise 1 key lacks invented_motive/);
});

test("exercise 2: arithmetic from the shared fictional price list, fixed implementation fee, budget", () => {
  const n = K(base, 1).answerKey.numbers;
  assert.equal(n.offerTotal, 318600, "same total as the SAL-03 offer");
  assert.equal(n.seats8Total, 263880);
  assert.equal(n.withinBudget, true);
  const fee = fresh();
  K(fee, 1).answerKey.numbers.seats8Total = 218880 + 30000;
  assert.match(issues(fee), /implementation is a fixed fee/);
  const count = fresh();
  K(count, 1).answerKey.numbers.errorsBefore = 5;
  assert.match(issues(count), /error count/);
});

test("the final reply never carries invented discounts, results, guarantees or pressure; the human chooses", () => {
  const disc = fresh();
  const ex = L(disc).content.exercises[1];
  ex.sampleSolution = ex.sampleSolution.replace("Остальные места можно добавить позже.", "Если подпишете до пятницы, дадим ещё 10%.");
  assert.match(issues(disc), /final reply keeps an invented/);
  const who = fresh();
  const ex2 = L(who).content.exercises[1];
  ex2.sampleSolution = ex2.sampleSolution.replace("Решение принимаю я, а не ИИ.", "Выбор сделал ИИ.");
  assert.match(issues(who), /the human must make the choice/);
  const cases = fresh();
  cases.practice["SAL-04"].priceList.allowedCaseStudies.push("кейс");
  assert.match(issues(cases), /no case studies/);
});

test("answer keys are quoted from the input and addressed in the sample solution", () => {
  const drift = fresh();
  const ex = L(drift).content.exercises[1];
  ex.syntheticInput = ex.syntheticInput.replace("Мы гарантируем, что ошибок в остатках не будет", "Ошибок будет меньше");
  assert.match(issues(drift), /key quote not in input: Мы гарантируем/);
});

test("hygiene, dates with a year and sources from reviewed hosts", () => {
  const ctx = fresh();
  L(ctx).content.exercises[0].syntheticInput += " Следующий звонок 10.12.";
  assert.match(issues(ctx), /study date without a year/);
  assert.ok(hygieneIssues("звонок в среду, 02.12.2026", "body").length === 0);
  assert.ok(hygieneIssues("звонок в пятницу, 02.12.2026", "body").length > 0);
  const host = fresh();
  L(host).sources[2].url = "https://example.org/paper";
  assert.match(issues(host), /source host not reviewed/);
  const promise = fresh();
  L(promise).content.summary[0] += " Это гарантирует рост продаж.";
  assert.match(issues(promise), /outcome promise/);
});

test("plan candidates: four distinct steps, doing first without a prompt, follow-ups verify or measure", () => {
  const steps = base.plan.steps;
  assert.deepEqual(steps.map((s) => s.templateId), ["TPL-SAL04-CLASSIFY", "TPL-SAL04-CHECK", "TPL-SAL04-CHOICE", "TPL-SAL04-SHEET"]);
  assert.equal(new Set(steps.map((s) => s.expectedArtifact)).size, 4);
  const p = fresh();
  p.plan.steps[2].templateId = "TPL-SAL04-PROMPT-OPTIONS";
  assert.match(issues(p), /must not require a prompt/);
  const f = fresh();
  f.plan.steps[1].templateId = "TPL-SAL04-REPLY";
  assert.match(issues(f), /must be a checklist or measurement sheet/);
});

test("validator and worksheet CLIs pass; the v3 content validator still passes", () => {
  for (const args of [["scripts/career/validate-v3-lesson-pack.mjs", "sal-04"], ["scripts/career/v3-lesson-packs.mjs", "--check"], ["scripts/career/validate-v3-content.mjs"]]) {
    const r = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(r.status, 0, args[0] + "\n" + r.stderr);
  }
});
