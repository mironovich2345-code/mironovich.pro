#!/usr/bin/env node
// Content-gap report for the sales pilot.
//   1. Actual state: the real library exactly as the cabinet would see it (statuses untouched).
//   2. Hypothetical: every written lesson approved and its slot published — in memory only.
//   3. Growth estimate: the hypothetical plus test stand-ins ONLY for slots that have no written lesson.
// Test stand-ins (tests/fixtures/career-v3/fixture-library.mjs) never enter sections 1–2 and never reach
// real delivery: the server loader reads only content/career/v3/ (asserted below and in tests).
// Usage: node --experimental-strip-types scripts/career/report-v3-content-gap.mjs [--today=YYYY-MM-DD] [--check]
//   --today  date of the calculation (default: today; with --check, the date recorded in the report).
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildLibrary } from "../../lib/career-v3/library.ts";
import { evaluateDiagnostic } from "../../lib/career-v3/diagnostic.ts";
import { selectLessons } from "../../lib/career-v3/selection.ts";
import { buildPlan } from "../../lib/career-v3/plan.ts";
import { loadProfessionBundle } from "../../lib/server/career-v3/content.ts";
import { fixtureLibrarySources, FIXTURE_MARK } from "../../tests/fixtures/career-v3/fixture-library.mjs";

export const OUT = "docs/products/ai-career-v3/CONTENT_GAP.md";
const j = (p) => JSON.parse(readFileSync(p, "utf8"));
const listJson = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : []);
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? "");
const PHASE = { safety: "безопасность", apply: "применение", verify: "проверка", measure: "измерение", value: "ценность", next_level: "следующий уровень" };
const REASON = { nothing_fits_profile: "нет практического урока под выбранные задачи", mandatory_module_missing: "обязательный модуль не утверждён",
  no_approved_lessons: "нет утверждённых уроков", content_errors: "ошибки контента", diagnostic_outdated: "диагностика устарела" };
export const GROWTH = [
  ["+ SAL-07 (переговоры)", ["SAL-07"]],
  ["+ TRD-02, VAL-03", ["SAL-07", "TRD-02", "VAL-03"]],
  ["+ MAP-03, VAL-04, SAL-06", ["SAL-07", "TRD-02", "VAL-03", "MAP-03", "VAL-04", "SAL-06"]],
  ["Все оставшиеся слоты", ["SAL-06", "SAL-07", "MAP-03", "MAP-04", "TRD-02", "TRD-03", "VAL-03", "VAL-04", "VAL-05"]],
];

const isFixture = (doc) => typeof doc?.title === "string" && doc.title.includes(FIXTURE_MARK);

