#!/usr/bin/env node
// Lesson packs of AI Career v3 that live outside the earlier packs (#57 safety, #59 SAL-02/05, #62 wave 1).
// Learner worksheets are generated from the lesson JSON so they never drift; `--check` fails on a stale file.
// The renderer follows scripts/career/wave1-lessons.mjs from PR #62 but is driven by pack configs in
// content/career/v3/lesson-packs/*.json, so the other packs can be moved here when the PRs are consolidated.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
// One config file per pack keeps packs on separate branches merge-free: the scripts stay identical.
export const PACKS_DIR = "content/career/v3/lesson-packs";
export const PACKS = Object.fromEntries(
  (existsSync(new URL(PACKS_DIR, root)) ? readdirSync(new URL(PACKS_DIR, root)) : [])
    .filter((f) => f.endsWith(".json")).sort()
    .map((f) => { const c = JSON.parse(readFileSync(new URL(`${PACKS_DIR}/${f}`, root), "utf8")); return [c.id, c]; }),
);

const read = (p) => readFileSync(new URL(p, root), "utf8");
const KIND = { prompt: "Промпт (только при разрешённом ИИ)", checklist: "Чек-лист", measurement_sheet: "Лист замера", script: "Шаблон" };
const LEVEL = { starter: "начинающий", independent: "самостоятельный", experienced: "опытный" };
const MODULE = { safety: "Безопасность", task_mapping: "Что можно поручить ИИ", practice: "ИИ в моей работе", trends: "Тренды и развитие навыков", value: "Ценность для компании" };

export const worksheetPath = (pack, id) => `${PACKS[pack].materialsDir}/${id}/worksheet.md`;
export const practicePath = (pack, id) => `${PACKS[pack].materialsDir}/${id}/practice-data.json`;
export const loadLesson = (id) => JSON.parse(read(`content/career/v3/lessons/${id}.json`));

export function renderWorksheet(lesson) {
  const c = lesson.content;
  const o = [];
  o.push(`<!-- Сгенерировано из content/career/v3/lessons/${lesson.id}.json скриптом scripts/career/v3-lesson-packs.mjs. Не редактируйте вручную. -->`, "");
  o.push(`# ${lesson.id}. ${lesson.title}`, "");
  o.push(`> Статус: **${lesson.status}** — черновик на приёмке, не опубликован. Все компании, люди, адреса, цены и письма вымышлены.`, "");
  o.push(`- Модуль: ${MODULE[lesson.moduleId] ?? lesson.moduleId}`, `- Длительность: ${lesson.durationMinutes} минут`,
    `- Уровни: ${lesson.audience.levels.map((x) => LEVEL[x]).join(", ")}`, `- Перед уроком: ${lesson.prerequisites.join(", ") || "—"}`, "");
  o.push("## Что вы научитесь делать", "", ...lesson.objectives.map((x) => `- ${x}`), "");
  o.push(`## ${c.introduction.heading}`, "", ...c.introduction.paragraphs.flatMap((x) => [x, ""]));
  o.push("## Теория", "");
  for (const x of c.explanations) o.push(`### ${x.heading}`, "", x.body, "", `*Пример.* ${x.example}`, "");
  o.push("## Разобранные примеры", "");
  for (const x of c.workedExamples) o.push(`### ${x.id}. ${x.title}`, "", `**Ситуация.** ${x.situation}`, "", `**Как делать не нужно.** ${x.unsafeAttempt}`, "",
    `**Безопасный способ.** ${x.safeApproach}`, "", `**Результат.** ${x.workedOutput}`, "", `**Проверка человеком.** ${x.humanReview}`, "");
  o.push("## Ограничения", "", "Не используйте в упражнениях:", "", ...lesson.security.forbiddenInputs.map((x) => `- ${x}`), "");
  o.push(`**Без ИИ.** ${lesson.security.ifToolForbidden}`, "", `**Если ошибка уже произошла.** ${lesson.security.errorEscalation}`, "");
  o.push("## Порядок работы", "");
  c.procedure.forEach((p, i) => o.push(`### Шаг ${i + 1}. ${p.title} (${p.id})`, "", p.instruction, "", `- Результат: ${p.expectedResult}`, `- Проверка: ${p.check}`, ""));
  o.push("## Шаблоны", "");
  for (const t of c.templates) o.push(`### ${t.id} — ${t.title}`, "", `Тип: ${KIND[t.kind]}.`, "", "```", t.body, "```", "", "Не вставлять:", "", ...t.prohibitedInputs.map((x) => `- ${x}`), "");
  o.push("## Практика", "");
  for (const e of c.exercises) {
    o.push(`### ${e.id}. ${e.title}`, "", `**Исходные данные (вымышленные).** ${e.syntheticInput}`, "", "Что сделать:", "",
      ...e.instructions.map((x, i) => `${i + 1}. ${x}`), "", `**Что должно получиться.** ${e.expectedArtifact}`, "", "Критерии самопроверки:", "",
      ...e.successCriteria.map((x) => `- [ ] ${x}`), "");
  }
  o.push("## Мини-тест", "");
  c.quiz.forEach((q, i) => o.push(`${i + 1}. ${q.question} (${q.id})`, "", ...q.options.map((x) => `   - ${x.id}) ${x.text}`), ""));
  o.push("## Главное", "", ...c.summary.map((x) => `- ${x}`), "", "---", "", "## Ответы и образцы (откройте после выполнения)", "");
  for (const e of c.exercises) o.push(`### Образец для ${e.id}`, "", e.sampleSolution, "", `**Если не получилось.** ${e.feedbackIfIncorrect}`, "");
  o.push("### Ответы на мини-тест", "");
  c.quiz.forEach((q, i) => o.push(`${i + 1}. ${q.correctId} — ${q.reason}`));
  o.push("", "## Источники и актуальность", "");
  for (const s of lesson.sources) o.push(`- ${s.title}. ${s.url} (проверено ${s.checkedOn}). ${s.supportsClaim}`);
  o.push("", `Следующая проверка актуальности: ${lesson.sourcePolicy.nextReviewOn}. Факты урока ещё не подтверждены владельцем проекта.`, "");
  return o.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const [pack, cfg] of Object.entries(PACKS)) for (const id of cfg.ids) {
    const text = renderWorksheet(loadLesson(id));
    const p = worksheetPath(pack, id);
    if (check) { if (!existsSync(new URL(p, root)) || read(p) !== text) { console.error("STALE " + p); stale++; } }
    else { writeFileSync(new URL(p, root), text); console.log("WROTE " + p); }
  }
  if (stale) process.exitCode = 1; else if (check) console.log("PASS: lesson-pack worksheets match lessons");
}
