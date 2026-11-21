#!/usr/bin/env node
// Quality gate for v3 lesson packs (scripts/career/v3-lesson-packs.mjs): schema, publication safety,
// IDs, links to role/curriculum, templates, answer keys, sources registry, text hygiene and
// plan-step candidates. Generalised from scripts/career/validate-v3-wave1.mjs (PR #62) with a pack
// config (content/career/v3/lesson-packs/*.json) and per-lesson checks (scripts/career/lesson-checks/).
// No network, production APIs or real personal data. Usage: validate-v3-lesson-pack.mjs [pack]
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { schemaCheck } from "./validate-v3-content.mjs";
import { readdirSync } from "node:fs";
import { PACKS, practicePath, worksheetPath, renderWorksheet } from "./v3-lesson-packs.mjs";
export { addWorkingDays } from "./lesson-checks/helpers.mjs";

// Lesson-specific checks live in scripts/career/lesson-checks/<LESSON-ID>.mjs (one file per lesson, so packs on
// separate branches never touch the same file).
const CHECKS_DIR = new URL("./lesson-checks/", import.meta.url);
export const LESSON_CHECKS = Object.fromEntries(await Promise.all(readdirSync(CHECKS_DIR)
  .filter((f) => /^[A-Z]{3}-\d{2}\.mjs$/.test(f))
  .map(async (f) => [f.replace(".mjs", ""), (await import(new URL(f, CHECKS_DIR))).default])));

const root = new URL("../../", import.meta.url);
const text = (p) => readFileSync(new URL(p, root), "utf8");
const json = (p) => JSON.parse(text(p));
const exists = (p) => typeof p === "string" && !p.includes("..") && existsSync(new URL(p, root));

export const REVIEWED_HOSTS = ["arxiv.org", "www.nber.org", "www.ilo.org", "nvlpubs.nist.gov", "genai.owasp.org", "www.consultant.ru"];
const WEEKDAY = { "понедельник": 1, "вторник": 2, "среда": 3, "среду": 3, "четверг": 4, "пятница": 5, "пятницу": 5, "суббота": 6, "субботу": 6, "воскресенье": 0 };
const W = "[а-яё]*";
const PROMISES = [
  new RegExp(`(рост|увеличени${W}|повыш${W})\\s+(вашего\\s+|вашей\\s+)?(доход${W}|зарплат${W}|выручк${W}|продаж${W}|конверси${W})`, "i"),
  new RegExp(`(защит${W}|гарант${W}|сохран${W})\\s+(от\\s+)?(увольнени${W}|рабоч${W}\\s+мест${W})`, "i"),
  new RegExp(`гарантир${W}`, "i"),
  new RegExp(`(ИИ|искусственный интеллект)\\s+(неизбежно\\s+)?замен(ит|ят)\\s+(менеджер|продавц|професси)`, "i"),
];
// Fields that quote deliberate errors for the learner to find.
const QUOTED_ERROR_FIELDS = new Set(["syntheticInput", "unsafeAttempt", "quote", "situation"]);

export function loadPack(pack) {
  const cfg = PACKS[pack];
  if (!cfg) throw new Error("unknown lesson pack " + pack);
  return {
    pack, lawRefs: cfg.lawRefs, requireYearInDates: cfg.requireYearInDates === true,
    lessons: Object.fromEntries(cfg.ids.map((id) => [id, json(`content/career/v3/lessons/${id}.json`)])),
    practice: Object.fromEntries(cfg.ids.map((id) => [id, json(practicePath(pack, id))])),
    worksheets: Object.fromEntries(cfg.ids.map((id) => [id, exists(worksheetPath(pack, id)) ? text(worksheetPath(pack, id)) : null])),
    registry: json(`${cfg.materialsDir}/sources.json`),
    plan: json(cfg.planPath),
    catalog: json("content/career/v3/curriculum.json"),
    role: json("content/career/v3/roles/sales-manager.json"),
    lessonSchema: json("content/career/v3/schemas/lesson.schema.json"),
    stepSchema: json("content/career/v3/schemas/plan-step.schema.json"),
    today: new Date().toISOString().slice(0, 10),
  };
}

export function* strings(v, path = "") {
  if (typeof v === "string") yield [path, v];
  else if (Array.isArray(v)) for (const [i, x] of v.entries()) yield* strings(x, `${path}[${i}]`);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) yield* strings(x, path ? `${path}.${k}` : k);
}

