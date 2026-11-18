import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  loadSalesContext, validateSalesLessons, weekdayIssues, quoteIssues, personalDataIssues, strings
} from "../scripts/career/validate-v3-sales-lessons.mjs";
import { SALES_LESSON_IDS } from "../scripts/career/build-sales-lesson-materials.mjs";

const base = loadSalesContext();
const fresh = () => structuredClone(base);
const issues = ctx => validateSalesLessons(ctx).join("; ");

test("SAL-02 and SAL-05 pass the full sales lesson gate", () => {
  assert.deepEqual(validateSalesLessons(base), []);
  assert.deepEqual(SALES_LESSON_IDS, ["SAL-02", "SAL-05"]);
});

test("lessons are complete by LESSON_STANDARD and stay in review", () => {
  for (const id of SALES_LESSON_IDS) {
    const l = base.lessons[id];
    const c = l.content;
    assert.equal(l.status, "review");
    assert.equal(l.quality.canBePublished, false);
    assert.equal(l.quality.reviewedOn, null);
    assert.ok(l.objectives.length >= 2 && l.durationMinutes > 0 && l.audience.levels.length >= 1);
    assert.ok(c.explanations.length >= 4, id + " needs a clear explanation");
    assert.ok(c.workedExamples.length >= 2);
    for (const ex of c.workedExamples) assert.ok(ex.unsafeAttempt && ex.safeApproach && ex.workedOutput && ex.humanReview);
    assert.ok(c.procedure.length >= 5, id + " needs a repeatable procedure");
    assert.ok(c.templates.filter(t => t.kind === "prompt").length >= 2);
    for (const t of c.templates.filter(t => t.kind === "prompt")) assert.ok(t.prohibitedInputs.length >= 1, t.id + " must explain its limits");
    assert.ok(c.exercises.length >= 2);
    for (const x of c.exercises) assert.ok(x.sampleSolution.length >= 400, x.id + " needs a full sample result");
    assert.ok(c.quiz.length >= 5);
    assert.ok(l.downloads.some(d => d.kind === "worksheet") && l.downloads.some(d => d.kind === "example_dataset"));
    assert.equal(base.catalog.slots.find(s => s.id === id).status, "planned");
  }
});

test("lessons are bound to existing tasks and scenarios of the sales role", () => {
  assert.equal(base.lessons["SAL-02"].audience.scenarioId, "S02");
  assert.equal(base.lessons["SAL-05"].audience.scenarioId, "S05");
  const broken = fresh();
  broken.lessons["SAL-02"].audience.taskIds.push("T09");
  assert.match(issues(broken), /task T09 is not in scenario S02/);
  const unknown = fresh();
  unknown.lessons["SAL-05"].audience.taskIds.push("T99");
  assert.match(issues(unknown), /unknown task T99/);
});

test("publication, approval or employer data cannot slip in", () => {
  const ctx = fresh();
  ctx.lessons["SAL-02"].status = "approved";
  ctx.lessons["SAL-02"].quality.canBePublished = true;
  ctx.lessons["SAL-05"].security.allowEmployerData = true;
  ctx.catalog.slots.find(s => s.id === "SAL-05").publishedLessonId = "SAL-05";
  const out = issues(ctx);
  assert.match(out, /must stay in review/);
  assert.match(out, /must not be publishable/);
  assert.match(out, /employer data must be prohibited/);
  assert.match(out, /slot must not be published/);
});

test("every referenced template, exercise and material exists and IDs are unique", () => {
  const dupe = fresh();
  dupe.lessons["SAL-05"].content.templates[0].id = "TPL-SAL02-BRIEF";
  assert.match(issues(dupe), /duplicate ID TPL-SAL02-BRIEF/);
  const missingTpl = fresh();
  missingTpl.lessons["SAL-02"].content.procedure[0].instruction += " См. TPL-SAL02-NOPE.";
  assert.match(issues(missingTpl), /missing template TPL-SAL02-NOPE/);
  const missingFile = fresh();
  missingFile.lessons["SAL-05"].downloads[0].repositoryPath = "content/career/v3/materials/sales/SAL-05/none.md";
  assert.match(issues(missingFile), /download missing/);
  const stale = fresh();
  stale.worksheets["SAL-02"] += "\nправка вручную";
  assert.match(issues(stale), /worksheet is stale/);
});

test("practice data matches exercises and the answer key covers each planted error", () => {
  for (const id of SALES_LESSON_IDS) {
    const data = base.practice[id];
    assert.equal(data.syntheticOnly, true);
    for (const item of data.exercises) assert.ok(item.answerKey.errors.length >= 4, item.exerciseId);
  }
  const drift = fresh();
  drift.lessons["SAL-02"].content.exercises[0].syntheticInput = drift.lessons["SAL-02"].content.exercises[0].syntheticInput.replace("25%", "35%");
  assert.match(issues(drift), /AI draft of SAL02-TASK-1 differs/);
  const weak = fresh();
  weak.lessons["SAL-05"].content.exercises[0].sampleSolution = weak.lessons["SAL-05"].content.exercises[0].sampleSolution.replace("главный бухгалтер", "посторонний");
  assert.match(issues(weak), /does not address «главный бухгалтер»/);
  const long = fresh();
  long.lessons["SAL-02"].content.exercises[1].sampleSolution =
    long.lessons["SAL-02"].content.exercises[1].sampleSolution.replace("Follow-up: «Спасибо за встречу!", "Follow-up: «Спасибо за встречу!" + " очень".repeat(80));
  assert.match(issues(long), /exceeds word limit/);
});

