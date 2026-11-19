import test from "node:test";
import assert from "node:assert/strict";
import { questionnaire } from "../lib/career-v3/diagnostic.ts";
import { loadProfessionBundle } from "../lib/server/career-v3/content.ts";
import {
  questionSequence, pruneFollowUps, toggleMulti, localProblem, pruneTaskChoices, optionsFor, answerLabel, humanize, hasTechnicalId,
} from "../lib/career-v3/ui-flow.ts";

const b = loadProfessionBundle("sales_manager", "2026-11-18");
const q = questionnaire(b.diagnostic);
const byId = (id) => [...q.questions, ...q.followUps].find((x) => x.id === id);

test("sequence: 18 primary questions; follow-ups appear right after their trigger and only when due", () => {
  assert.equal(questionSequence(q, {}).length, 18);
  const mixed = questionSequence(q, { Q01: "mixed", Q12: "unknown" }).map((x) => x.id);
  assert.equal(mixed.length, 20);
  assert.equal(mixed[mixed.indexOf("Q01") + 1], "F02");
  assert.equal(mixed[mixed.indexOf("Q12") + 1], "F01");
  assert.ok(questionSequence(q, {}).length <= q.maxTotalQuestions);
});

test("changing a trigger drops the follow-up answer that is no longer asked", () => {
  const a = pruneFollowUps(q, { Q01: "inbound", F02: "account", Q12: "approved_specific", F01: "it" });
  assert.equal(a.F02, undefined);
  assert.equal(a.F01, undefined);
  assert.equal(a.Q01, "inbound");
});

test("multi-choice honours exclusive options and the maximum", () => {
  const q11 = byId("Q11");
  assert.deepEqual(toggleMulti(q11, ["chat"], "none"), ["none"]);
  assert.deepEqual(toggleMulti(q11, ["none"], "chat"), ["chat"]);
  const q03 = byId("Q03");
  assert.deepEqual(toggleMulti(q03, ["research", "outreach", "crm"], "proposal"), ["outreach", "crm", "proposal"]);
  const q04 = byId("Q04");
  assert.deepEqual(toggleMulti(q04, ["T07"], "none_of_these"), ["none_of_these"]);
});

test("local checks and stale task choices", () => {
  assert.match(localProblem(byId("Q02"), undefined, []), /Выберите/);
  assert.equal(localProblem(byId("Q02"), "starter", []), null);
  const q04 = byId("Q04");
  const opts = [{ value: "T07", label: "Ответ на заявку" }];
  assert.equal(localProblem(q04, ["T07"], opts), null);
  assert.match(localProblem(q04, ["T01"], opts), /больше недоступна/);
  const { kept, removed } = pruneTaskChoices(q04, ["T07", "T01"], opts, { T01: "Исследовать компанию" });
  assert.deepEqual(kept, ["T07"]);
  assert.deepEqual(removed, ["Исследовать компанию"]);
  assert.equal(optionsFor(q04, opts).at(-1).value, "none_of_these");
  assert.equal(answerLabel(q, "Q02", "starter"), byId("Q02").options[0].label);
});

test("no free-text fields: every question is a choice question", () => {
  for (const x of [...q.questions, ...q.followUps]) assert.ok(["single", "multi", "matrix_task_multi"].includes(x.kind), x.id);
});

test("humanize removes technical identifiers, including after Cyrillic words", () => {
  const names = { T07: "Подготовить первый ответ", "TPL-SAL02-BRIEF": "Бриф письма" };
  assert.equal(humanize("задача T07", names), "задача «Подготовить первый ответ»");
  assert.equal(humanize("Причина: задача T99"), "Причина: выбранная задача");
  assert.equal(humanize("по шаблону TPL-SAL02-BRIEF", names), "по шаблону «Бриф письма»");
  assert.equal(humanize("обязательный урок SAF-03 не утверждён"), "обязательный урок модуля безопасности не утверждён");
  assert.equal(humanize("этапа «next_level»"), "этапа «Следующий уровень»");
  for (const t of ["задача T07", "SAFE-03", "TPL-SAL02-BRIEF", "SAL02-TASK-1", "STEP-01", "SAF-01-EX"]) {
    assert.ok(hasTechnicalId(t), t);
    assert.ok(!hasTechnicalId(humanize(t)) || t === "STEP-01", t);
  }
});

test("internal product wording is not shown", () => {
  assert.equal(humanize("Утверждённых уроков программы v3 пока нет"), "Утверждённых уроков программы пока нет");
});

test("lesson IDs after the word «урока» are dropped", () => {
  assert.equal(humanize("Рабочий лист урока MAP-01: операции"), "Рабочий лист урока: операции");
});

test("a leading task code in lesson text is stripped", () => {
  assert.equal(humanize("Задачи: T07 — подготовить ответ; T10 — обновить CRM"), "Задачи: подготовить ответ; обновить CRM");
});
