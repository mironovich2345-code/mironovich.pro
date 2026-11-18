#!/usr/bin/env node
// Content-gap report for the sales pilot: what is written, what is in review, how many verifiable
// step candidates exist and what the engine would still miss for a 30-step route if every written
// lesson were approved (simulated in memory only).
// Usage: node --experimental-strip-types scripts/career/report-v3-content-gap.mjs [--check]
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { buildLibrary } from "../../lib/career-v3/library.ts";
import { evaluateDiagnostic } from "../../lib/career-v3/diagnostic.ts";
import { selectLessons } from "../../lib/career-v3/selection.ts";
import { buildPlan } from "../../lib/career-v3/plan.ts";
import { loadProfessionBundle } from "../../lib/server/career-v3/content.ts";
import { fixtureLibrarySources } from "../../tests/fixtures/career-v3/fixture-library.mjs";

const OUT = "docs/products/ai-career-v3/CONTENT_GAP.md";
const TODAY = "2026-11-18";
const j = (p) => JSON.parse(readFileSync(p, "utf8"));
const b = loadProfessionBundle("sales_manager", TODAY);
const cur = j("content/career/v3/curriculum.json");
const lessonDir = "content/career/v3/lessons";
const lessonFiles = existsSync(lessonDir) ? readdirSync(lessonDir).filter((f) => f.endsWith(".json")).sort() : [];
const lessons = lessonFiles.map((f) => ({ path: `${lessonDir}/${f}`, document: j(`${lessonDir}/${f}`) }));
const candDir = "content/career/v3/plan-candidates";
const candFiles = existsSync(candDir) ? readdirSync(candDir).filter((f) => f.endsWith(".json")).sort() : [];
const candidates = candFiles.map((f) => ({ path: `${candDir}/${f}`, document: j(`${candDir}/${f}`) }));
const allSteps = candidates.flatMap((c) => c.document.steps);

// What-if: every written lesson approved and published (in memory).
const whatIfCur = structuredClone(cur);
const written = new Set(lessons.map((l) => l.document.id));
for (const s of whatIfCur.slots) if (written.has(s.id)) { s.status = "published"; s.publishedLessonId = s.id; }
const whatIfLessons = lessons.map((l) => {
  const d = structuredClone(l.document);
  d.status = "approved"; d.quality.canBePublished = true; d.quality.reviewedOn = TODAY; d.sourcePolicy.factualClaimsChecked = true;
  return { ...l, document: d };
});
const lib = buildLibrary({ professionId: "sales_manager", today: TODAY, curriculum: whatIfCur, role: b.engine.role,
  lessonSchema: j("content/career/v3/schemas/lesson.schema.json"), stepSchema: j("content/career/v3/schemas/plan-step.schema.json"),
  lessons: whatIfLessons, planCandidates: candidates, fileExists: (p) => !p.includes("..") && existsSync(p) });

const PH = { safety: "безопасность", apply: "применение", verify: "проверка", measure: "измерение", value: "ценность", next_level: "следующий уровень" };
const profiles = j("tests/fixtures/career-v3/pilot-profiles.json").profiles.filter((p) => p.id !== "FX-diagnostic-changed");
const rows = profiles.map((p) => {
  const r = evaluateDiagnostic(b.diagnostic, p.answers, TODAY);
  const sel = selectLessons(b.engine, r, lib);
  const plan = buildPlan(b.engine, { result: r, selection: sel, library: lib, today: TODAY });
  const total = plan.status === "ready" ? 30 : (plan.gaps.find((g) => g.phase === "total")?.available ?? "—");
  const missing = plan.status === "ready" ? [] : plan.gaps.filter((g) => g.phase !== "total").map((g) => PH[g.phase]);
  return { id: p.id, story: p.story, sel, total, missing, reason: plan.status === "ready" ? "ready" : plan.reason };
});