export function hygieneIssues(s, field) {
  const out = [];
  const stack = [];
  for (const ch of s) {
    if (ch === "«" || ch === "„") stack.push(ch);
    else if (ch === "»" || ch === "“") { const o = stack.pop(); if ((ch === "»" && o !== "«") || (ch === "“" && o !== "„")) { out.push("unbalanced quotes"); break; } }
  }
  if (stack.length) out.push("unclosed quotes");
  for (const m of s.matchAll(/[\w.+-]+@([\w-]+\.)+[\w-]+/g)) if (!/\.example(\.com)?$/i.test(m[0])) out.push("email outside .example: " + m[0]);
  if (/(?:\+7|\b8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/.test(s)) out.push("phone-like number");
  if (/\b\d{10}\b|\b\d{12}\b/.test(s)) out.push("INN-like number");
  for (const m of s.matchAll(/\b([a-z0-9-]+\.)+(ru|com|рф|org|net)\b/gi)) if (!/example/i.test(m[0]) && !/^(www\.)?consultant\.ru$/i.test(m[0])) out.push("real-looking domain: " + m[0]);
  if (!QUOTED_ERROR_FIELDS.has(field)) {
    for (const re of PROMISES) if (re.test(s.replace(/«[^«»]*»/g, " "))) out.push("outcome promise or replacement claim");
    const plain = s.replace(/«[^«»]*»/g, " ");
    for (const m of plain.matchAll(new RegExp(`(${Object.keys(WEEKDAY).join("|")}),?\\s+(\\d{2})\\.(\\d{2})(?:\\.(\\d{4}))?`, "gi"))) {
      const d = new Date(Date.UTC(Number(m[4] ?? 2026), Number(m[3]) - 1, Number(m[2])));
      if (d.getUTCDay() !== WEEKDAY[m[1].toLowerCase()]) out.push(`weekday mismatch ${m[0]}`);
    }
  }
  return out;
}

export function validatePack(ctx) {
  const e = [];
  const good = (ok, msg) => { if (!ok) e.push(msg); };
  const { lessons, practice, worksheets, registry, plan, catalog, role, lessonSchema, stepSchema } = ctx;
  const LAW_REFS = ctx.lawRefs ?? {};
  const slots = new Map(catalog.slots.map((s) => [s.id, s]));
  const tasks = new Map(role.tasks.map((t) => [t.id, t]));
  const metrics = new Set(role.metrics.map((m) => m.id));
  const reg = new Map(registry.sources.map((s) => [s.id, s]));
  const allIds = new Map();

  for (const id of Object.keys(lessons)) {
    const l = lessons[id], c = l.content, tag = id.replace("-", "");
    e.push(...schemaCheck(lessonSchema, l, id, []));
    good(l.status === "review", `${id}: must stay in review`);
    good(l.quality.canBePublished === false && l.quality.reviewedOn === null, `${id}: must not be publishable or reviewed`);
    good(l.sourcePolicy.factualClaimsChecked === false, `${id}: facts not yet checked by the owner`);
    good(l.sourcePolicy.timeSensitive === true && l.sourcePolicy.nextReviewOn > ctx.today, `${id}: needs a future review date`);
    good(l.security.allowEmployerData === false && l.security.requireHumanReview === true, `${id}: safety flags`);
    const slot = slots.get(id);
    good(!!slot, `${id}: no curriculum slot`);
    if (slot) {
      good(slot.moduleId === l.moduleId, `${id}: module differs from slot`);
      good(slot.scenarioId === l.audience.scenarioId, `${id}: scenario differs from slot`);
      good(slot.status === "planned" && slot.publishedLessonId === null, `${id}: slot must stay unpublished`);
    }
    for (const t of l.audience.taskIds) good(tasks.has(t), `${id}: unknown task ${t}`);
    if (l.audience.scenarioId) {
      const sc = role.scenarios.find((s) => s.id === l.audience.scenarioId);
      good(!!sc, `${id}: unknown scenario`);
      for (const t of l.audience.taskIds) good(sc?.taskIds.includes(t), `${id}: task ${t} not in scenario`);
      const subtypes = new Set(l.audience.taskIds.flatMap((t) => tasks.get(t)?.subtypeIds ?? []));
      for (const s of l.audience.subtypeIds) good(subtypes.has(s), `${id}: subtype ${s} not served by its tasks`);
    }
    // A prerequisite is a safety slot or, in shared modules (not practice), an earlier slot of the same module
    // (e.g. VAL-01 before VAL-02). Practice lessons serve different work and never require each other.
    const order = catalog.slots.map((s) => s.id);
    for (const p of l.prerequisites) {
      const ps = slots.get(p);
      good(!!ps && (ps.moduleId === "safety" || (l.moduleId !== "practice" && ps.moduleId === l.moduleId && order.indexOf(p) < order.indexOf(id))), `${id}: prerequisite ${p} must be a safety slot or an earlier slot of the same shared module`);
    }

    const own = [...c.workedExamples, ...c.procedure, ...c.templates, ...c.exercises, ...c.quiz, ...l.downloads].map((x) => x.id);
    for (const x of own) {
      good(!allIds.has(x), `${id}: duplicate ID ${x}`);
      allIds.set(x, id);
      good(x.includes(tag), `${id}: ID ${x} lacks prefix ${tag}`);
    }
    const tpl = new Map(c.templates.map((t) => [t.id, t]));
    for (const m of JSON.stringify(l).matchAll(/TPL-[A-Z0-9]+-[A-Z0-9-]+/g)) good(tpl.has(m[0]), `${id}: reference to missing template ${m[0]}`);
    for (const m of JSON.stringify(l).matchAll(new RegExp(`${tag}-(?:TASK|EX|P|Q)-?\\d+`, "g"))) good(own.includes(m[0]), `${id}: reference to missing ${m[0]}`);
    for (const t of c.templates) for (const p of t.placeholders) good(t.body.includes("[" + p), `${id}: placeholder ${p} unused in ${t.id}`);
    // Trends lessons have no measurement stage; every other module measures an exercise result.
    for (const k of ["checklist", "prompt", ...(l.moduleId === "trends" ? [] : ["measurement_sheet"])]) good(c.templates.some((t) => t.kind === k), `${id}: needs a ${k} template`);
    for (const t of c.templates.filter((x) => x.kind === "prompt")) good(/только|[Нн]е добавляй|[Нн]е переписывай/.test(t.body), `${id}: prompt ${t.id} must restrict the model`);
    good([...l.security.ifToolForbidden.matchAll(/TPL-[A-Z0-9-]+/g)].every((m) => tpl.get(m[0])?.kind !== "prompt") && /TPL-/.test(l.security.ifToolForbidden),
      `${id}: manual route must name non-prompt templates`);
    good(c.explanations.length >= 4 && c.workedExamples.length >= 2 && c.procedure.length >= 5 && c.quiz.length >= 5, `${id}: depth below wave standard`);
    const positions = new Set(c.quiz.map((q) => q.options.findIndex((o) => o.id === q.correctId)));
    good(positions.size >= 2, `${id}: correct answers always in one position`);
    for (const q of c.quiz) good(q.options.some((o) => o.id === q.correctId) && new Set(q.options.map((o) => o.id)).size === q.options.length, `${id}: quiz ${q.id}`);

    // Exercise feasibility: data, steps, objective checks, answer key.
    const data = practice[id];
    good(data.lessonId === id && data.syntheticOnly === true && data.status === "review", `${id}: practice data header`);
    good(l.downloads.some((d) => d.kind === "example_dataset" && d.id === data.id), `${id}: practice data id must match download`);
    for (const d of l.downloads) good(exists(d.repositoryPath), `${id}: missing download ${d.repositoryPath}`);
    good(worksheets[id] === renderWorksheet(l), `${id}: worksheet is stale`);
    good(data.exercises.length === c.exercises.length, `${id}: answer key for every exercise`);
    for (const ex of c.exercises) {
      const key = data.exercises.find((x) => x.exerciseId === ex.id);
      good(!!key, `${id}: no answer key for ${ex.id}`);
      good(ex.instructions.length >= 3 && ex.successCriteria.length >= 3, `${id}: ${ex.id} needs 3+ steps and 3+ criteria`);
      good(/TPL-/.test(ex.instructions.join(" ")), `${id}: ${ex.id} must name the template to use`);
      if (!key) continue;
      for (const m of key.materialIds) good(tpl.has(m), `${id}: answer key references missing template ${m}`);
      good(key.answerKey.findings.length >= 3, `${id}: ${ex.id} answer key too thin`);
      for (const f of key.answerKey.findings) {
        good(ex.syntheticInput.includes(f.quote), `${id}: ${ex.id} key quote not in input: ${f.quote}`);
        good(ex.sampleSolution.includes(f.cue), `${id}: ${ex.id} sample solution misses: ${f.cue}`);
      }
    }
    if (LESSON_CHECKS[id]) e.push(...LESSON_CHECKS[id](l, data, ctx).map((x) => `${id}: ${x}`));

    // Sources: registry, hosts, dates, legal citations.
    const lt = JSON.stringify(l);
    for (const s of l.sources) {
      const r = reg.get(s.id);
      good(!!r && r.url === s.url && r.title === s.title && r.checkedOn === s.checkedOn && r.supportsClaimByLesson?.[id] === s.supportsClaim, `${id}: source ${s.id} differs from registry`);
      good(REVIEWED_HOSTS.includes(new URL(s.url).hostname), `${id}: source host not reviewed: ${s.url}`);
      good(s.checkedOn <= ctx.today, `${id}: source ${s.id} checked in the future`);
    }
    for (const [ref, src] of Object.entries(LAW_REFS)) if (lt.includes(ref)) good(l.sources.some((s) => s.id === src), `${id}: cites ${ref} without ${src}`);
    for (const m of lt.matchAll(/(\d+-ФЗ|ГК РФ), ст\. (\d+)/g)) good(`${m[1]}, ст. ${m[2]}` in LAW_REFS, `${id}: unregistered legal citation ${m[0]}`);
    for (const [p, s] of strings({ lesson: l, data })) {
      if (p.endsWith(".url")) continue;
      const field = p.split(".").pop().replace(/\[\d+\]$/, "");
      for (const i of hygieneIssues(s, field)) e.push(`${id}: ${p}: ${i}`);
      // Learner-facing text must not show internal task codes (the cabinet shows task names).
      if (p.startsWith("lesson.") && !p.startsWith("lesson.audience") && /\bT\d{2}\b/.test(s)) e.push(`${id}: ${p}: internal task code in learner text`);
      // Study dates carry a year so the material does not silently shift to another calendar year.
      if (ctx.requireYearInDates && (p.startsWith("lesson.content") || p.startsWith("data.exercises")) && /(?<![\d.])\d{2}\.\d{2}(?!\.?\d)/.test(s)) e.push(`${id}: ${p}: study date without a year`);
    }
  }
  for (const s of registry.sources) good(s.usedBy.every((id) => lessons[id]?.sources.some((x) => x.id === s.id)), `registry ${s.id}: stale usage`);

  // Plan-step candidates.
  const steps = plan.steps;
  good(plan.status === "review" && plan.usableForPaidUser === false, "plan: must not be usable");
  good(steps.every((s, i) => s.position === i + 1) && new Set(steps.map((s) => s.stepId)).size === steps.length, "plan: positions/IDs");
  const firstOf = new Map();
  for (const s of steps) {
    e.push(...schemaCheck(stepSchema, s, "plan." + s.stepId, []));
    const l = lessons[s.lessonId];
    good(!!l, `plan ${s.stepId}: unknown lesson`);
    if (!l) continue;
    good(l.content.exercises.some((x) => x.id === s.exerciseId), `plan ${s.stepId}: missing exercise`);
    const t = l.content.templates.find((x) => x.id === s.templateId);
    good(!!t, `plan ${s.stepId}: missing template`);
    good(s.linkedTaskId === null || l.audience.taskIds.includes(s.linkedTaskId), `plan ${s.stepId}: task not in lesson`);
    good(s.metricId === null || metrics.has(s.metricId), `plan ${s.stepId}: unknown metric`);
    const k = s.lessonId + "|" + s.exerciseId;
    if (!firstOf.has(k)) { firstOf.set(k, s); good(t?.kind !== "prompt", `plan ${s.stepId}: doing an exercise must not require a prompt (manual route)`); }
  }
  for (const id of Object.keys(lessons)) {
    good(steps.filter((s) => s.lessonId === id).length <= 4, `plan: more than 4 steps for ${id}`);
    for (const x of lessons[id].content.exercises) good(steps.some((s) => s.exerciseId === x.id), `plan: exercise ${x.id} has no step`);
  }
  good(new Set(steps.map((s) => `${s.lessonId}|${s.exerciseId}|${s.templateId}`)).size === steps.length, "plan: exercise+template repeated");
  good(new Set(steps.map((s) => s.action)).size === steps.length && new Set(steps.map((s) => s.expectedArtifact)).size === steps.length, "plan: repeated action or artifact");
  for (const [i, a] of steps.entries()) for (const b of steps.slice(i + 1)) {
    if (a.lessonId === b.lessonId && a.exerciseId === b.exerciseId) {
      const same = [...a.completionCriteria].sort().join("|") === [...b.completionCriteria].sort().join("|");
      good(a.expectedArtifact !== b.expectedArtifact || !same, `plan ${b.stepId}: repeats ${a.stepId}`);
      // A follow-up step moves the exercise to verification or measurement (engine phase rule).
      const kb = lessons[b.lessonId].content.templates.find((t) => t.id === b.templateId)?.kind;
      good(["checklist", "measurement_sheet"].includes(kb), `plan ${b.stepId}: follow-up of ${a.stepId} must be a checklist or measurement sheet`);
    }
  }
  for (const [p, s] of strings(plan)) for (const i of hygieneIssues(s, p.split(".").pop())) e.push(`plan: ${p}: ${i}`);
  return e;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const packs = process.argv[2] ? [process.argv[2]] : Object.keys(PACKS);
  for (const pack of packs) {
    const issues = validatePack(loadPack(pack));
    if (issues.length) { for (const i of issues) console.error(`FAIL ${pack}: ` + i); process.exitCode = 1; }
    else {
      console.log(`PASS ${pack}: ` + PACKS[pack].ids.join(", ") + " — schema, IDs, links, templates, answer keys, arithmetic, sources, hygiene, plan candidates");
      console.log("REVIEW ONLY: lessons are not approved, not published and not connected to the cabinet");
    }
  }
}
