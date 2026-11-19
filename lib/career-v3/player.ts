// AI Career 3.0 — lesson player: short screens built from an editorial script + the lesson's own exercises,
// criteria, sample solutions and quiz (taken unchanged from the lesson document). Scripts live in
// content/career/v3/player/{lessonId}.json, separate from the lesson files, so lesson versions, plans and
// progress are not touched. A script is bound to one lesson version: if the lesson changes, the script is
// ignored and the full lesson view is used until the script is updated.

/** The fields of a lesson document the player uses (full shape of the content/career/v3 lesson files). */
export interface PlayerLesson {
  id: string;
  version: string;
  title: string;
  moduleId: string;
  content: {
    exercises: { id: string; title: string; syntheticInput: string; instructions: string[]; expectedArtifact: string; successCriteria: string[]; sampleSolution: string; feedbackIfIncorrect: string }[];
    quiz: { id: string; question: string; options: { id: string; text: string }[]; correctId: string; reason: string }[];
  };
}

export const PLAYER_SCHEMA = "career-v3-lesson-player/1";
export type TextKind = "why" | "idea" | "how" | "example" | "formula";

export interface ScriptScreen {
  kind: TextKind;
  title: string;
  text?: string[];
  list?: string[];
  quote?: string;
  formula?: string[];
  bad?: string;
  good?: string;
}
export interface PracticeScript {
  task: { title: string; text: string[]; inputLabel: string };
  actions: { title: string; text: string[] }[];
  review: { title: string; text: string[] };
}
export interface PlayerScript {
  schema: string;
  lessonId: string;
  lessonVersion: string;
  scriptVersion: string;
  status: "review" | "approved";
  /** Short lesson name for the player header (the full title stays in the lesson materials). */
  shortTitle: string;
  skill: { title: string; applyAt: string; employerValue: string; nextLessonId: string | null };
  theory: ScriptScreen[];
  practice: Record<string, PracticeScript>;
  /** Shorter display wording of long answer options (same meaning). Grading uses option ids only; the original
   *  wording stays one tap away on the quiz screen. */
  quizDisplay?: Record<string, Record<string, string>>;
}

/** What the learner sees, screen by screen. Exercise data, criteria and quiz come from the lesson document. */
export type PlayerScreen =
  | ({ type: "text" } & ScriptScreen)
  | { type: "task"; title: string; text: string[]; inputLabel: string; input: string; artifact: string }
  | { type: "action"; title: string; text: string[]; step: number; of: number }
  | { type: "criterion"; index: number; of: number; text: string; intro: string[] }
  | { type: "summary"; title: string; text: string[]; criteria: string[]; sample: string; feedback: string }
  | { type: "quiz"; index: number; of: number; id: string; question: string; options: { id: string; text: string; full?: string }[]; correctId: string; reason: string }
  | { type: "result"; skill: Omit<PlayerScript["skill"], "nextLessonId">; nextLesson: { id: string; title: string } | null };

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
export const screenWords = (s: ScriptScreen | { title: string; text?: string[] }) =>
  words([s.title, ...(s.text ?? []), ...((s as ScriptScreen).list ?? []), (s as ScriptScreen).quote ?? "", ...((s as ScriptScreen).formula ?? []), (s as ScriptScreen).bad ?? "", (s as ScriptScreen).good ?? ""].join(" "));
/** Internal identifiers that must never be shown to a learner. */
export const TECH_ID = /\b(?:[A-Z]{3}\d{2}-(?:TASK|EX|P|Q)-?\d+|TPL-[A-Z0-9-]+|STEP-\d{2}|[A-Z]{3}-\d{2}(?:-EX)?)\b/;

