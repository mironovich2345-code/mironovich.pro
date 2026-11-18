#!/usr/bin/env node
// Quality gate for practical sales lessons (SAL-*) of AI Career v3: schema, IDs, links to the
// role matrix, curriculum, diagnostic, materials, sources and plan-step candidates.
// No network, production APIs or real personal data are used.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { schemaCheck } from "./validate-v3-content.mjs";
import { SALES_LESSON_IDS, renderWorksheet, worksheetPath } from "./build-sales-lesson-materials.mjs";

const root = new URL("../../", import.meta.url);
const readText = p => readFileSync(new URL(p, root), "utf8");
const readJson = p => JSON.parse(readText(p));
const fileExists = p => typeof p === "string" && !p.includes("..") && existsSync(new URL(p, root));

export const ALLOWED_SOURCE_HOSTS = ["www.consultant.ru", "nvlpubs.nist.gov", "genai.owasp.org"];
const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const WEEKDAY_FORMS = {
  "понедельник": 1, "вторник": 2, "среда": 3, "среду": 3, "четверг": 4,
  "пятница": 5, "пятницу": 5, "суббота": 6, "субботу": 6, "воскресенье": 0
};
// Exercise inputs and AI drafts contain deliberate errors for learners to find.
const DELIBERATE_ERROR_FIELDS = new Set(["syntheticInput", "unsafeAttempt", "aiDraft", "aiSummary", "quote", "cue"]);

export function loadSalesContext() {
  const lessons = Object.fromEntries(SALES_LESSON_IDS.map(id => [id, readJson(`content/career/v3/lessons/${id}.json`)]));
  const practice = Object.fromEntries(SALES_LESSON_IDS.map(id => [id, readJson(`content/career/v3/materials/sales/${id}/practice-data.json`)]));
  return {
    lessons, practice,
    worksheets: Object.fromEntries(SALES_LESSON_IDS.map(id => [id, fileExists(worksheetPath(id)) ? readText(worksheetPath(id)) : null])),
    catalog: readJson("content/career/v3/curriculum.json"),
    role: readJson("content/career/v3/roles/sales-manager.json"),
    diagnostic: readJson("content/career/v3/diagnostic-sales.json"),
    lessonSchema: readJson("content/career/v3/schemas/lesson.schema.json"),
    stepSchema: readJson("content/career/v3/schemas/plan-step.schema.json"),
    registry: readJson("content/career/v3/materials/sales/sources.json"),
    routing: readJson("content/career/v3/routing/sales-practice-lessons.json"),
    plan: readJson("content/career/v3/plan-candidates/sales-practice.json"),
    today: new Date().toISOString().slice(0, 10)
  };
}

