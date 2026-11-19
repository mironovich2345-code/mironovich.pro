import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STATE_LABEL, STEP_STATES, ProgressInputError, canComplete, checkBooleans, deriveState, gradeQuiz, planFingerprintSource, resumePosition, summarize,
} from "../lib/career-v3/progress.ts";

const quiz = [
  { id: "Q1", correctId: "b", options: [{ id: "a" }, { id: "b" }, { id: "c" }] },
  { id: "Q2", correctId: "c", options: [{ id: "a" }, { id: "b" }, { id: "c" }] },
];
const facts = (o = {}) => ({ started: false, criteriaMet: null, criteriaCount: 3, quizPassed: false, completedAt: null, ...o });

test("four states with learner-facing labels", () => {
  assert.deepEqual(STEP_STATES, ["not_started", "in_progress", "self_checked", "done"]);
  assert.deepEqual(Object.values(STATE_LABEL), ["Не начат", "Изучается", "Проверка пройдена", "Завершён"]);
});

test("state is derived only from facts: criteria and mini-test together give 'self-checked'", () => {
  assert.equal(deriveState(facts()), "not_started");
  assert.equal(deriveState(facts({ started: true })), "in_progress");
  assert.equal(deriveState(facts({ criteriaMet: [true, false, true] })), "in_progress");
  assert.equal(deriveState(facts({ criteriaMet: [true, true, true] })), "in_progress", "criteria without the mini-test are not enough");
  assert.equal(deriveState(facts({ quizPassed: true, started: true })), "in_progress", "the mini-test without criteria is not enough");
  assert.equal(deriveState(facts({ criteriaMet: [true, true, true], quizPassed: true })), "self_checked");
  assert.equal(deriveState(facts({ criteriaMet: [true, true], quizPassed: true })), "in_progress", "wrong number of criteria never counts");
  assert.equal(deriveState(facts({ completedAt: "2026-11-19T10:00:00Z" })), "done", "a recorded completion is sticky");
});

test("completion needs the self-check state and every step criterion confirmed", () => {
  const step = { completionCriteria: ["a", "b", "c"] };
  assert.equal(canComplete("in_progress", step, [true, true, true]).ok, false);
  assert.equal(canComplete("not_started", step, [true, true, true]).ok, false);
  assert.equal(canComplete("self_checked", step, [true, false, true]).ok, false);
  assert.equal(canComplete("self_checked", step, [true, true]).ok, false);
  assert.equal(canComplete("self_checked", step, [true, true, true]).ok, true);
  assert.equal(canComplete("done", step, []).ok, true, "repeat is accepted but changes nothing (server returns alreadyDone)");
});

test("checklists accept exactly N booleans — no strings, no free text, no extra items", () => {
  assert.deepEqual(checkBooleans([true, false], 2, "x"), [true, false]);
  for (const bad of [[true], [true, false, true], ["true", false], [1, 0], "true,false", null, { 0: true, 1: true }, [true, "ООО Ромашка"]]) {
    assert.throws(() => checkBooleans(bad, 2, "x"), ProgressInputError, JSON.stringify(bad));
  }
});

test("mini-test is graded against the lesson: all questions, known option IDs, pass = all correct", () => {
  const ok = gradeQuiz(quiz, { Q1: "b", Q2: "c" });
  assert.equal(ok.passed, true);
  assert.equal(ok.correct, 2);
  const wrong = gradeQuiz(quiz, { Q1: "b", Q2: "a" });
  assert.equal(wrong.passed, false);
  assert.deepEqual(wrong.results.map((r) => r.correct), [true, false]);
  assert.throws(() => gradeQuiz(quiz, { Q1: "b" }), /Ответьте на все вопросы/);
  assert.throws(() => gradeQuiz(quiz, { Q1: "b", Q2: "c", Q3: "a" }), /Ответьте на все вопросы/);
  assert.throws(() => gradeQuiz(quiz, { Q1: "b", Q2: "z" }), /Недопустимый вариант/);
  assert.throws(() => gradeQuiz(quiz, { Q1: "b", Q2: "Клиент ООО Ромашка" }), /Недопустимый вариант/);
  assert.throws(() => gradeQuiz(quiz, ["b", "c"]), /не распознаны/);
});

test("summary counts states and the percent of completed steps out of 30", () => {
  const states = [...Array(7).fill("done"), "self_checked", "in_progress", ...Array(21).fill("not_started")];
  assert.deepEqual(summarize(states), { total: 30, done: 7, selfChecked: 1, inProgress: 1, notStarted: 21, percent: 23 });
  assert.equal(summarize(Array(30).fill("done")).percent, 100);
  assert.equal(summarize(Array(30).fill("not_started")).percent, 0);
});

test("resume: the saved step unless it is done, then the first unfinished step", () => {
  const rows = [{ position: 1, state: "done" }, { position: 2, state: "in_progress" }, { position: 3, state: "not_started" }];
  assert.equal(resumePosition(3, rows), 3);
  assert.equal(resumePosition(1, rows), 2);
  assert.equal(resumePosition(null, rows), 2);
  assert.equal(resumePosition(2, rows.map((r) => ({ ...r, state: "done" }))), null);
});

test("plan fingerprint ignores the build date but changes with lesson versions or steps", () => {
  const base = {
    modelVersion: "career-v3-plan/1", professionId: "sales_manager", variant: "manual_without_ai", builtOn: "2026-11-19",
    versions: { diagnostic: "d1", role: "r1", program: "p1", library: "l1", resultModel: "m", lessons: { "SAF-01": "1.0.0" } },
    steps: [{ position: 1, stableId: "SAF-01@1.0.0/STEP-01", exerciseId: "SAF01-TASK-1", templateId: "TPL-SAF01-1" }],
  };
  const other = structuredClone(base);
  other.builtOn = "2026-12-01";
  assert.equal(planFingerprintSource(base), planFingerprintSource(other));
  const lesson = structuredClone(base);
  lesson.versions.lessons["SAF-01"] = "1.1.0";
  assert.notEqual(planFingerprintSource(base), planFingerprintSource(lesson));
});

test("migration 007: separate tables, synthetic-only, one active plan per account, sticky completion, v2 untouched", () => {
  const sql = readFileSync("migrations/career/007_v3_progress.sql", "utf8");
  assert.match(sql, /CAREER_TEST_DATABASE_REQUIRED/);
  for (const t of ["career_v3_plan_versions", "career_v3_step_progress", "career_v3_quiz_results"]) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`));
  assert.match(sql, /WHERE status = 'active'/);
  assert.match(sql, /CHECK \(\(state = 'done'\) = \(completed_at IS NOT NULL\)\)/);
  assert.match(sql, /REFERENCES career_v3_plan_versions\(id, account_id\)/, "progress rows cannot point at another account's plan");
  assert.doesNotMatch(sql, /\b(ALTER|DROP|UPDATE|DELETE)\b[^;]*career_progress\b/i, "v2 career_progress is not touched");
  assert.doesNotMatch(sql, /\btext\b[^,]*answer_text|free_text/i);
});
