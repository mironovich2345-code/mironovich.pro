// Pure helpers for the v3 cabinet UI: question sequence, answer editing, and turning engine output
// into plain language without technical IDs. No React, no network — unit-tested.

export interface QOption { value: string; label: string }
export interface QView {
  id: string;
  section: string;
  prompt: string;
  help: string;
  why: string;
  kind: "single" | "multi" | "matrix_task_multi";
  options: QOption[];
  minSelected: number | null;
  maxSelected: number | null;
  exclusiveOptions: string[];
  allowOption: { value: string; label: string } | null;
  showWhen: { questionId: string; valueIn: string[] } | null;
}
export interface Questionnaire { questions: QView[]; followUps: QView[]; maxTotalQuestions: number }
export type Answers = Record<string, string | string[]>;

const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Questions to ask in order: each primary question, followed by its follow-ups whose condition holds. */
export function questionSequence(q: Questionnaire, answers: Answers): QView[] {
  const out: QView[] = [];
  for (const p of q.questions) {
    out.push(p);
    for (const f of q.followUps) {
      if (f.showWhen?.questionId === p.id && list(answers[p.id]).some((v) => f.showWhen!.valueIn.includes(v))) out.push(f);
    }
  }
  return out.slice(0, q.maxTotalQuestions);
}

/** Drops answers of follow-ups that are no longer asked. */
export function pruneFollowUps(q: Questionnaire, answers: Answers): Answers {
  const asked = new Set(questionSequence(q, answers).map((x) => x.id));
  return Object.fromEntries(Object.entries(answers).filter(([k]) => asked.has(k)));
}

export function optionsFor(question: QView, taskOptions: QOption[]): QOption[] {
  const base = question.kind === "matrix_task_multi" ? taskOptions : question.options;
  return question.allowOption ? [...base, { value: question.allowOption.value, label: question.allowOption.label }] : base;
}

export function exclusiveValues(question: QView): string[] {
  return [...question.exclusiveOptions, ...(question.allowOption ? [question.allowOption.value] : [])];
}

