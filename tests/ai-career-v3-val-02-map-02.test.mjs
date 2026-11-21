import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { loadPack, validatePack } from "../scripts/career/validate-v3-lesson-pack.mjs";
import { fmt } from "../scripts/career/lesson-checks/VAL-02.mjs";

const base = loadPack("val-02-map-02");
const fresh = () => structuredClone(base);
const issues = (ctx) => validatePack(ctx).join("; ");
const V = (ctx) => ctx.lessons["VAL-02"];
const M = (ctx) => ctx.lessons["MAP-02"];
const KV = (ctx, i) => ctx.practice["VAL-02"].exercises[i];
const KM = (ctx, i) => ctx.practice["MAP-02"].exercises[i];

test("VAL-02 and MAP-02 pass the full gate", () => {
  assert.deepEqual(validatePack(base), []);
});

test("both stay in review, unpublished, with unchecked facts and planned slots", () => {
  for (const id of ["VAL-02", "MAP-02"]) {
    const l = base.lessons[id];
    assert.equal(l.status, "review");
    assert.equal(l.quality.canBePublished, false);
    assert.equal(l.sourcePolicy.factualClaimsChecked, false);
    const slot = base.catalog.slots.find((s) => s.id === id);
    assert.equal(slot.status, "planned");
    assert.equal(slot.publishedLessonId, null);
  }
  const ctx = fresh();
  V(ctx).status = "approved";
  assert.match(issues(ctx), /VAL-02: must stay in review/);
});

test("they build on VAL-01 and MAP-01 without repeating them; practice lessons cannot chain", () => {
  assert.deepEqual(V(base).prerequisites, ["SAF-01", "VAL-01"]);
  assert.deepEqual(M(base).prerequisites, ["SAF-01", "SAF-02", "MAP-01"]);
  const later = fresh();
  V(later).prerequisites.push("VAL-03");
  assert.match(issues(later), /prerequisite VAL-03 must be a safety slot or an earlier slot/);
  const cross = fresh();
  M(cross).prerequisites.push("VAL-01");
  assert.match(issues(cross), /prerequisite VAL-01 must be a safety slot or an earlier slot/);
  const titles = (l) => l.content.exercises.map((e) => e.title).join(" | ");
  assert.doesNotMatch(titles(V(base)), /Выбрать показатель/);
  assert.doesNotMatch(titles(M(base)), /Карта задач/);
});

test("VAL-02 arithmetic, exercise 1: review and fix included, percent of before, percentage points", () => {
  const n = KV(base, 0).answerKey.numbers;
  assert.equal(n.beforeAvg, 19);
  assert.equal(n.afterAvg, 12.5);
  assert.equal(n.generationOnlyAvg, 2.25);
  assert.equal(n.percentChange, -34);
  assert.equal(n.generationOnlyPercent, -88, "the colleague's 88% is the generation-only figure");
  assert.equal(n.percentagePoints, 25);
  assert.equal(n.relativeQualityChange, 50);
  assert.deepEqual(n.excluded, ["З-9"]);
  assert.equal(fmt(12.5), "12,5");
  const genOnly = fresh();
  KV(genOnly, 0).answerKey.numbers.afterAvg = 2.25;
  assert.match(issues(genOnly), /exercise 1 averages/);
  const tender = fresh();
  KV(tender, 0).after.find((r) => r.id === "З-9").comparable = true;
  assert.match(issues(tender), /exercise 1 averages|excluded tasks/);
  const points = fresh();
  KV(points, 0).answerKey.numbers.percentagePoints = 50;
  assert.match(issues(points), /percentage points/);
});

test("VAL-02 arithmetic, exercise 2: comparable rows only, wrong base corrected", () => {
  const n = KV(base, 1).answerKey.numbers;
  assert.deepEqual([n.beforeAvg, n.afterAvg, n.absDiff, n.percentChange, n.percentagePoints], [25, 18, -7, -28, 40]);
  assert.equal(KV(base, 1).claim.correctPercent, -60);
  const short = fresh();
  KV(short, 1).afterShortCalls[0].comparable = true;
  assert.match(issues(short), /short calls must be excluded/);
  const base150 = fresh();
  KV(base150, 1).claim.correctPercent = -150;
  assert.match(issues(base150), /claimed percent/);
});

