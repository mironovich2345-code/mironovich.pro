#!/usr/bin/env node
// AI Career 3.0 — learning-load audit (ESTIMATES, not measured user time).
// Counts words per lesson section, proposes a micro-screen budget and estimates the load of the personal
// 30-step routes for the nine synthetic pilot profiles (each distinct lesson counted once).
// Route building uses the closed-demo preview library in memory (content files are not changed).
// Usage: node --experimental-strip-types scripts/career/v3-lesson-load-audit.mjs [--md out.md] [--json out.json]
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
Object.assign(process.env, {
  CAREER_V3_DEMO: "1", CAREER_V3_DEMO_LOCAL: "1", SITE_NOINDEX: "1", CAREER_V3_DEMO_ORIGIN: "http://127.0.0.1:3999",
  CAREER_V3_DEMO_DATABASE_URL: "postgresql://audit:audit@127.0.0.1:1/mironovich_career_demo_v3", // never connected
  CAREER_V3_DEMO_SESSION_SECRET: "audit-only-".padEnd(64, "x0"),
});
for (const k of Object.keys(process.env)) if (k.startsWith("RAILWAY_") || ["CAREER_SANDBOX_ENABLED", "CAREER_PAYMENT_MODE", "DATABASE_URL", "CAREER_DATABASE_URL"].includes(k)) delete process.env[k];
const { loadProfessionBundle } = await import("../../lib/server/career-v3/content.ts");
const { evaluateDiagnostic } = await import("../../lib/career-v3/diagnostic.ts");
const { selectLessons } = await import("../../lib/career-v3/selection.ts");
const { buildPlan } = await import("../../lib/career-v3/plan.ts");

// Assumptions (documented in the report), calibrated on the three finished prototypes (SAF-01, SAL-03, VAL-02):
// on-screen reading 150 words/min; a theory screen ≈ 45 words; about 60% of today's mandatory theory is kept
// after editing (prototypes: 53–72%), examples included (8–14 theory screens); practice = task + one screen per
// instruction + review; practice time 4 min per instruction + 3 min self-review; quiz 0.75 min per question.
// For lessons that already have a player script the ACTUAL screen count is used (marked «факт»).
const WPM = 150, WPS = 45;
const words = (v) => (typeof v === "string" ? v.split(/\s+/).filter(Boolean).length : Array.isArray(v) ? v.reduce((s, x) => s + words(x), 0) : v && typeof v === "object" ? Object.values(v).reduce((s, x) => s + words(x), 0) : 0);
const CATEGORY = { safety: "Безопасность", task_mapping: "ИИ в моей профессии", practice: "ИИ в моей профессии", trends: "Карьера в эпоху ИИ", value: "Моя ценность для компании" };
const files = readdirSync("content/career/v3/lessons").filter((f) => f.endsWith(".json")).sort();
const lessons = files.map((f) => JSON.parse(readFileSync("content/career/v3/lessons/" + f, "utf8")));

function lessonRow(l) {
  const c = l.content;
  const theory = words(c.introduction) + words(c.explanations.map((e) => [e.heading, e.body])) + words(c.procedure) + words(c.summary);
  const explExamples = words(c.explanations.map((e) => e.example ?? ""));
  const examples = words(c.workedExamples) + explExamples;
  const templates = words(c.templates.map((t) => t.body));
  const exercises = words(c.exercises.map((e) => [e.syntheticInput, e.instructions, e.successCriteria, e.expectedArtifact]));
  const samples = words(c.exercises.map((e) => [e.sampleSolution, e.feedbackIfIncorrect]));
  const quiz = words(c.quiz.map((q) => [q.question, q.options.map((o) => o.text), q.reason]));
  const mainExercise = c.exercises[0];
  const practiceSteps = mainExercise.instructions.length;
  let theoryScreens = Math.min(14, Math.max(8, Math.round((theory * 0.6) / WPS)));
  let actual = false;
  if (existsSync(`content/career/v3/player/${l.id}.json`)) {
    const sc = JSON.parse(readFileSync(`content/career/v3/player/${l.id}.json`, "utf8"));
    if (sc.lessonVersion === l.version) { theoryScreens = sc.theory.length; actual = true; }
  }
  const exampleScreens = 0; // examples are part of the theory screens
  const screens = theoryScreens + 1 /* task */ + practiceSteps + 1 /* review */ + c.quiz.length + 1 /* done */;
  const readMin = ((theoryScreens + 3) * WPS) / WPM;
  const practiceMin = practiceSteps * 4 + 3;
  const quizMin = c.quiz.length * 0.75;
  return {
    id: l.id, title: l.title, moduleId: l.moduleId, category: CATEGORY[l.moduleId] ?? "—", durationMinutes: l.durationMinutes,
    words: { theory, examples, templates, exercises, samples, quiz, total: theory + examples + templates + exercises + samples + quiz },
    counts: { explanations: c.explanations.length, workedExamples: c.workedExamples.length, templates: c.templates.length, exercises: c.exercises.length, quiz: c.quiz.length, sources: l.sources.length, downloads: l.downloads.length },
    proposed: { actual, screens, theoryScreens, exampleScreens, practiceSteps, readMin: Math.round(readMin), practiceMin, quizMin: Math.round(quizMin * 10) / 10, totalMin: Math.round(readMin + practiceMin + quizMin) },
  };
}
const rows = lessons.map(lessonRow);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