/** Editorial and safety checks. Empty list = the script may be used with this lesson document. */
export function validatePlayerScript(s: PlayerScript, lesson: PlayerLesson): string[] {
  const issues: string[] = [];
  if (s.schema !== PLAYER_SCHEMA) issues.push("schema");
  if (s.lessonId !== lesson.id) issues.push("lessonId");
  if (s.lessonVersion !== lesson.version) issues.push(`lesson version ${lesson.version} ≠ script ${s.lessonVersion}`);
  if (!/^\d+$/.test(s.scriptVersion)) issues.push("scriptVersion");
  if (!s.shortTitle || s.shortTitle.length > 50) issues.push("shortTitle: 1–50 characters");
  if (!s.theory.length) issues.push("no theory screens");
  if (s.theory[0]?.kind !== "why") issues.push("first screen must explain why the skill matters");
  for (const [i, sc] of s.theory.entries()) {
    const n = screenWords(sc);
    if (n < 25 || n > 75) issues.push(`theory screen ${i + 1}: ${n} words (25–75)`);
    if (TECH_ID.test(JSON.stringify(sc))) issues.push(`theory screen ${i + 1}: technical id`);
  }
  const exercises = new Map(lesson.content.exercises.map((e) => [e.id, e]));
  if (!Object.keys(s.practice).length) issues.push("no practice");
  for (const [id, p] of Object.entries(s.practice)) {
    const ex = exercises.get(id);
    if (!ex) { issues.push(`practice ${id}: no such exercise`); continue; }
    if (p.actions.length !== ex.instructions.length) issues.push(`practice ${id}: ${p.actions.length} actions for ${ex.instructions.length} instructions`);
    for (const sc of [p.task, ...p.actions, p.review]) {
      if (screenWords(sc) > 75) issues.push(`practice ${id}: "${sc.title}" over 75 words`);
      if (TECH_ID.test(JSON.stringify(sc))) issues.push(`practice ${id}: technical id in "${sc.title}"`);
    }
  }
  for (const [qid, opts] of Object.entries(s.quizDisplay ?? {})) {
    const q = lesson.content.quiz.find((x) => x.id === qid);
    if (!q) { issues.push(`quizDisplay ${qid}: no such question`); continue; }
    for (const [oid, text] of Object.entries(opts)) {
      const o = q.options.find((x) => x.id === oid);
      if (!o) issues.push(`quizDisplay ${qid}/${oid}: no such option`);
      else if (!text.trim() || words(text) >= words(o.text)) issues.push(`quizDisplay ${qid}/${oid}: must be shorter than the original`);
    }
  }
  if (!s.skill.title || !s.skill.applyAt || !s.skill.employerValue) issues.push("skill");
  if (/гарантир|увольнен|повышени\S* (зарплат|доход)/i.test(JSON.stringify(s))) issues.push("career promises / fear wording");
  return issues;
}

/** Practice used in this context: the step's own exercise when it has a script, otherwise the first scripted one. */
export function practiceFor(s: PlayerScript, exerciseId?: string | null): string {
  if (exerciseId && s.practice[exerciseId]) return exerciseId;
  return Object.keys(s.practice)[0];
}

/** Index of the first self-check screen. Theory, task and actions before it are stable across script versions,
 *  so a learner's position there survives a script update (screens after it are re-entered from the self-check). */
export const stablePrefix = (screens: PlayerScreen[]) => screens.findIndex((x) => x.type === "criterion");

export function assemblePlayer(s: PlayerScript, lesson: PlayerLesson, opts: { exerciseId?: string | null; nextLesson?: { id: string; title: string } | null } = {}): { screens: PlayerScreen[]; exerciseId: string } {
  const exerciseId = practiceFor(s, opts.exerciseId);
  const ex = lesson.content.exercises.find((e) => e.id === exerciseId)!;
  const p = s.practice[exerciseId];
  const quiz = lesson.content.quiz;
  const screens: PlayerScreen[] = [
    ...s.theory.map((t) => ({ type: "text" as const, ...t })),
    { type: "task", ...p.task, input: ex.syntheticInput, artifact: ex.expectedArtifact },
    ...p.actions.map((a, i) => ({ type: "action" as const, ...a, step: i + 1, of: p.actions.length })),
    // Self-check: one criterion per screen, then a summary with the sample solution.
    ...ex.successCriteria.map((c, i) => ({ type: "criterion" as const, index: i, of: ex.successCriteria.length, text: c, intro: i === 0 ? p.review.text : [] })),
    { type: "summary", title: "Итог самопроверки", text: [], criteria: [...ex.successCriteria], sample: ex.sampleSolution, feedback: ex.feedbackIfIncorrect },
    ...quiz.map((q, i) => ({
      type: "quiz" as const, index: i, of: quiz.length, id: q.id, question: q.question, correctId: q.correctId, reason: q.reason,
      options: q.options.map((o) => {
        const short = s.quizDisplay?.[q.id]?.[o.id];
        return short ? { id: o.id, text: short, full: o.text } : { id: o.id, text: o.text };
      }),
    })),
    // The result screen shows a confirmed skill only when the server has counted the mini-test (see player-store).
    { type: "result", skill: { title: s.skill.title, applyAt: s.skill.applyAt, employerValue: s.skill.employerValue }, nextLesson: opts.nextLesson ?? null },
  ];
  return { screens, exerciseId };
}

/** Learner-facing categories. Mapping by module, with explicit lesson overrides; empty categories are «future». */
export const CATEGORIES = [
  { id: "safety", title: "Безопасность", modules: ["safety"], lessons: [] as string[] },
  { id: "prompting", title: "Архитектор запросов", modules: [], lessons: [] },
  { id: "profession", title: "ИИ в моей профессии", modules: ["practice", "task_mapping"], lessons: [] },
  { id: "automation", title: "Автоматизация работы", modules: [], lessons: ["MAP-02"] },
  { id: "value", title: "Моя ценность для компании", modules: ["value"], lessons: [] },
  { id: "career", title: "Карьера в эпоху ИИ", modules: ["trends"], lessons: [] },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function categoryOf(lessonId: string, moduleId: string): CategoryId {
  const byLesson = CATEGORIES.find((c) => (c.lessons as readonly string[]).includes(lessonId));
  if (byLesson) return byLesson.id;
  return (CATEGORIES.find((c) => (c.modules as readonly string[]).includes(moduleId)) ?? CATEGORIES[2]).id;
}
export const categoryTitle = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!.title;