export function computeContentGap({ today }) {
  if (!isIso(today)) throw new Error("today must be YYYY-MM-DD");
  const b = loadProfessionBundle("sales_manager", today);
  const cur = j("content/career/v3/curriculum.json");
  const lessonSchema = j("content/career/v3/schemas/lesson.schema.json");
  const stepSchema = j("content/career/v3/schemas/plan-step.schema.json");
  const fileExists = (p) => !p.includes("..") && existsSync(p);
  // Every lesson file and every candidate file in the repository takes part.
  const lessons = listJson("content/career/v3/lessons").map((f) => ({ path: `content/career/v3/lessons/${f}`, document: j(`content/career/v3/lessons/${f}`) }));
  const candidates = listJson("content/career/v3/plan-candidates").map((f) => ({ path: `content/career/v3/plan-candidates/${f}`, document: j(`content/career/v3/plan-candidates/${f}`) }));
  for (const l of lessons) if (isFixture(l.document)) throw new Error(`test stand-in found in content: ${l.path}`);
  const written = new Set(lessons.map((l) => l.document.id));
  const allSteps = candidates.flatMap((c) => c.document.steps);
  const orphanSteps = allSteps.filter((s) => !written.has(s.lessonId)).map((s) => `${s.lessonId}/${s.stepId}`);
  const profiles = j("tests/fixtures/career-v3/pilot-profiles.json").profiles.filter((p) => p.id !== "FX-diagnostic-changed");
  const lib = (curriculum, docs, cands) => buildLibrary({ professionId: "sales_manager", today, curriculum, role: b.engine.role, lessonSchema, stepSchema, lessons: docs, planCandidates: cands, fileExists });
  const run = (library) => profiles.map((p) => {
    const r = evaluateDiagnostic(b.diagnostic, p.answers, today);
    const sel = selectLessons(b.engine, r, library);
    const plan = buildPlan(b.engine, { result: r, selection: sel, library, today });
    const steps = plan.status === "ready" ? 30 : sel.status !== "ready" ? 0 : (plan.gaps.find((g) => g.phase === "total")?.available ?? 0);
    return { id: p.id, story: p.story, variant: sel.variant, selection: sel.status, reason: sel.status !== "ready" ? sel.unavailableReason : plan.status === "ready" ? null : plan.reason,
      lessons: sel.items.map((i) => i.lessonId), steps,
      phases: Object.fromEntries(Object.keys(PHASE).map((ph) => [ph, plan.steps.filter((x) => x.phase === ph).length])), emptyPhases: plan.status === "ready" ? [] : plan.gaps.filter((g) => g.phase !== "total" && g.available === 0).map((g) => g.phase) };
  });

  // 1. Actual state.
  const actualLib = lib(cur, lessons, candidates);
  const actual = { deliverable: actualLib.entries.filter((e) => e.deliverable).map((e) => e.id),
    entries: actualLib.entries.map((e) => ({ id: e.id, status: e.status, deliverable: e.deliverable, exclusions: e.exclusions })), profiles: run(actualLib) };

  // 2. Hypothetical: all written lessons approved (in memory).
  const whatIfCur = structuredClone(cur);
  for (const s of whatIfCur.slots) if (written.has(s.id)) { s.status = "published"; s.publishedLessonId = s.id; }
  const approve = (l) => { const d = structuredClone(l.document); d.status = "approved"; d.quality.canBePublished = true; d.quality.reviewedOn = today; d.sourcePolicy.factualClaimsChecked = true; return { ...l, document: d }; };
  const whatIfLessons = lessons.map(approve);
  const whatIfLib = lib(whatIfCur, whatIfLessons, candidates);
  const whatIf = { deliverable: whatIfLib.entries.filter((e) => e.deliverable).map((e) => e.id),
    withheld: whatIfLib.entries.filter((e) => !e.deliverable).map((e) => ({ id: e.id, exclusions: e.exclusions })), profiles: run(whatIfLib) };

  // 3. Growth: stand-ins only for slots without a written lesson.
  const growth = GROWTH.map(([label, wanted]) => {
    const missing = wanted.filter((id) => !written.has(id));
    const all = fixtureLibrarySources();
    const keep = new Set([...written, ...missing]);
    const curriculum = structuredClone(whatIfCur);
    for (const s of curriculum.slots) if (missing.includes(s.id)) { s.status = "published"; s.publishedLessonId = s.id; } else if (!keep.has(s.id)) { s.status = "planned"; s.publishedLessonId = null; }
    const stubs = all.lessons.filter((l) => missing.includes(l.document.id));
    const stubSteps = all.planCandidates[0].document.steps.filter((s) => missing.includes(s.lessonId));
    for (const s of stubs) if (written.has(s.document.id)) throw new Error(`stand-in for a written lesson ${s.document.id}`);
    const l2 = lib(curriculum, [...whatIfLessons, ...stubs], [{ path: "fixture", document: { steps: stubSteps } }, ...candidates]);
    return { label, stubs: stubs.map((s) => s.document.id), alreadyWritten: wanted.filter((id) => written.has(id)), steps: run(l2).map((r) => r.steps) };
  });

  const modules = cur.modules.map((m) => {
    const slots = cur.slots.filter((s) => s.moduleId === m.id);
    return { id: m.id, title: m.title, slots: slots.length, written: slots.filter((s) => written.has(s.id)).map((s) => s.id),
      missing: slots.filter((s) => !written.has(s.id)).map((s) => s.id), steps: allSteps.filter((s) => slots.some((x) => x.id === s.lessonId)).length };
  });
  return { today, slots: cur.slots.length, written: [...written].sort(), candidateFiles: candidates.map((c) => ({ file: c.path.split("/").pop(), steps: c.document.steps.length })),
    stepCount: allSteps.length, orphanSteps, modules, profiles: profiles.map((p) => ({ id: p.id, story: p.story })), actual, whatIf, growth };
}