test("VAL-02 wording never claims causation and states limits", () => {
  const ctx = fresh();
  const ex = V(ctx).content.exercises[1];
  ex.sampleSolution = ex.sampleSolution.replace("Рост продлений с ИИ не связываем", "Благодаря ИИ выросли продления");
  assert.match(issues(ctx), /wording must state limits and make no causal claim/);
  const ex1 = fresh();
  const e = V(ex1).content.exercises[0];
  e.sampleSolution = e.sampleSolution.replace("+25 процентных пунктов", "+25%");
  assert.match(issues(ex1), /misses \+25 процентных пунктов/);
});

test("MAP-02 scheme: AI only prepares; decisions and actions stay with people", () => {
  const scheme = KM(base, 0).answerKey.scheme;
  assert.deepEqual(scheme.filter((p) => p.performer === "ai").map((p) => p.kind), ["preparation"]);
  const send = fresh();
  KM(send, 0).answerKey.scheme.find((p) => p.part === "Отправить письмо").performer = "ai";
  assert.match(issues(send), /AI may only prepare|decision or action must stay with a person/);
  const crm = fresh();
  KM(crm, 0).answerKey.scheme.find((p) => p.part.startsWith("Обновить этап")).performer = "system";
  assert.match(issues(crm), /must stay with a person|no system part/);
  const disc = fresh();
  KM(disc, 0).answerKey.scheme.find((p) => p.part === "Ответ о скидке").performer = "ai";
  assert.match(issues(disc), /AI may only prepare/);
});

test("MAP-02 comparison: automatic sending is never chosen; arithmetic per day", () => {
  const n = KM(base, 1).answerKey.numbers;
  assert.deepEqual([n.manualPerDay, n.assistantPerDay, n.autoPerDay, n.savingPerDay, n.savingPercent], [440, 320, 40, 120, 27]);
  const auto = fresh();
  KM(auto, 1).answerKey.chosen = "auto_send";
  assert.match(issues(auto), /automatic sending must never be chosen|must be permitted/);
  const queue = fresh();
  KM(queue, 1).variants.find((v) => v.id === "queue_draft").available = true;
  assert.match(issues(queue), /unapproved integration must be unavailable/);
});

test("MAP-02: not worth automating is justified by reasons; examples cover B2B, inbound and account", () => {
  const k3 = KM(base, 2).answerKey;
  assert.equal(k3.conclusion, "automation_not_justified");
  assert.deepEqual([k3.numbers.prepPerMonth, k3.numbers.claimedSavingPerMonth], [240, 90]);
  const thin = fresh();
  KM(thin, 2).answerKey.reasons = ["low_frequency"];
  assert.match(issues(thin), /at least five reasons/);
  assert.deepEqual(base.practice["MAP-02"].exercises.map((e) => e.subtype), ["outbound_b2b", "inbound", "account"]);
  const prompt = fresh();
  const t = M(prompt).content.templates.find((x) => x.id === "TPL-MAP02-PROMPT-SPLIT");
  t.body = t.body.replace("Не предлагай автоматическую отправку сообщений, изменение CRM и коммерческих условий без разрешения и контроля человека. ", "");
  assert.match(issues(prompt), /must forbid automatic sending/);
});

test("plan candidates: four per lesson, distinct artifacts, doing first without a prompt", () => {
  const steps = base.plan.steps;
  assert.equal(steps.length, 8);
  for (const id of ["VAL-02", "MAP-02"]) assert.equal(steps.filter((s) => s.lessonId === id).length, 4);
  assert.equal(new Set(steps.map((s) => s.expectedArtifact)).size, 8);
  for (const s of steps) assert.notEqual(base.lessons[s.lessonId].content.templates.find((t) => t.id === s.templateId).kind, "prompt");
  const rep = fresh();
  rep.plan.steps[1].expectedArtifact = rep.plan.steps[0].expectedArtifact;
  rep.plan.steps[1].completionCriteria = [...rep.plan.steps[0].completionCriteria];
  assert.match(issues(rep), /repeated action or artifact|repeats/);
});

test("validator and worksheet CLIs pass; the v3 content validator still passes", () => {
  for (const args of [["scripts/career/validate-v3-lesson-pack.mjs", "val-02-map-02"], ["scripts/career/v3-lesson-packs.mjs", "--check"], ["scripts/career/validate-v3-content.mjs"]]) {
    const r = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(r.status, 0, args[0] + "\n" + r.stderr);
  }
});
