#!/usr/bin/env node
// Builds the printable learner worksheet for each practical sales lesson from its JSON source,
// so the worksheet never drifts from the lesson. `--check` fails if a committed worksheet is stale.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SALES_LESSON_IDS = ["SAL-02", "SAL-05"];
const root = new URL("../../", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
const KIND = { prompt: "Промпт", checklist: "Чек-лист", measurement_sheet: "Лист замера", script: "Шаблон" };
const LEVEL = { starter: "начинающий", independent: "самостоятельный", experienced: "опытный" };

export function worksheetPath(lessonId) {
  return `content/career/v3/materials/sales/${lessonId}/worksheet.md`;
}

export function renderWorksheet(lesson) {
  const c = lesson.content;
  const out = [];
  const add = (...lines) => out.push(...lines);
  add(`<!-- Сгенерировано из content/career/v3/lessons/${lesson.id}.json скриптом scripts/career/build-sales-lesson-materials.mjs. Не редактируйте вручную. -->`, "");
  add(`# ${lesson.id}. ${lesson.title}`, "");
  add(`> Статус: **${lesson.status}** — черновик на редакционной и правовой приёмке, не опубликован. Все компании, люди и данные вымышлены.`, "");
  add(`- Длительность: ${lesson.durationMinutes} минут`);
  add(`- Для кого: менеджер по продажам, уровень — ${lesson.audience.levels.map(x => LEVEL[x]).join(", ")}`);
  add(`- Перед уроком: ${lesson.prerequisites.join(", ")}`);
  add(`- Задачи роли: ${lesson.audience.taskIds.join(", ")}; сценарий ${lesson.audience.scenarioId}`, "");
  add("## Что вы научитесь делать", "", ...lesson.objectives.map(x => `- ${x}`), "");
  add("## Правила безопасности", "");
  add("Не используйте в упражнениях:", "", ...lesson.security.forbiddenInputs.map(x => `- ${x}`), "");
  add(`**Если ИИ в вашей компании запрещён или правила неизвестны.** ${lesson.security.ifToolForbidden}`, "");
  add(`**Если ошибка уже произошла.** ${lesson.security.errorEscalation}`, "");
  add("## Порядок работы", "");
  c.procedure.forEach((p, i) => {
    add(`### Шаг ${i + 1}. ${p.title} (${p.id})`, "", p.instruction, "");
    add(`- Результат: ${p.expectedResult}`, `- Проверка: ${p.check}`, "");
  });
  add("## Шаблоны и промпты", "");
  for (const t of c.templates) {
    add(`### ${t.id} — ${t.title}`, "", `Тип: ${KIND[t.kind]}.`, "", "```", t.body, "```", "");
    add("Не вставлять:", "", ...t.prohibitedInputs.map(x => `- ${x}`), "");
  }
  add("## Практика", "");
  for (const e of c.exercises) {
    add(`### ${e.id}. ${e.title}`, "", `**Исходные данные (вымышленные).** ${e.syntheticInput}`, "");
    add("Что сделать:", "", ...e.instructions.map((x, i) => `${i + 1}. ${x}`), "");
    add(`**Что должно получиться.** ${e.expectedArtifact}`, "");
    add("Критерии самопроверки:", "", ...e.successCriteria.map(x => `- [ ] ${x}`), "");
  }
  add("## Мини-тест", "");
  c.quiz.forEach((q, i) => {
    add(`${i + 1}. ${q.question} (${q.id})`, "", ...q.options.map(o => `   - ${o.id}) ${o.text}`), "");
  });
  add("## Главное", "", ...c.summary.map(x => `- ${x}`), "");
  add("---", "", "## Ответы и образцы (откройте после выполнения)", "");
  for (const e of c.exercises) {
    add(`### Образец для ${e.id}`, "", e.sampleSolution, "", `**Если не получилось.** ${e.feedbackIfIncorrect}`, "");
  }
  add("### Ответы на мини-тест", "");
  c.quiz.forEach((q, i) => add(`${i + 1}. ${q.correctId} — ${q.reason}`));
  add("", "## Источники", "");
  for (const s of lesson.sources) add(`- ${s.title}. ${s.url} (проверено ${s.checkedOn}). ${s.supportsClaim}`);
  add("");
  return out.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const id of SALES_LESSON_IDS) {
    const lesson = JSON.parse(read(`content/career/v3/lessons/${id}.json`));
    const path = worksheetPath(id);
    const text = renderWorksheet(lesson);
    if (check) {
      if (!existsSync(new URL(path, root)) || read(path) !== text) { console.error("STALE " + path); stale++; }
    } else {
      writeFileSync(new URL(path, root), text);
      console.log("WROTE " + path);
    }
  }
  if (stale) process.exitCode = 1;
  else if (check) console.log("PASS: worksheets match lesson sources");
}