export function renderContentGap(g) {
  const o = [];
  const full = g.whatIf.profiles.filter((p) => p.steps === 30);
  o.push("<!-- Сгенерировано scripts/career/report-v3-content-gap.mjs по content/career/v3. Не редактировать вручную. -->", "",
    "# Дефицит контента пилота «менеджер по продажам»", "",
    `Дата расчёта: ${g.today}.`, "",
    "Отчёт отделяет факт от гипотезы. «Фактическое состояние» — то, что увидит кабинет сейчас. «Если утвердить» — расчёт в памяти: все написанные уроки приняты, их слоты опубликованы; в контенте ничего не меняется. "
    + "Тестовые заглушки используются только в оценке наращивания и только для уроков, которых ещё нет.", "",
    "## Сводка", "",
    `- Слотов в программе: **${g.slots}**; написано уроков: **${g.written.length}** (${g.written.join(", ")}).`,
    `- Шагов-кандидатов: **${g.stepCount}** (${g.candidateFiles.map((c) => `${c.file}: ${c.steps}`).join(", ")})${g.orphanSteps.length ? `; без урока: ${g.orphanSteps.join(", ")}` : ""}.`,
    `- Фактически утверждено и доступно к выдаче: **${g.actual.deliverable.length}** уроков; маршрут из 30 шагов сейчас не строится ни для одного профиля.`,
    `- Если утвердить все написанные материалы: 30 шагов получают **${full.length} из ${g.whatIf.profiles.length}** профилей${full.length ? ` (${full.map((p) => p.id.replace("FX-", "")).join(", ")})` : ""}.`,
    `- Слоты без урока: ${g.modules.flatMap((m) => m.missing).join(", ") || "нет"}. 30 шагов в гипотезе не означают готовую программу: эти слоты остаются пустыми, а маршрут существует только после реального утверждения уроков.`, "",
    "## По модулям", "", "| Модуль | Слотов | Написано | Не написано | Шагов-кандидатов |", "| --- | --- | --- | --- | --- |");
  for (const m of g.modules) o.push(`| ${m.title} | ${m.slots} | ${m.written.join(", ") || "—"} | ${m.missing.join(", ") || "—"} | ${m.steps} |`);
  o.push("", "## Фактическое состояние", "", "| Урок | Статус | Доступен к выдаче | Почему нет |", "| --- | --- | --- | --- |");
  for (const e of g.actual.entries) o.push(`| ${e.id} | ${e.status} | ${e.deliverable ? "да" : "нет"} | ${e.exclusions.join(", ") || "—"} |`);
  o.push("", "| Профиль | Подбор | Шагов из 30 | Причина |", "| --- | --- | --- | --- |");
  for (const p of g.actual.profiles) o.push(`| ${p.story} | ${p.selection === "ready" ? p.lessons.length + " уроков" : "недоступен"} | ${p.steps} | ${REASON[p.reason] ?? p.reason ?? "—"} |`);
  o.push("", "## Если утвердить все написанные материалы (гипотеза)", "");
  if (g.whatIf.withheld.length) o.push(`Даже после утверждения не выдаются: ${g.whatIf.withheld.map((w) => `${w.id} (${w.exclusions.join(", ")})`).join("; ")}.`, "");
  o.push("| Профиль | Вариант практики | Уроков в подборе | Различных шагов из 30 | Шаги по этапам (без. / прим. / пров. / изм. / ценн. / след.) | Пустые этапы или причина |", "| --- | --- | --- | --- | --- | --- |");
  for (const p of g.whatIf.profiles) o.push(`| ${p.story} | ${p.variant} | ${p.lessons.length} | ${p.steps} | ${p.steps === 30 ? Object.values(p.phases).join(" / ") : "—"} | ${p.selection !== "ready" ? REASON[p.reason] ?? p.reason : p.emptyPhases.map((x) => PHASE[x]).join(", ") || "—"} |`);
  o.push("", "Лимиты движка: не больше 4 шагов на урок, 2 на упражнение и одного на упражнение в каждом этапе; цели по этапам добираются сверх лимита, если шагов хватает. "
    + "Поэтому итог упирается в число подходящих профилю уроков.", "",
    "## Оценка наращивания (заглушки для ненаписанных уроков)", "",
    "К гипотезе выше добавляются тестовые заглушки только для слотов без написанного урока: по 2 шага в общих модулях и до 5 в практике. Это оценка структуры, а не содержания; заглушки никогда не попадают в выдачу.", "",
    "| Набор | Заглушки | " + g.profiles.map((p) => p.id.replace("FX-", "")).join(" | ") + " |", "| --- | --- | " + g.profiles.map(() => "---").join(" | ") + " |");
  o.push(`| Только написанное | — | ${g.whatIf.profiles.map((p) => p.steps).join(" | ")} |`);
  for (const s of g.growth) o.push(`| ${s.label} | ${s.stubs.join(", ") || "—"} | ${s.steps.join(" | ")} |`);
  o.push("");
  return o.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = process.argv.find((a) => a.startsWith("--today="))?.slice(8);
  const check = process.argv.includes("--check");
  const recorded = existsSync(OUT) ? readFileSync(OUT, "utf8").match(/Дата расчёта: (\d{4}-\d{2}-\d{2})/)?.[1] : null;
  const today = arg ?? (check ? recorded : null) ?? new Date().toISOString().slice(0, 10);
  const text = renderContentGap(computeContentGap({ today }));
  if (check) {
    if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) { console.error(`STALE ${OUT} (recalculated for ${today})`); process.exitCode = 1; } else console.log(`PASS: gap report is current for ${today}`);
  } else { writeFileSync(OUT, text); console.log(`WROTE ${OUT} for ${today}`); }
}