test("sources are dated, registered, from reviewed hosts and back every legal citation", () => {
  for (const s of base.registry.sources) {
    assert.match(s.url, /^https:\/\//);
    assert.match(s.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  }
  const unregistered = fresh();
  unregistered.lessons["SAL-02"].content.explanations[0].body += " См. 63-ФЗ, ст. 6.";
  assert.match(issues(unregistered), /unregistered legal citation 63-ФЗ, ст\. 6/);
  const noSource = fresh();
  noSource.lessons["SAL-05"].sources = noSource.lessons["SAL-05"].sources.filter(s => s.id !== "SRC-152FZ-10");
  assert.match(issues(noSource), /cites 152-ФЗ, ст\. 10 without source/);
  const host = fresh();
  host.lessons["SAL-02"].sources[0].url = "https://example.org/law";
  host.registry.sources.find(s => s.id === host.lessons["SAL-02"].sources[0].id).url = "https://example.org/law";
  assert.match(issues(host), /source host not in reviewed list/);
});

test("SAL-02 separates writing a letter from the right to send it and never promises legality of cold email", () => {
  const l = base.lessons["SAL-02"];
  const text = JSON.stringify(l);
  assert.match(text, /право его отправить/);
  assert.match(text, /не подтверждено — отправка запрещена до согласования/);
  assert.doesNotMatch(text, /холодн[а-я]+ (письм[а-я]*|рассылк[а-я]*) (всегда|можно|разрешен)/i);
  assert.doesNotMatch(text, /(обойти|без) согласи[яе] (можно|разрешено)/i);
  assert.doesNotMatch(text, /массов[а-я]+ рассылк[а-я]+ (с ИИ|через ИИ)/i);
  assert.ok(l.content.quiz.some(q => /больше не пишите/.test(q.question)));
});

test("SAL-05 keeps assumptions out of commitments and CRM", () => {
  const l = base.lessons["SAL-05"];
  const text = JSON.stringify(l);
  for (const phrase of ["Подтверждённые факты", "Открытые вопросы", "Неподтверждённые предположения", "не обсуждали"]) assert.ok(text.includes(phrase), phrase);
  const crm = l.content.templates.find(t => t.id === "TPL-SAL05-CRM");
  assert.match(crm.body, /Гипотезы и что проверить/);
  assert.match(crm.body, /только подтверждённая/);
  const task2 = base.practice["SAL-05"].exercises.find(x => x.exerciseId === "SAL05-TASK-2");
  assert.equal(task2.answerKey.expectedStage, task2.crmBefore.stage);
});

test("every learner exercise has a safe route when AI is forbidden", () => {
  const forbid = base.routing.safeVariants.find(v => v.condition.Q12?.includes("prohibited"));
  for (const id of SALES_LESSON_IDS) {
    assert.ok(forbid.manualTemplates[id].length >= 2);
    assert.match(base.lessons[id].security.ifToolForbidden, /вручную/);
  }
  const ctx = fresh();
  ctx.routing.safeVariants.find(v => v.ruleId === "SAFE-01").manualTemplates["SAL-02"] = ["TPL-SAL02-PROMPT-FIRST"];
  assert.match(issues(ctx), /is not a manual template/);
  const noRule = fresh();
  noRule.routing.safeVariants = noRule.routing.safeVariants.filter(v => v.ruleId !== "SAFE-04");
  assert.match(issues(noRule), /SAFE-04 has no variant/);
  const badOption = fresh();
  badOption.routing.safeVariants[0].condition.Q12.push("maybe");
  assert.match(issues(badOption), /unknown option Q12=maybe/);
});

test("plan-step candidates fit the 30-step constructor contract", () => {
  const steps = base.plan.steps;
  assert.ok(steps.length >= 4 && steps.length <= 30);
  assert.ok(steps.every(s => s.isCalendarDay === false));
  const ctx = fresh();
  ctx.plan.steps[1].exerciseId = "SAL02-TASK-9";
  ctx.plan.steps[2].metricId = "invented_growth";
  ctx.plan.steps[3].isCalendarDay = true;
  const out = issues(ctx);
  assert.match(out, /STEP-02: missing exercise/);
  assert.match(out, /STEP-03: unknown metric/);
  assert.match(out, /bad constant|not calendar days/);
});

test("text helpers catch wrong weekdays, broken quotes and real-looking personal data", () => {
  assert.deepEqual(weekdayIssues("в четверг, 26.11, в 11:00; 28.11.2026 — суббота"), []);
  assert.match(weekdayIssues("в пятницу, 28.11").join(), /суббота/);
  assert.deepEqual(weekdayIssues("черновик «в пятницу, 28.11» — ошибка"), []);
  assert.deepEqual(quoteIssues("«внешние „внутренние“ кавычки»"), []);
  assert.ok(quoteIssues("«незакрытые „кавычки»").length > 0);
  assert.deepEqual(personalDataIssues("info@agrotech-demo.example.com, +7 (000) 000-00-00"), []);
  assert.ok(personalDataIssues("ivan@mail.ru").length > 0);
  assert.ok(personalDataIssues("+7 (912) 345-67-89").length > 0);
});

test("all lesson text avoids real contacts and URLs outside the source list", () => {
  for (const id of SALES_LESSON_IDS) {
    for (const [path, text] of strings({ lesson: base.lessons[id], data: base.practice[id] })) {
      if (path.endsWith(".url")) continue;
      assert.doesNotMatch(text, /https?:\/\//, path);
    }
  }
});

test("validator and worksheet builder CLIs pass", () => {
  const v = spawnSync(process.execPath, ["scripts/career/validate-v3-sales-lessons.mjs"], { encoding: "utf8" });
  assert.equal(v.status, 0, v.stderr);
  assert.match(v.stdout, /REVIEW ONLY/);
  const w = spawnSync(process.execPath, ["scripts/career/build-sales-lesson-materials.mjs", "--check"], { encoding: "utf8" });
  assert.equal(w.status, 0, w.stderr);
});