const P = "sales_manager";
const bundle = loadProfessionBundle(P);
if (bundle.libraryMode !== "demo_review_preview") throw new Error("preview library not active: " + bundle.libraryMode);
const today = new Date().toISOString().slice(0, 10);
const profiles = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles.filter((p) => p.id !== "FX-diagnostic-changed");
const routes = profiles.map((p) => {
  const result = evaluateDiagnostic(bundle.diagnostic, p.answers, today);
  const plan = buildPlan(bundle.engine, { result, selection: selectLessons(bundle.engine, result, bundle.library), library: bundle.library, today });
  if (plan.status !== "ready") return { profile: p.id, status: plan.status };
  const distinct = [...new Set(plan.steps.map((s) => s.lessonId))];
  // Each distinct lesson once (screens + quiz); each of the 30 steps adds its own exercise practice
  // (a repeated lesson's theory is not counted twice).
  const lessonMin = distinct.reduce((s, id) => s + byId[id].proposed.readMin + byId[id].proposed.quizMin, 0);
  const stepPractice = plan.steps.reduce((s, st) => {
    const l = lessons.find((x) => x.id === st.lessonId);
    const ex = l.content.exercises.find((e) => e.id === st.exerciseId) ?? l.content.exercises[0];
    return s + ex.instructions.length * 4 + 3;
  }, 0);
  const currentMin = distinct.reduce((s, id) => s + byId[id].durationMinutes, 0);
  return { profile: p.id.replace("FX-", ""), variant: plan.variant, lessons: distinct.length, lessonIds: distinct, screens: distinct.reduce((s, id) => s + byId[id].proposed.screens, 0),
    lessonMin: Math.round(lessonMin), stepPracticeMin: stepPractice, totalMin: Math.round(lessonMin + stepPractice), declaredDurationSum: currentMin };
});

const all = rows.reduce((a, r) => ({ screens: a.screens + r.proposed.screens, min: a.min + r.proposed.totalMin, declared: a.declared + r.durationMinutes, theory: a.theory + r.words.theory, total: a.total + r.words.total }), { screens: 0, min: 0, declared: 0, theory: 0, total: 0 });
const out = { generatedOn: today, assumptions: { WPM, WPS }, lessons: rows, routes, all };
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
if (arg("--json")) writeFileSync(arg("--json"), JSON.stringify(out, null, 2));
if (arg("--md")) {
  const h = (n) => `${Math.floor(n / 60) ? Math.floor(n / 60) + " ч " : ""}${n % 60} мин`;
  const md = [
    "| Урок | Категория | Теория, слов | Примеры | Шаблоны | Упражнения + образцы | Тест | Сейчас durationMinutes | Экранов | Чтение, мин | Практика, мин | Тест, мин | Итого, мин (оценка) |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((r) => `| ${r.id} ${r.title} | ${r.category} | ${r.words.theory} | ${r.words.examples} | ${r.words.templates} | ${r.words.exercises} + ${r.words.samples} | ${r.words.quiz} | ${r.durationMinutes} | ${r.proposed.screens}${r.proposed.actual ? " (факт)" : ""} | ${r.proposed.readMin} | ${r.proposed.practiceMin} | ${r.proposed.quizMin} | ${r.proposed.totalMin} |`),
    `| **Все 14 уроков** | | ${all.theory} | | | | | ${all.declared} | ${all.screens} | | | | **${all.min} (${h(all.min)})** |`,
    "",
    "| Профиль | Вариант | Разных уроков | Экранов уроков | Уроки (чтение + тест) | Практика 30 шагов | Итого (оценка) | Сумма текущих durationMinutes |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
    ...routes.map((r) => `| ${r.profile} | ${r.variant} | ${r.lessons} | ${r.screens} | ${r.lessonMin} мин | ${r.stepPracticeMin} мин | ${h(r.totalMin)} | ${r.declaredDurationSum} мин |`),
  ].join("\n");
  writeFileSync(arg("--md"), md + "\n");
}
console.log(JSON.stringify({ all, routes: routes.map((r) => ({ ...r, lessonIds: undefined })) }, null, 1));
