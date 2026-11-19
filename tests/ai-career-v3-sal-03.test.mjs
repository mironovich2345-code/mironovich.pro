import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { loadPack, validatePack, hygieneIssues, addWorkingDays } from "../scripts/career/validate-v3-lesson-pack.mjs";
import { PACKS } from "../scripts/career/v3-lesson-packs.mjs";

const base = loadPack("sal-03");
const fresh = () => structuredClone(base);
const issues = (ctx) => validatePack(ctx).join("; ");
const L = (ctx) => ctx.lessons["SAL-03"];
const K = (ctx, i) => ctx.practice["SAL-03"].exercises[i];

test("SAL-03 passes the full gate", () => {
  assert.deepEqual(validatePack(base), []);
  assert.deepEqual(PACKS["sal-03"].ids, ["SAL-03"]);
});

test("stays in review, unpublished, with unchecked facts and a planned slot", () => {
  const l = L(base);
  assert.equal(l.status, "review");
  assert.equal(l.quality.canBePublished, false);
  assert.equal(l.quality.reviewedOn, null);
  assert.equal(l.sourcePolicy.factualClaimsChecked, false);
  const slot = base.catalog.slots.find((s) => s.id === "SAL-03");
  assert.equal(slot.status, "planned");
  assert.equal(slot.publishedLessonId, null);
  const ctx = fresh();
  L(ctx).status = "approved";
  L(ctx).quality.canBePublished = true;
  ctx.catalog.slots.find((s) => s.id === "SAL-03").publishedLessonId = "SAL-03";
  const out = issues(ctx);
  assert.match(out, /must stay in review/);
  assert.match(out, /must not be publishable/);
  assert.match(out, /slot must stay unpublished/);
});

test("links: role tasks of scenario S03, subtypes served by the tasks, safety prerequisites", () => {
  const a = L(base).audience;
  assert.deepEqual(a.taskIds, ["T11", "T12"]);
  assert.equal(a.scenarioId, "S03");
  const ctx = fresh();
  L(ctx).audience.taskIds.push("T05");
  assert.match(issues(ctx), /task T05 not in scenario/);
  const pre = fresh();
  L(pre).prerequisites.push("SAL-01");
  assert.match(issues(pre), /prerequisite SAL-01 must be a safety slot/);
});

test("full lesson structure: theory, two worked examples, procedure, templates, manual route, quiz", () => {
  const c = L(base).content;
  assert.ok(c.explanations.length >= 5 && c.workedExamples.length === 2 && c.procedure.length >= 6);
  assert.ok(c.exercises.length >= 2 && c.quiz.length >= 5);
  const kinds = new Set(c.templates.map((t) => t.kind));
  for (const k of ["prompt", "checklist", "script", "measurement_sheet"]) assert.ok(kinds.has(k), k);
  assert.match(L(base).security.ifToolForbidden, /вручную/);
  assert.match(L(base).security.ifToolForbidden, /TPL-SAL03-OFFER/);
});

test("offer arithmetic and dates are recomputed from the price list", () => {
  const n = K(base, 1).answerKey.numbers;
  assert.equal(n.subscriptionGross, 288000);
  assert.equal(n.discount, 14400);
  assert.equal(n.firstYearTotal, 318600);
  assert.equal(addWorkingDays("2026-12-01", 10), "2026-12-15");
  assert.equal(n.launchDate, "2026-12-15");
  assert.equal(n.validUntil, "2026-12-11");
  const whole = fresh();
  K(whole, 1).answerKey.numbers.discount = Math.round((288000 + 45000) * 0.05); // discount on the whole sum
  assert.match(issues(whole), /discount must apply to the subscription only/);
  const days = fresh();
  K(days, 1).answerKey.numbers.launchDate = "2026-12-11"; // calendar days instead of working days
  assert.match(issues(days), /working days/);
  const review = fresh();
  K(review, 1).answerKey.numbers.aiTotalMinutes = 4; // generation only
  assert.match(issues(review), /AI time must include review/);
});