const MODULE_NEEDS = {
  safety: "Есть 4 урока и 8 шагов. Нужна только приёмка PR #57.",
  task_mapping: "Нет ни одного урока. Нужны разбор своей работы на операции и учебная карта задач: применение и проверка.",
  practice: "Есть 2 урока из 7 (S02, S05) — это входящие продажи и CRM. Для B2B нет S01, S03, S04, S07, для анализа — S06.",
  trends: "Нет уроков. Без них этап «следующий уровень» пуст, и план недоступен любому профилю.",
  value: "Нет уроков. Нет замера «было», отчёта руководителю и предложения пилота: этап «ценность» пуст, «измерение» есть только внутри SAL-02/05.",
};
const out = [];
out.push("<!-- Сгенерировано scripts/career/report-v3-content-gap.mjs по реальному curriculum.json и урокам ветки. Не редактировать вручную. -->", "",
  "# Дефицит контента пилота «менеджер по продажам»", "",
  `Состояние на ${TODAY}. Учтены уроки PR #57 и PR #59. «Если утвердить» — проверка в памяти: что построит движок, если бы все написанные уроки были приняты. В контенте ничего не меняется.`, "",
  "## Сводка", "",
  `- Слотов в программе: **${cur.slots.length}**.`,
  `- Написано уроков: **${lessons.length}** (${[...written].join(", ")}). Все в статусе \`review\`, ждут редакционной и правовой приёмки. Утверждённых — **0**.`,
  `- Проверяемых шагов-кандидатов: **${allSteps.length}** (${candidates.map((c) => `${c.path.split("/").pop()}: ${c.document.steps.length}`).join(", ")}).`,
  `- Если утвердить все написанные уроки, план из 30 шагов **не строится ни для одного профиля**: не хватает этапов и различных шагов.`, "",
  "## По модулям", "",
  "| Модуль | Слотов | Написано | На приёмке | Шагов-кандидатов | Чего не хватает |", "| --- | --- | --- | --- | --- | --- |");
for (const m of cur.modules) {
  const slots = cur.slots.filter((s) => s.moduleId === m.id);
  const w = slots.filter((s) => written.has(s.id));
  const steps = allSteps.filter((s) => slots.some((x) => x.id === s.lessonId));
  out.push(`| ${m.title} | ${slots.length} | ${w.length}${w.length ? " (" + w.map((s) => s.id).join(", ") + ")" : ""} | ${w.length} | ${steps.length} | ${MODULE_NEEDS[m.id] ?? ""} |`);
}
out.push("", "## Что построит движок, если утвердить все написанные уроки", "",
  "| Профиль | Вариант практики | Уроков в подборе | Различных шагов из 30 | Пустые этапы или причина |", "| --- | --- | --- | --- | --- |");
const REASON = { nothing_fits_profile: "нет практического урока под выбранные задачи — подбор пуст", mandatory_module_missing: "нет обязательного модуля" };
for (const r of rows) {
  const empty = r.sel.status !== "ready" ? REASON[r.sel.unavailableReason] ?? r.sel.unavailableReason : (r.missing.join(", ") || "—");
  out.push(`| ${r.story} | ${r.sel.variant} | ${r.sel.items.length} | ${r.sel.status === "ready" ? r.total : 0} | ${empty} |`);
}
out.push("", "Строку ограничивают лимиты: не больше 4 шагов на урок, 2 на упражнение и одного на упражнение в каждом этапе. Даже 16 кандидатов при 6 уроках дают не больше 16 шагов, а этапы «ценность» и «следующий уровень» пусты у всех.", "",
  "## Сколько нужно для 30 содержательно разных шагов", "",
  "На каждый профиль нужно примерно 10–12 подходящих уроков по 3–4 шага на разных этапах, включая все шесть этапов:",
  "",
  "- **безопасность** — есть (SAF-01…04, 8 шагов);",
  "- **применение, проверка, измерение** — 2–3 практических урока под специализацию плюс 1–2 урока «Что поручить ИИ»;",
  "- **ценность** — 2 урока: замер «было» и отчёт или предложение пилота;",
  "- **следующий уровень** — 1–2 урока трендов и навыков.", "");