/** Toggle in a multi-choice question, honouring exclusive options and the maximum. */
export function toggleMulti(question: QView, current: string[], value: string): string[] {
  const exclusive = exclusiveValues(question);
  if (current.includes(value)) return current.filter((v) => v !== value);
  if (exclusive.includes(value)) return [value];
  const next = [...current.filter((v) => !exclusive.includes(v)), value];
  const max = question.maxSelected ?? next.length;
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Local completeness check; the server remains the authority. */
export function localProblem(question: QView, value: string | string[] | undefined, taskOptions: QOption[]): string | null {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return "Выберите вариант ответа.";
  if (question.kind === "single") return typeof value === "string" && question.options.some((o) => o.value === value) ? null : "Выберите один вариант.";
  const values = list(value);
  const allowed = new Set(optionsFor(question, taskOptions).map((o) => o.value));
  if (values.some((v) => !allowed.has(v))) return "Часть выбранных вариантов больше недоступна — проверьте ответ.";
  const min = question.minSelected ?? 1, max = question.maxSelected ?? values.length;
  if (values.length < min) return `Выберите хотя бы ${min}.`;
  if (values.length > max) return `Можно выбрать не больше ${max}.`;
  return null;
}

/** Removes Q04-style task choices that are no longer offered; returns the labels of removed ones. */
export function pruneTaskChoices(question: QView, value: string[] | undefined, taskOptions: QOption[], previousLabels: Record<string, string>) {
  const allowed = new Set(optionsFor(question, taskOptions).map((o) => o.value));
  const kept = list(value).filter((v) => allowed.has(v));
  const removed = list(value).filter((v) => !allowed.has(v)).map((v) => previousLabels[v] ?? "одна из задач");
  return { kept, removed };
}

export function answerLabel(q: Questionnaire, questionId: string, value: string | string[] | undefined, taskOptions: QOption[] = []): string {
  const question = [...q.questions, ...q.followUps].find((x) => x.id === questionId);
  if (!question || value === undefined) return "—";
  const opts = optionsFor(question, taskOptions);
  return list(value).map((v) => opts.find((o) => o.value === v)?.label ?? "—").join("; ");
}

// ---------- plain-language rendering of engine output ----------

export const PHASE_LABEL: Record<string, string> = {
  safety: "Безопасность", apply: "Применение", verify: "Проверка", measure: "Измерение",
  value: "Ценность для компании", next_level: "Следующий уровень", total: "Всего",
};
export const DECISION_LABEL: Record<string, string> = {
  ai_can_take_part: "ИИ может взять часть работы — при разрешённых условиях",
  ai_assists: "ИИ помогает подготовить черновик — проверяете и решаете вы",
  human_decides: "Решаете вы — ИИ только для справочной подготовки",
};
export const VARIANT_LABEL: Record<string, string> = {
  manual_without_ai: "Практика вручную, без ИИ",
  synthetic_practice: "Учебная практика на вымышленных данных",
  approved_tools_public_data: "Разрешённые инструменты, общедоступные и учебные данные",
};
export const METRIC_KIND_LABEL: Record<string, string> = {
  exercise: "измеряете на своих учебных заданиях",
  workplace_outcome: "рабочий показатель: можно наблюдать, но нельзя приписать обучению или ИИ",
};
export const MODULE_LABEL: Record<string, string> = {
  safety: "Безопасность", task_mapping: "Что можно поручить ИИ", practice: "ИИ в моей работе",
  trends: "Тренды и навыки", value: "Ценность для компании",
};

/** Replaces internal IDs (task, slot, template, exercise) with human names or neutral words. */
export function humanize(text: string, names: Record<string, string> = {}): string {
  return text
    // JS \b is ASCII-only, so Cyrillic words use an explicit start-of-string-or-non-letter guard.
    .replace(/(^|[^а-яёА-ЯЁ])(?:задача|задачи)\s+(T\d{2})\b/g, (_m, pre, id) => (names[id] ? `${pre}задача «${names[id]}»` : `${pre}выбранная задача`))
    .replace(/\b(TPL-[A-Z0-9]+-[A-Z0-9-]+)\b/g, (_, id) => (names[id] ? `«${names[id]}»` : "шаблон урока"))
    .replace(/\b([A-Z]{3}\d{2}-TASK-\d+)\b/g, (_, id) => (names[id] ? `«${names[id]}»` : "упражнение урока"))
    .replace(/обязательный урок (SAF-\d{2})/g, "обязательный урок модуля безопасности")
    .replace(/ (урока|уроку|урок) (SAF|SAL|MAP|TRD|VAL)-\d{2}(-EX)?\b/g, " $1")
    .replace(/\b(SAF|SAL|MAP|TRD|VAL)-\d{2}\b/g, "урок")
    .replace(/\bSAFE-\d{2}\b/g, "правило безопасности")
    .replace(/ программы v3\b/g, " программы")
    .replace(/(^|[^A-Za-z0-9])T\d{2}(\s+—\s+|:\s+)/g, "$1")
    .replace(/\s?\(T\d{2}(?:,\s*T\d{2})*\)/g, "")
    .replace(/«(safety|apply|verify|measure|value|next_level)»/g, (_, p) => `«${PHASE_LABEL[p]}»`);
}

export function lessonNames(lesson: { content: { templates: { id: string; title: string }[]; exercises: { id: string; title: string }[] } }) {
  return Object.fromEntries([...lesson.content.templates, ...lesson.content.exercises].map((x) => [x.id, x.title]));
}

/** True if a string still shows a technical identifier to the user. */
export function hasTechnicalId(text: string): boolean {
  return /\b(T\d{2}|SAFE-\d{2}|TPL-[A-Z0-9-]+|[A-Z]{3}\d{2}-TASK-\d+|STEP-\d{2}|(SAF|SAL|MAP|TRD|VAL)-\d{2}(-EX)?)\b/.test(text);
}
