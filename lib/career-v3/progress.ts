// Progress through the 30 steps of an AI Career 3.0 plan — pure rules shared by the server and tests.
// A step is "done" only when the exercise criteria are self-checked, the lesson mini-test is passed and
// the step's own completion criteria are confirmed; the server derives every state, the client never
// sets one. Only booleans and option IDs are accepted: no free text with employer or client data.
import { PLAN_STEPS_REQUIRED, type PlanV3, type PlanStepV3, type StepState } from "./contracts.ts";

export const PROGRESS_MODEL = "career-v3-progress/1";
export const STEP_STATES: StepState[] = ["not_started", "in_progress", "self_checked", "done"];
export const STATE_LABEL: Record<StepState, string> = {
  not_started: "Не начат", in_progress: "Изучается", self_checked: "Проверка пройдена", done: "Завершён",
};

export class ProgressInputError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type ReadyPlan = Extract<PlanV3, { status: "ready" }>;

/** What identifies a plan version: content versions and the ordered stable step IDs, not the build date. */
export function planFingerprintSource(plan: ReadyPlan): string {
  return JSON.stringify({
    model: plan.modelVersion, profession: plan.professionId, variant: plan.variant,
    versions: plan.versions, steps: plan.steps.map((s) => [s.position, s.stableId, s.exerciseId, s.templateId]),
  });
}

/** Exactly `count` booleans; anything else (strings, extra fields, wrong length) is refused. */
export function checkBooleans(value: unknown, count: number, what: string): boolean[] {
  if (!Array.isArray(value) || value.length !== count || !value.every((v) => typeof v === "boolean"))
    throw new ProgressInputError("invalid_checklist", `${what}: ожидается список из ${count} отметок`);
  return value as boolean[];
}

export interface QuizQuestion { id: string; correctId: string; options: { id: string }[] }

/** Grades a mini-test against the lesson version. Answers must cover every question with a known option ID. */
export function gradeQuiz(quiz: QuizQuestion[], answers: unknown) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new ProgressInputError("invalid_answers", "Ответы мини-теста не распознаны");
  const a = answers as Record<string, unknown>;
  const ids = quiz.map((q) => q.id);
  if (Object.keys(a).length !== ids.length || Object.keys(a).some((k) => !ids.includes(k)))
    throw new ProgressInputError("incomplete_answers", "Ответьте на все вопросы мини-теста");
  const results = quiz.map((q) => {
    const v = a[q.id];
    if (typeof v !== "string" || !q.options.some((o) => o.id === v)) throw new ProgressInputError("invalid_option", "Недопустимый вариант ответа");
    return { questionId: q.id, chosen: v, correct: v === q.correctId };
  });
  const correct = results.filter((r) => r.correct).length;
  return { results, correct, total: quiz.length, passed: correct === quiz.length, answers: Object.fromEntries(results.map((r) => [r.questionId, r.chosen])) };
}

export interface StepFacts {
  started: boolean;
  criteriaMet: boolean[] | null;
  criteriaCount: number;
  quizPassed: boolean;
  completedAt: string | null;
}

/** The single source of a step's state. "done" is sticky: a recorded completion is never undone or repeated. */
export function deriveState(f: StepFacts): StepState {
  if (f.completedAt) return "done";
  const checked = !!f.criteriaMet && f.criteriaMet.length === f.criteriaCount && f.criteriaCount > 0 && f.criteriaMet.every(Boolean);
  if (checked && f.quizPassed) return "self_checked";
  if (f.started || (f.criteriaMet?.some(Boolean) ?? false)) return "in_progress";
  return "not_started";
}

/** Completion requires the self-check state and every completion criterion of the step confirmed. */
export function canComplete(state: StepState, step: Pick<PlanStepV3, "completionCriteria">, completionMet: boolean[]): { ok: boolean; reason?: string } {
  if (state === "done") return { ok: true };
  if (state !== "self_checked") return { ok: false, reason: "Сначала отметьте все критерии упражнения и пройдите мини-тест урока" };
  if (completionMet.length !== step.completionCriteria.length || !completionMet.every(Boolean)) return { ok: false, reason: "Подтвердите все критерии выполнения шага" };
  return { ok: true };
}

export function summarize(states: StepState[]) {
  const count = (s: StepState) => states.filter((x) => x === s).length;
  const done = count("done");
  return {
    total: PLAN_STEPS_REQUIRED, done, selfChecked: count("self_checked"), inProgress: count("in_progress"),
    notStarted: PLAN_STEPS_REQUIRED - done - count("self_checked") - count("in_progress"),
    // Rounded to the nearest whole percent (2/30 → 7%); the exact number of steps is always shown next to it.
    percent: Math.round((done / PLAN_STEPS_REQUIRED) * 100),
  };
}

/** Where to resume: the saved cursor if that step is not done, otherwise the first step that is not done. */
export function resumePosition(cursor: number | null, rows: { position: number; state: StepState }[]): number | null {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const atCursor = sorted.find((r) => r.position === cursor);
  if (atCursor && atCursor.state !== "done") return atCursor.position;
  return sorted.find((r) => r.state !== "done")?.position ?? null;
}