export function* strings(value, path = "") {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${path}[${i}]`);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k);
}

export function weekdayIssues(text, year = 2026) {
  const issues = [];
  const plain = text.replace(/«[^«»]*»/g, " ");
  const check = (word, dd, mm, yy) => {
    const expected = WEEKDAY_FORMS[word.toLowerCase()];
    if (expected === undefined) return;
    const d = new Date(Date.UTC(Number(yy || year), Number(mm) - 1, Number(dd)));
    if (d.getUTCDay() !== expected) issues.push(`${dd}.${mm}${yy ? "." + yy : ""} is ${WEEKDAYS[d.getUTCDay()]}, not ${word}`);
  };
  const forms = Object.keys(WEEKDAY_FORMS).join("|");
  for (const m of plain.matchAll(new RegExp(`(${forms}),?\\s+(\\d{2})\\.(\\d{2})(?:\\.(\\d{4}))?`, "gi"))) check(m[1], m[2], m[3], m[4]);
  for (const m of plain.matchAll(new RegExp(`(\\d{2})\\.(\\d{2})(?:\\.(\\d{4}))?\\s*(?:—|\\()\\s*(${forms})`, "gi"))) check(m[4], m[1], m[2], m[3]);
  return issues;
}

export function quoteIssues(text) {
  const issues = [];
  const stack = [];
  for (const ch of text) {
    if (ch === "«" || ch === "„") stack.push(ch);
    else if (ch === "»" || ch === "“") {
      const open = stack.pop();
      if ((ch === "»" && open !== "«") || (ch === "“" && open !== "„")) { issues.push("unbalanced " + ch); break; }
    }
  }
  if (stack.length) issues.push("unclosed " + stack.join(""));
  return issues;
}

export function personalDataIssues(text) {
  const issues = [];
  for (const m of text.matchAll(/[\w.+-]+@([\w-]+\.)+[\w-]+/g)) {
    if (!/@([\w-]+\.)*example\.com$/i.test(m[0])) issues.push("email outside example.com: " + m[0]);
  }
  for (const m of text.matchAll(/(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g)) {
    if (!/\(000\)/.test(m[0])) issues.push("phone-like number: " + m[0]);
  }
  if (/\b\d{10}\b|\b\d{12}\b/.test(text)) issues.push("INN-like number");
  if (/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/.test(text)) issues.push("card-like number");
  return issues;
}

export function validateSalesLessons(ctx) {
  const e = [];
  const good = (ok, msg) => { if (!ok) e.push(msg); };
  const { lessons, practice, catalog, role, diagnostic, lessonSchema, stepSchema, registry, routing, plan, worksheets } = ctx;
  const slotIds = new Set(catalog.slots.map(s => s.id));
  const roleTasks = new Map(role.tasks.map(t => [t.id, t]));
  const subtypeIds = new Set(role.subtypes.map(s => s.id));
  const metricIds = new Set(role.metrics.map(m => m.id));
  const registryById = new Map(registry.sources.map(s => [s.id, s]));
  const globalIds = new Map();

  for (const id of SALES_LESSON_IDS) {
    const lesson = lessons[id];
    const c = lesson.content;
    const tag = id.replace("-", "");
    e.push(...schemaCheck(lessonSchema, lesson, id, []));
    good(lesson.id === id, `${id}: id does not match file name`);
    good(lesson.status === "review", `${id}: new lesson must stay in review`);
    good(lesson.quality.canBePublished === false, `${id}: must not be publishable`);
    good(lesson.quality.reviewedOn === null, `${id}: review cannot be claimed before acceptance`);
    good(lesson.sourcePolicy.factualClaimsChecked === false, `${id}: fact-check cannot be claimed before acceptance`);
    good(lesson.sourcePolicy.timeSensitive === true && lesson.sourcePolicy.nextReviewOn > ctx.today, `${id}: legal content needs a future review date`);
    good(lesson.security.allowEmployerData === false, `${id}: employer data must be prohibited`);
    good(lesson.security.requireHumanReview === true, `${id}: human review is mandatory`);

    const slot = catalog.slots.find(s => s.id === id);
    good(!!slot, `${id}: no curriculum slot`);
    if (slot) {
      good(slot.moduleId === lesson.moduleId, `${id}: module differs from curriculum slot`);
      good(slot.scenarioId === lesson.audience.scenarioId, `${id}: scenario differs from curriculum slot`);
      good(slot.status === "planned" && slot.publishedLessonId === null, `${id}: slot must not be published`);
    }
    const scenario = role.scenarios.find(s => s.id === lesson.audience.scenarioId);
    good(!!scenario, `${id}: unknown scenario`);
    good(lesson.audience.roleIds.includes(role.roleId), `${id}: lesson must target sales role`);
    for (const t of lesson.audience.taskIds) {
      good(roleTasks.has(t), `${id}: unknown task ${t}`);
      good(!scenario || scenario.taskIds.includes(t), `${id}: task ${t} is not in scenario ${scenario?.id}`);
    }
    for (const s of lesson.audience.subtypeIds) good(subtypeIds.has(s), `${id}: unknown subtype ${s}`);
    for (const p of lesson.prerequisites) good(slotIds.has(p), `${id}: unknown prerequisite ${p}`);

    const own = [
      ...c.workedExamples, ...c.procedure, ...c.templates, ...c.exercises, ...c.quiz, ...lesson.downloads
    ].map(x => x.id);
    for (const x of own) {
      good(!globalIds.has(x), `${id}: duplicate ID ${x}${globalIds.has(x) ? " (also in " + globalIds.get(x) + ")" : ""}`);
      globalIds.set(x, id);
      good(x.includes(tag), `${id}: ID ${x} lacks lesson prefix ${tag}`);
    }
    const templateIds = new Set(c.templates.map(t => t.id));
    const lessonText = JSON.stringify(lesson);
    for (const m of lessonText.matchAll(/TPL-[A-Z0-9]+-[A-Z0-9-]+/g)) good(templateIds.has(m[0]), `${id}: reference to missing template ${m[0]}`);
    for (const m of lessonText.matchAll(new RegExp(`${tag}-(?:TASK|EX|P|Q)-?\\d+`, "g")))
      good(own.includes(m[0]), `${id}: reference to missing item ${m[0]}`);

    for (const t of c.templates) {
      for (const p of t.placeholders) good(t.body.includes("[" + p), `${id}: placeholder ${p} not used in ${t.id}`);
    }
    for (const kind of ["prompt", "checklist", "measurement_sheet"]) good(c.templates.some(t => t.kind === kind), `${id}: needs a ${kind} template`);
    good(c.templates.some(t => t.kind === "script"), `${id}: needs a manual template for when AI is forbidden`);
    good(templateIds.size && [...lesson.security.ifToolForbidden.matchAll(/TPL-[A-Z0-9-]+/g)].length >= 1,
      `${id}: AI-forbidden route must name manual templates`);
    for (const t of c.templates.filter(x => x.kind === "prompt"))
      good(/[Нн]е (добавляй|переписывай)/.test(t.body), `${id}: prompt ${t.id} must forbid adding or rewriting facts`);

    good(c.workedExamples.length >= 2 && c.exercises.length >= 2, `${id}: needs two worked examples and two exercises`);
    for (const x of c.exercises) {
      good(x.successCriteria.length >= 3, `${id}: ${x.id} needs at least three success criteria`);
      good(x.instructions.length >= 3, `${id}: ${x.id} needs at least three steps`);
    }
    good(c.quiz.length >= 3, `${id}: quiz needs three questions`);
    const correctPositions = new Set();
    for (const q of c.quiz) {
      good(q.options.length >= 3, `${id}: ${q.id} needs three options`);
      good(new Set(q.options.map(o => o.id)).size === q.options.length, `${id}: duplicate option in ${q.id}`);
      good(q.options.some(o => o.id === q.correctId), `${id}: ${q.id} lacks correct answer`);
      correctPositions.add(q.options.findIndex(o => o.id === q.correctId));
    }
    good(correctPositions.size >= 2, `${id}: correct answers always in the same position`);

    for (const s of lesson.sources) {
      const r = registryById.get(s.id);
      good(!!r, `${id}: source ${s.id} missing in registry`);
      if (r) for (const k of ["title", "url", "checkedOn", "supportsClaim"]) good(r[k] === s[k], `${id}: source ${s.id} differs from registry in ${k}`);
      if (r) good(r.usedBy.includes(id), `${id}: registry does not list usage of ${s.id}`);
      good(ALLOWED_SOURCE_HOSTS.includes(new URL(s.url).hostname), `${id}: source host not in reviewed list ${s.url}`);
      good(s.checkedOn <= ctx.today, `${id}: source ${s.id} checked in the future`);
    }
    const lawRefs = {
      "152-ФЗ, ст. 15": "SRC-152FZ-15", "152-ФЗ, ст. 5": "SRC-152FZ-5", "152-ФЗ, ст. 10": "SRC-152FZ-10",
      "38-ФЗ, ст. 18": "SRC-38FZ-18", "38-ФЗ, ст. 3": "SRC-38FZ-3", "ГК РФ, ст. 435": "SRC-GK-435", "NIST": "SRC-NIST-600-1"
    };
    const sourceIds = new Set(lesson.sources.map(s => s.id));
    for (const [ref, src] of Object.entries(lawRefs))
      if (lessonText.includes(ref)) good(sourceIds.has(src), `${id}: text cites ${ref} without source ${src}`);
    for (const m of lessonText.matchAll(/(\d+-ФЗ|ГК РФ), ст\. (\d+)/g))
      good(Object.keys(lawRefs).includes(`${m[1]}, ст. ${m[2]}`), `${id}: unregistered legal citation ${m[0]}`);

    for (const d of lesson.downloads) good(fileExists(d.repositoryPath), `${id}: download missing ${d.repositoryPath}`);
    good(worksheets[id] === renderWorksheet(lesson), `${id}: worksheet is stale; run build-sales-lesson-materials.mjs`);

    const data = practice[id];
    const dataDownload = lesson.downloads.find(d => d.kind === "example_dataset");
    good(data.syntheticOnly === true && data.status === "review", `${id}: practice data must be synthetic and in review`);
    good(!!dataDownload && data.id === dataDownload.id, `${id}: practice data id must match its download`);
    good(data.lessonId === id, `${id}: practice data points to another lesson`);
    good(data.exercises.length === c.exercises.length, `${id}: practice data must cover every exercise`);
    for (const item of data.exercises) {
      const ex = c.exercises.find(x => x.id === item.exerciseId);
      good(!!ex, `${id}: practice data for unknown exercise ${item.exerciseId}`);
      for (const m of item.materialIds) good(templateIds.has(m), `${id}: practice data references missing template ${m}`);
      const draft = item.aiDraft ?? item.aiSummary;
      good(!!ex && typeof draft === "string" && ex.syntheticInput.includes(draft), `${id}: AI draft of ${item.exerciseId} differs from lesson input`);
      const errs = item.answerKey.errors;
      good(errs.length >= (item.answerKey.minErrors ?? 3), `${id}: answer key of ${item.exerciseId} has too few errors`);
      for (const er of errs) {
        good(draft.includes(er.quote), `${id}: answer key quote not in draft: ${er.quote}`);
        const cue = er.cue ?? er.quote;
        good(!!ex && ex.sampleSolution.includes(cue), `${id}: sample solution of ${item.exerciseId} does not address «${cue}»`);
      }
      for (const cc of item.answerKey.calendarChecks || []) {
        const d = new Date(cc.date + "T00:00:00Z");
        good(WEEKDAYS[d.getUTCDay()] === cc.weekday, `${id}: calendar check ${cc.date} is not ${cc.weekday}`);
      }
      if (item.answerKey.maxWords && ex) {
        const letter = (ex.sampleSolution.match(/(?:Письмо|Follow-up|Сообщение): «([^»]+)»/) || [])[1];
        good(!!letter, `${id}: sample letter of ${ex.id} not found`);
        if (letter) good(letter.split(/\s+/).length <= item.answerKey.maxWords, `${id}: sample letter of ${ex.id} exceeds word limit`);
      }
    }

    for (const [path, text] of strings({ lesson, data })) {
      if (!/\.url$/.test(path)) for (const issue of personalDataIssues(text)) e.push(`${id}: ${path}: ${issue}`);
      for (const issue of quoteIssues(text)) e.push(`${id}: ${path}: ${issue}`);
      const field = path.split(".").pop().replace(/\[\d+\]$/, "");
      if (!DELIBERATE_ERROR_FIELDS.has(field)) for (const issue of weekdayIssues(text)) e.push(`${id}: ${path}: ${issue}`);
    }
  }

  const steps = plan.steps;
  good(plan.status === "review" && plan.usableForPaidUser === false, "plan candidates must not be usable yet");
  good(new Set(steps.map(s => s.stepId)).size === steps.length, "duplicate plan step IDs");
  good(steps.every((s, i) => s.position === i + 1), "plan step positions must be 1..n");
  good(steps.length <= 30, "plan candidates exceed 30 steps");
  for (const s of steps) {
    e.push(...schemaCheck(stepSchema, s, "plan." + s.stepId, []));
    const lesson = lessons[s.lessonId];
    good(!!lesson, `plan ${s.stepId}: unknown lesson ${s.lessonId}`);
    if (!lesson) continue;
    good(lesson.content.exercises.some(x => x.id === s.exerciseId), `plan ${s.stepId}: missing exercise`);
    good(lesson.content.templates.some(x => x.id === s.templateId), `plan ${s.stepId}: missing template`);
    good(lesson.audience.taskIds.includes(s.linkedTaskId), `plan ${s.stepId}: task not covered by lesson`);
    good(metricIds.has(s.metricId), `plan ${s.stepId}: unknown metric`);
    good(s.isCalendarDay === false, `plan ${s.stepId}: steps are not calendar days`);
  }
  for (const id of SALES_LESSON_IDS)
    for (const x of lessons[id].content.exercises) good(steps.some(s => s.exerciseId === x.id), `plan: exercise ${x.id} has no step`);
  const stepKeys = steps.map(s => `${s.lessonId}|${s.exerciseId}|${s.templateId}`);
  good(new Set(stepKeys).size === steps.length, "plan: exercise+template repeated");
  good(new Set(steps.map(s => s.action)).size === steps.length, "plan: repeated action");
  for (const [i, a] of steps.entries()) for (const b of steps.slice(i + 1)) {
    if (a.lessonId !== b.lessonId || a.exerciseId !== b.exerciseId) continue;
    const sameChecks = [...a.completionCriteria].sort().join("|") === [...b.completionCriteria].sort().join("|");
    good(a.expectedArtifact !== b.expectedArtifact || !sameChecks, `plan ${b.stepId}: repeats ${a.stepId} (same artifact and checks)`);
  }
  for (const s of steps) {
    const dataIds = new Set(JSON.stringify(practice[s.lessonId] ?? {}).match(/SAL0\d-DATA-[A-Z0-9]+/g) ?? []);
    for (const m of s.action.matchAll(/(SAL0\d)-DATA-([A-Z]+)(\d+)(?:…|-|\.\.\.)?(?:[A-Z]*(\d+))?/g)) {
      const from = Number(m[3]), to = Number(m[4] ?? m[3]);
      for (let n = from; n <= to; n++) good(dataIds.has(`${m[1]}-DATA-${m[2]}${n}`), `plan ${s.stepId}: unknown practice data ${m[1]}-DATA-${m[2]}${n}`);
    }
    for (const m of s.action.matchAll(/\b(SAL0\d)-DATA-([A-Z]+)\d+ и ([A-Z]+)(\d+)/g))
      good(dataIds.has(`${m[1]}-DATA-${m[3]}${m[4]}`), `plan ${s.stepId}: unknown practice data ${m[1]}-DATA-${m[3]}${m[4]}`);
  }

  const questions = new Map([...diagnostic.primaryQuestions, ...diagnostic.followUps].map(q => [q.id, new Set((q.options || []).map(o => o.value))]));
  const safeRules = new Set(diagnostic.safetyRules.map(r => r.id));
  const checkCondition = (cond, where) => {
    for (const [q, values] of Object.entries(cond)) {
      if (q === "always") continue;
      good(questions.has(q), `${where}: unknown diagnostic question ${q}`);
      for (const v of values) good(questions.get(q)?.has(v), `${where}: unknown option ${q}=${v}`);
    }
  };
  good(routing.status === "review" && routing.usableForPaidUser === false, "routing must not be active yet");
  good(SALES_LESSON_IDS.every(id => routing.lessons.some(r => r.lessonId === id)), "routing must cover every lesson");
  for (const r of routing.lessons) {
    const lesson = lessons[r.lessonId];
    good(!!lesson, `routing: unknown lesson ${r.lessonId}`);
    if (!lesson) continue;
    good(r.scenarioId === lesson.audience.scenarioId && slotIds.has(r.curriculumSlotId), `routing ${r.lessonId}: wrong slot or scenario`);
    checkCondition(r.relevantWhen, `routing ${r.lessonId}`);
    for (const [sub, tasks] of Object.entries(r.taskBySubtype)) {
      good(lesson.audience.subtypeIds.includes(sub), `routing ${r.lessonId}: subtype ${sub} not in lesson`);
      for (const t of tasks) {
        good(lesson.audience.taskIds.includes(t), `routing ${r.lessonId}: task ${t} not in lesson`);
        good(roleTasks.get(t)?.subtypeIds.includes(sub), `routing ${r.lessonId}: task ${t} does not apply to ${sub}`);
      }
    }
    for (const list of Object.values(r.exerciseFocusBySubtype))
      for (const x of list) good(lesson.content.exercises.some(ex => ex.id === x), `routing ${r.lessonId}: unknown exercise ${x}`);
    for (const lvl of lesson.audience.levels) good(typeof r.levelNotes[lvl] === "string", `routing ${r.lessonId}: no note for level ${lvl}`);
  }
  for (const rule of safeRules) good(routing.safeVariants.some(v => v.ruleId === rule), `routing: safety rule ${rule} has no variant`);
  for (const v of routing.safeVariants) {
    good(safeRules.has(v.ruleId), `routing ${v.id}: unknown safety rule`);
    checkCondition(v.condition, `routing ${v.id}`);
    for (const [lid, tpls] of Object.entries(v.manualTemplates || {}))
      for (const t of tpls) good(lessons[lid]?.content.templates.some(x => x.id === t && x.kind !== "prompt"), `routing ${v.id}: ${t} is not a manual template of ${lid}`);
  }
  const forbidden = routing.safeVariants.find(v => v.condition.Q12?.includes("prohibited"));
  good(!!forbidden && SALES_LESSON_IDS.every(id => forbidden.manualTemplates?.[id]?.length), "AI-forbidden users need a manual route for every lesson");

  for (const s of registry.sources) {
    good(s.usedBy.every(id => lessons[id]?.sources.some(x => x.id === s.id)), `registry ${s.id}: stale usage`);
    good(typeof s.edition === "string" && s.edition.length >= 4, `registry ${s.id}: edition missing`);
    good(typeof s.verificationStatus === "string", `registry ${s.id}: verification status missing`);
  }
  return e;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const issues = validateSalesLessons(loadSalesContext());
  if (issues.length) {
    for (const i of issues) console.error("FAIL sales lessons: " + i);
    process.exitCode = 1;
  } else {
    console.log("PASS: " + SALES_LESSON_IDS.join(", ") + " — schema, IDs, role/scenario links, materials, sources, routing and plan steps");
    console.log("REVIEW ONLY: lessons are not approved, not published and not connected to the cabinet");
  }
}