// Growth scenarios: real lessons (approved in memory) + test-fixture stand-ins for not-yet-written slots.
function scenario(extra) {
  const all = fixtureLibrarySources();
  const keep = new Set([...written, ...extra]);
  for (const s of all.curriculum.slots) if (!keep.has(s.id)) { s.status = "planned"; s.publishedLessonId = null; }
  const fx = all.lessons.filter((l) => extra.includes(l.document.id));
  const cands = [{ path: "fixture", document: { steps: all.planCandidates[0].document.steps.filter((x) => extra.includes(x.lessonId)) } }, ...candidates];
  const l2 = buildLibrary({ professionId: "sales_manager", today: TODAY, curriculum: all.curriculum, role: b.engine.role,
    lessonSchema: j("content/career/v3/schemas/lesson.schema.json"), stepSchema: j("content/career/v3/schemas/plan-step.schema.json"),
    lessons: [...whatIfLessons, ...fx], planCandidates: cands, fileExists: (p) => !p.includes("..") && existsSync(p) });
  return profiles.map((p) => {
    const r = evaluateDiagnostic(b.diagnostic, p.answers, TODAY);
    const sel = selectLessons(b.engine, r, l2);
    const plan = buildPlan(b.engine, { result: r, selection: sel, library: l2, today: TODAY });
    return plan.status === "ready" ? "30" : sel.status !== "ready" ? "0" : String(plan.gaps.find((g) => g.phase === "total")?.available ?? "<30");
  });
}
const SCENARIOS = [
  ["Волна 1: VAL-01, VAL-02, TRD-01, MAP-01, MAP-02", ["VAL-01", "VAL-02", "TRD-01", "MAP-01", "MAP-02"]],
  ["+ SAL-01, SAL-03 (B2B: справка и КП)", ["VAL-01", "VAL-02", "TRD-01", "MAP-01", "MAP-02", "SAL-01", "SAL-03"]],
  ["+ SAL-04 (возражения)", ["VAL-01", "VAL-02", "TRD-01", "MAP-01", "MAP-02", "SAL-01", "SAL-03", "SAL-04"]],
  ["+ VAL-03, TRD-02", ["VAL-01", "VAL-02", "VAL-03", "TRD-01", "TRD-02", "MAP-01", "MAP-02", "SAL-01", "SAL-03", "SAL-04"]],
  ["+ MAP-03, VAL-04", ["VAL-01", "VAL-02", "VAL-03", "VAL-04", "TRD-01", "TRD-02", "MAP-01", "MAP-02", "MAP-03", "SAL-01", "SAL-03", "SAL-04"]],
];
out.push("## Сценарии наращивания (оценка)", "",
  "Число шагов, которые наберёт каждый профиль, если к шести написанным урокам добавить следующие. Ещё не написанные уроки заменены тестовыми заглушками: по 2 шага в общих модулях и 5 в практике. Это оценка структуры, а не содержания.", "",
  "| Набор уроков | " + profiles.map((p) => p.id.replace("FX-", "")).join(" | ") + " |",
  "| --- | " + profiles.map(() => "---").join(" | ") + " |");
for (const [label, set] of SCENARIOS) out.push(`| ${label} | ${scenario(set).join(" | ")} |`);
out.push("", "«0» — подбор пуст: нет практического урока под задачи профиля. У начинающего во входящих продажах подходят только SAL-02 и SAL-05, поэтому ему нужны 3 и больше различных шагов в каждом уроке общих модулей, а не только новые уроки.", "");
const text = out.join("\n");
if (process.argv.includes("--check")) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) { console.error("STALE " + OUT); process.exitCode = 1; } else console.log("PASS: gap report is current");
} else { writeFileSync(OUT, text); console.log("WROTE " + OUT); }
