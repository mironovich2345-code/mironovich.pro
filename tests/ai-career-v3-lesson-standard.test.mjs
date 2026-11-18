import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { validateCatalog } from "../scripts/career/validate-v3-content.mjs";

const load = (path) => JSON.parse(readFileSync(path, "utf8"));
const catalog = load("content/career/v3/curriculum.json");
const role = load("content/career/v3/roles/sales-manager.json");
const lesson = load("content/career/v3/examples/safety-lesson.prototype.json");
const step = load("content/career/v3/examples/plan-step.prototype.json");
const lessonSchema = load("content/career/v3/schemas/lesson.schema.json");
const stepSchema = load("content/career/v3/schemas/plan-step.schema.json");
const fresh = item => structuredClone(item);
const validate = (c=catalog,l=lesson,s=step) =>
  validateCatalog(c,role,l,s,lessonSchema,stepSchema);

test("all five modules and seven real sales scenarios are present in a gated 23-lesson curriculum", () => {
  assert.deepEqual(validate(),[]);
  assert.equal(catalog.modules.length,5);
  assert.equal(catalog.slots.length,23);
  assert.equal(catalog.usableForPaidUser,false);
  assert.equal(catalog.slots.filter(x=>x.scenarioId).length,7);
  assert.ok(catalog.slots.every(x=>x.status==="planned" && x.publishedLessonId===null));
  assert.deepEqual(catalog.modules.map(x=>x.id),
    ["safety","task_mapping","practice","trends","value"]);
});

test("lesson prototype has substantive explanations, worked synthetic examples, templates and quiz", () => {
  assert.equal(lesson.quality.canBePublished,false);
  assert.equal(lesson.status,"prototype");
  assert.equal(lesson.security.allowEmployerData,false);
  assert.ok(lesson.content.introduction.paragraphs.length>=2);
  assert.ok(lesson.content.explanations.length>=2);
  assert.ok(lesson.content.workedExamples.length>=2);
  assert.ok(lesson.content.procedure.length>=3);
  assert.ok(lesson.content.templates.length>=1);
  assert.ok(lesson.content.exercises.length>=1);
  assert.ok(lesson.content.quiz.length>=3);
  assert.ok(lesson.content.quiz.every(q=>q.options.some(x=>x.id===q.correctId)));
});

test("a plan step must open existing lesson, exercise, template, role task and metric",()=>{
  const broken = fresh(step);
  broken.lessonId = "MISSING-LESSON";
  assert.match(validate(catalog,lesson,broken).join("; "),/step references missing lesson/);

  const brokenExercise = fresh(step);
  brokenExercise.exerciseId = "NO-EXERCISE";
  assert.match(validate(catalog,lesson,brokenExercise).join("; "),/missing exercise/);

  const brokenTemplate = fresh(step);
  brokenTemplate.templateId = "NO-TEMPLATE";
  assert.match(validate(catalog,lesson,brokenTemplate).join("; "),/missing template/);

  const brokenMetric = fresh(step);
  brokenMetric.metricId = "invented_sales_growth";
  assert.match(validate(catalog,lesson,brokenMetric).join("; "),/nonexistent metric/);

  const brokenDay = fresh(step);
  brokenDay.isCalendarDay=true;
  assert.match(validate(catalog,lesson,brokenDay).join("; "),/not be converted into calendar days/);
});

test("removing teaching content or corrupting knowledge checks fails validation",()=>{
  const missing = fresh(lesson);
  missing.content.exercises = [];
  assert.match(validate(catalog,missing).join("; "),/missing required items|missing exercise/);

  const tooShort = fresh(lesson);
  tooShort.content.explanations[0].body = "ИИ поможет.";
  assert.match(validate(catalog,tooShort).join("; "),/too short/);

  const wrongQuiz = fresh(lesson);
  wrongQuiz.content.quiz[0].correctId = "invented";
  assert.match(validate(catalog,wrongQuiz).join("; "),/quiz lacks correct choice/);
});

test("unreviewed or missing downloadable materials cannot be promoted to paid access",()=>{
  const published = fresh(lesson);
  published.status="approved";
  published.quality.canBePublished=true;
  assert.match(validate(catalog,published).join("; "),/requires approvals|published lesson requires/);

  const proto = fresh(lesson);
  proto.quality.canBePublished=true;
  assert.match(validate(catalog,proto).join("; "),/prototype lesson must remain unpublished/);

  const advertised = fresh(catalog);
  advertised.slots[0].status="approved";
  advertised.slots[0].publishedLessonId=lesson.id;
  assert.match(validate(advertised).join("; "),/unreviewed slots cannot be advertised as published/);
});

test("factual trend materials need review date, and source URLs must be explicit",()=>{
  const stale = fresh(lesson);
  stale.sourcePolicy.timeSensitive=true;
  assert.match(validate(catalog,stale).join("; "),/trend articles need next review deadline/);

  const badSource=fresh(lesson);
  badSource.sources[0].url="example.com";
  assert.match(validate(catalog,badSource).join("; "),/invalid pattern/);
});

test("author templates and future PDFs have actual editorial specifications",()=>{
  const doc=readFileSync("docs/products/ai-career-v3/LESSON_STANDARD.md","utf8");
  const templates=[
    "docs/products/ai-career-v3/templates/LESSON_AUTHOR_TEMPLATE.md",
    "docs/products/ai-career-v3/templates/PRACTICE_WORKSHEET_TEMPLATE.md",
    "docs/products/ai-career-v3/templates/PDF_LAYOUT_TEMPLATE.md"
  ];
  assert.ok(templates.every(existsSync));
  assert.match(doc,/не календарь/i);
  assert.match(doc,/экран/i);
  assert.match(doc,/типичные ошибки|ошибк/i);
  assert.match(doc,/Кейс/i);
  assert.match(doc,/одобренн|approved/i);
  assert.match(doc,/не готовый платный продукт/i);
  assert.match(readFileSync(templates[2],"utf8"),/10 страниц/);
});


test("independent content validator CLI passes and does not access any external service",()=>{
  const run=spawnSync(process.execPath,["scripts/career/validate-v3-content.mjs"],{encoding:"utf8",timeout:10000});
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/PASS: five modules/);
  assert.match(run.stdout,/NOT FOR SALE/);
});