test("the model never sets prices, discounts, terms or guarantees; a human approves before sending", () => {
  const prompt = fresh();
  const t = L(prompt).content.templates.find((x) => x.id === "TPL-SAL03-PROMPT-DRAFT");
  t.body = t.body.replace("Не назначай скидки и не меняй числа. ", "Предложи подходящую скидку. ");
  assert.match(issues(prompt), /draft prompt must forbid setting/);
  const final = fresh();
  const ex2 = L(final).content.exercises[1];
  ex2.sampleSolution = ex2.sampleSolution.replace("скидка 5% при оплате за 12 месяцев — ", "скидка 10% по просьбе клиента, 5% при оплате за 12 месяцев — ");
  assert.match(issues(final), /safe final offer must exclude the requested discount/);
  const fixed = fresh();
  const ex1 = L(fixed).content.exercises[0];
  ex1.sampleSolution += " Поддержка 24/7.";
  assert.match(issues(fixed), /corrected draft keeps invented terms/);
  const offer = fresh();
  const o = L(offer).content.templates.find((x) => x.id === "TPL-SAL03-OFFER");
  o.body = o.body.replace("Статус: ЧЕРНОВИК — не отправлять до согласования. ", "");
  assert.match(issues(offer), /offer template must stay a draft/);
});

test("answer keys: every finding is quoted from the input and addressed in the sample solution", () => {
  const k1 = K(base, 0).answerKey.findings.map((f) => f.type);
  assert.ok(k1.length >= 8 && k1.includes("invented_discount") && k1.includes("invented_claim"));
  const drift = fresh();
  const ex = L(drift).content.exercises[0];
  ex.syntheticInput = ex.syntheticInput.replace("скидку 15%", "скидку");
  assert.match(issues(drift), /key quote not in input: скидку 15%/);
  const weak = fresh();
  const ex2 = L(weak).content.exercises[1];
  ex2.sampleSolution = ex2.sampleSolution.replaceAll("вопрос руководителю", "включить");
  assert.match(issues(weak), /sample solution misses: вопрос руководителю/);
});

test("sources: registry match, reviewed hosts, registered civil-code citations", () => {
  const unreg = fresh();
  L(unreg).content.explanations[0].body += " См. также ГК РФ, ст. 438.";
  assert.match(issues(unreg), /unregistered legal citation ГК РФ, ст\. 438/);
  const missing = fresh();
  L(missing).sources = L(missing).sources.filter((s) => s.id !== "SRC-GK-435");
  assert.match(issues(missing), /cites ГК РФ, ст\. 435 without SRC-GK-435/);
  const host = fresh();
  L(host).sources[0].url = "https://example.org/law";
  assert.match(issues(host), /source host not reviewed/);
});

test("hygiene: fictional .example contacts only, no outcome promises, correct weekdays", () => {
  const t = JSON.stringify(L(base));
  assert.match(t, /tehnosklad-demo\.example/);
  assert.ok(hygieneIssues("пишите на sales@nord-soft.ru", "body").length);
  assert.ok(hygieneIssues("данные передадут в среду, 01.12", "body").length);
  const ctx = fresh();
  L(ctx).content.summary[0] += " Это гарантирует рост продаж.";
  assert.match(issues(ctx), /outcome promise/);
  const code = fresh();
  L(code).content.exercises[0].syntheticInput += " Задача T11.";
  assert.match(issues(code), /internal task code in learner text/);
});

test("plan candidates: four distinct steps, doing first without a prompt, follow-ups verify or measure", () => {
  const steps = base.plan.steps;
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.map((s) => s.templateId), ["TPL-SAL03-REQUEST", "TPL-SAL03-AICHECK", "TPL-SAL03-TERMS", "TPL-SAL03-SHEET"]);
  assert.equal(new Set(steps.map((s) => s.expectedArtifact)).size, 4);
  const promptFirst = fresh();
  promptFirst.plan.steps[0].templateId = "TPL-SAL03-PROMPT-DRAFT";
  assert.match(issues(promptFirst), /must not require a prompt/);
  const followUp = fresh();
  followUp.plan.steps[1].templateId = "TPL-SAL03-OFFER";
  assert.match(issues(followUp), /must be a checklist or measurement sheet/);
  const tooMany = fresh();
  tooMany.plan.steps.push({ ...structuredClone(tooMany.plan.steps[0]), stepId: "STEP-05", position: 5, action: tooMany.plan.steps[0].action + " Ещё раз.", expectedArtifact: "Другая разметка запроса по трём меткам для повторной попытки." });
  assert.match(issues(tooMany), /more than 4 steps for SAL-03/);
});

test("validator and worksheet CLIs pass; the v3 content validator still passes", () => {
  for (const args of [["scripts/career/validate-v3-lesson-pack.mjs", "sal-03"], ["scripts/career/v3-lesson-packs.mjs", "--check"], ["scripts/career/validate-v3-content.mjs"]]) {
    const r = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(r.status, 0, args[0] + "\n" + r.stderr);
  }
  const ctx = fresh();
  ctx.worksheets["SAL-03"] += "\nручная правка";
  assert.match(issues(ctx), /worksheet is stale/);
});
