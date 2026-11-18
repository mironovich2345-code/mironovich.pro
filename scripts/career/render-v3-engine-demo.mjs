#!/usr/bin/env node
// Renders docs/products/ai-career-v3/examples/engine-demo-fixture.md: task maps and 30-step plans
// built ONLY from the in-memory SYNTHETIC FIXTURE library of the tests. Not teaching material.
// Usage: node --experimental-strip-types scripts/career/render-v3-engine-demo.mjs [--check]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { buildLibrary } from "../../lib/career-v3/library.ts";
import { evaluateDiagnostic } from "../../lib/career-v3/diagnostic.ts";
import { buildTaskMap } from "../../lib/career-v3/task-map.ts";
import { selectLessons } from "../../lib/career-v3/selection.ts";
import { buildPlan } from "../../lib/career-v3/plan.ts";
import { loadProfessionBundle } from "../../lib/server/career-v3/content.ts";
import { fixtureLibrarySources } from "../../tests/fixtures/career-v3/fixture-library.mjs";

const OUT = "docs/products/ai-career-v3/examples/engine-demo-fixture.md";
const TODAY = "2026-11-18";
const j = (p) => JSON.parse(readFileSync(p, "utf8"));
const b = loadProfessionBundle("sales_manager", TODAY);
const lib = buildLibrary({ professionId: "sales_manager", today: TODAY, role: b.engine.role,
  lessonSchema: j("content/career/v3/schemas/lesson.schema.json"), stepSchema: j("content/career/v3/schemas/plan-step.schema.json"), ...fixtureLibrarySources() });
const profiles = j("tests/fixtures/career-v3/pilot-profiles.json").profiles;
const run = (id) => {
  const p = profiles.find((x) => x.id === id);
  const result = evaluateDiagnostic(b.diagnostic, p.answers, TODAY);
  const selection = selectLessons(b.engine, result, lib);
  return { p, result, selection, plan: buildPlan(b.engine, { result, selection, library: lib, today: TODAY }),
    map: buildTaskMap(b.engine, { result, answers: p.answers, library: lib, today: TODAY }) };
};
const PH = { safety: "Безопасность", apply: "Применение", verify: "Проверка", measure: "Измерение", value: "Ценность", next_level: "Следующий уровень" };
const DEC = { ai_can_take_part: "ИИ делает часть", ai_assists: "ИИ помогает, человек проверяет", human_decides: "Решает человек" };
const esc = (s) => String(s).replace(/\|/g, "\\|");
const out = [];
out.push("<!-- Сгенерировано scripts/career/render-v3-engine-demo.mjs. Не редактировать вручную. -->", "",
  "# Демонстрация движка на синтетической фикстуре", "",
  "> **[SYNTHETIC FIXTURE]** Карты и планы ниже построены на тестовой библиотеке, «утверждённой» только внутри тестов (`tests/fixtures/career-v3/fixture-library.mjs`). Это проверка логики движка, а не учебные материалы. Реальная библиотека сейчас отвечает `unavailable / no_approved_lessons`.", "");

function mapSection(r, title) {
  out.push(`## Карта задач: ${title}`, "", `Профиль: ${r.p.story}. Режим безопасности: \`${r.result.safety.mode}\`, правила: ${r.result.safety.appliedRules.map((x) => x.id).join(", ")}.`, "");
  out.push("| Задача | Решение | Обоснование (матрица) | Ограничения и проверки | Навык | Метрика | Уроки |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const t of r.map.tasks) {
    out.push(`| ${esc(t.taskId + " " + t.title)} | ${DEC[t.decision]}${t.basis.tightenedBySafety ? " (ужесточено правилами безопасности)" : ""} | ${esc(t.basis.modeMeaning)} | ${esc([...t.companyRestrictions, ...t.mandatoryChecks].join(" • "))} | ${esc(t.skill?.name ?? "—")} | ${esc(t.metric ? `${t.metric.label} (${t.metric.kind === "exercise" ? "упражнение" : "рабочий показатель, не приписывается"})` : "—")} | ${t.lessonRefs.map((l) => l.lessonId).join(", ")} |`);
  }
  out.push("", `**Сильные стороны** (${r.map.strengths.status}): ${r.map.strengths.items.length ? r.map.strengths.items.map((s) => `${s.label} — ${s.evidence}`).join("; ") : r.map.strengths.note}`, "");
  out.push(`**Навыки роста:** ${r.map.growthSkills.map((g) => `${g.name} (${g.reasons.join(", ")})`).join("; ")}`, "");
}
const b2b = run("FX-b2b-experienced-public-tools"), starter = run("FX-inbound-starter"), banned = run("FX-account-ai-prohibited");
mapSection(b2b, "опытный B2B-менеджер");
mapSection(starter, "новичок во входящих продажах");

out.push("## Сравнение маршрутов трёх профилей", "", "| | Опытный B2B | Новичок, входящие | ИИ запрещён (аккаунт) |", "| --- | --- | --- | --- |");
const rows = [
  ["Вариант практики", (r) => r.selection.variant],
  ["Уроков в подборе", (r) => r.selection.items.length],
  ["Практические уроки в плане", (r) => [...new Set(r.plan.steps.filter((s) => s.lessonId.startsWith("SAL-")).map((s) => s.lessonId))].join(", ")],
  ["Шаги по фазам", (r) => Object.entries(r.plan.phaseCounts).map(([k, v]) => `${PH[k]} ${v}`).join(", ")],
  ["Первый шаг после безопасности", (r) => { const s = r.plan.steps.find((x) => x.phase !== "safety"); return `${PH[s.phase]}: ${s.lessonId}`; }],
  ["Промпт-шаблонов в плане", (r) => r.plan.steps.filter((s) => s.templateKind === "prompt").length],
  ["Сессий (по времени Q17)", (r) => `${r.plan.steps.at(-1).session} × до ${r.plan.sessionMinutes} мин`],
];
for (const [label, f] of rows) out.push(`| ${label} | ${esc(f(b2b))} | ${esc(f(starter))} | ${esc(f(banned))} |`);
const shared = (a, c) => a.plan.steps.filter((s) => c.plan.steps.some((x) => x.stableId === s.stableId)).length;
out.push("", `Общих шагов: B2B и новичок — ${shared(b2b, starter)} из 30; новичок и «ИИ запрещён» — ${shared(starter, banned)} из 30; B2B и «ИИ запрещён» — ${shared(b2b, banned)} из 30.`, "");

out.push("## Полный план из 30 шагов: опытный B2B-менеджер", "", "| № | Фаза | Урок / упражнение / шаблон | Метрика | Почему выбран | Сессия |", "| --- | --- | --- | --- | --- | --- |");
for (const s of b2b.plan.steps) {
  out.push(`| ${s.position} | ${PH[s.phase]} | ${s.lessonId} / ${s.exerciseId} / ${s.templateId} (${s.templateKind}) | ${s.metric ? s.metric.metricId : "—"} | ${esc(s.why.reasons.join(", "))} | ${s.session} |`);
}
const first = b2b.plan.steps[0];
out.push("", "Пример полного шага (STEP-01):", "", "```json", JSON.stringify(first, null, 2), "```", "");
const text = out.join("\n");
if (process.argv.includes("--check")) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) { console.error("STALE " + OUT); process.exitCode = 1; } else console.log("PASS: demo is current");
} else { mkdirSync("docs/products/ai-career-v3/examples", { recursive: true }); writeFileSync(OUT, text); console.log("WROTE " + OUT); }
