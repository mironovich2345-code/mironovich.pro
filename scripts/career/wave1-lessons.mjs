#!/usr/bin/env node
// Wave 1 of AI Career v3 lessons (VAL-01, TRD-01, MAP-01, SAL-01): learner worksheets generated
// from the lesson JSON so they never drift. `--check` fails if a committed worksheet is stale.
// Note: PR #59 has a similar generator for SAL-02/SAL-05; both should be unified into one tool.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const WAVE1_IDS = ["VAL-01", "TRD-01", "MAP-01", "SAL-01"];
export const MATERIALS_DIR = "content/career/v3/materials/wave1";
const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const KIND = { prompt: "Промпт (только при разрешённом ИИ)", checklist: "Чек-лист", measurement_sheet: "Лист замера", script: "Шаблон" };
const LEVEL = { starter: "начинающий", independent: "самостоятельный", experienced: "опытный" };
const MODULE = { safety: "Безопасность", task_mapping: "Что можно поручить ИИ", practice: "ИИ в моей работе", trends: "Тренды и развитие навыков", value: "Ценность для компании" };

export const worksheetPath = (id) => `${MATERIALS_DIR}/${id}/worksheet.md`;
export const practicePath = (id) => `${MATERIALS_DIR}/${id}/practice-data.json`;
export const loadLesson = (id) => JSON.parse(read(`content/career/v3/lessons/${id}.json`));

export function renderWorksheet(lesson) {
  const c = lesson.content;
  const o = [];
  o.push(`<!-- Сгенерировано из content/career/v3/lessons/${lesson.id}.json скриптом scripts/career/wave1-lessons.mjs. Не редактируйте вручную. -->`, "");
  o.push(`# ${lesson.id}. ${lesson.title}`, "");
  o.push(`> Статус: **${lesson.status}** — черновик на приёмке, не опубликован. Все компании, люди, сайты и цифры вымышлены.`, "");
  o.push(`- Модуль: ${MODULE[lesson.moduleId] ?? lesson.moduleId}`, `- Длительность: ${lesson.durationMinutes} минут`,
    `- Уровни: ${lesson.audience.levels.map((x) => LEVEL[x]).join(", ")}`, `- Перед уроком: ${lesson.prerequisites.join(", ") || "—"}`, "");
  o.push("## Что вы научитесь делать", "", ...lesson.objectives.map((x) => `- ${x}`), "");
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
  o.push("", "## Источники", "");
  for (const s of lesson.sources) o.push(`- ${s.title}. ${s.url} (проверено ${s.checkedOn}). ${s.supportsClaim}`);
  o.push("");
  return o.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const id of WAVE1_IDS) {
    const text = renderWorksheet(loadLesson(id));
    const p = worksheetPath(id);
    if (check) { if (!existsSync(new URL(p, root)) || read(p) !== text) { console.error("STALE " + p); stale++; } }
    else { writeFileSync(new URL(p, root), text); console.log("WROTE " + p); }
  }
  if (stale) process.exitCode = 1; else if (check) console.log("PASS: wave 1 worksheets match lessons");
}
