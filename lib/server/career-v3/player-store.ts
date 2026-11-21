// Lesson player on the server: the script is used only for a lesson the library actually delivers to this
// learner (so review lessons never reach the normal product), only for the exact lesson version it was
// written for. The RESULT of a lesson is decided here, never by the fact that all screens were viewed:
//  - in the route, the mini-test counts through the existing route endpoint (submitV3Quiz) and step completion
//    keeps the existing server rules (deriveState / canComplete);
//  - outside the route, the mini-test is graded here (gradeQuiz) and the pass time is stored with the position.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CareerError } from "../career/config.ts";
import { careerPool } from "../career/db.ts";
import { loadProfessionBundle } from "./content.ts";
import { learnerLesson } from "./lessons-view.ts";
import { readV3Progress, requireV3Access, submitV3Quiz } from "./store.ts";
import { gradeQuiz, type QuizQuestion } from "../../career-v3/progress.ts";
import {
  assemblePlayer, CATEGORIES, categoryOf, categoryTitle, practiceFor, stablePrefix, validatePlayerScript, type PlayerLesson, type PlayerScript,
} from "../../career-v3/player.ts";

const LESSON_ID = /^[A-Z]{2,5}-[0-9]{2,3}$/;
const DIR = "content/career/v3/player";

export function loadPlayerScript(lessonId: string): PlayerScript | null {
  if (!LESSON_ID.test(lessonId)) return null;
  const file = path.join(process.cwd(), DIR, `${lessonId}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as PlayerScript;
}

/** Script usable for this lesson document (same version, editorial checks pass), else null. */
export function usableScript(lesson: PlayerLesson): PlayerScript | null {
  const s = loadPlayerScript(lesson.id);
  return s && validatePlayerScript(s, lesson).length === 0 ? s : null;
}

/** Learner-facing catalogue: delivered lessons grouped by category; empty categories are marked as future. */
export function lessonCatalogue(professionId: string) {
  const b = loadProfessionBundle(professionId);
  const delivered = b.library.published.map((p) => {
    const { lesson } = learnerLesson(professionId, p.id);
    return { id: p.id, title: lesson.title, category: categoryOf(p.id, lesson.moduleId), player: !!usableScript(lesson as unknown as PlayerLesson) };
  });
  return CATEGORIES.map((c) => {
    const lessons = delivered.filter((l) => l.category === c.id);
    return { id: c.id, title: c.title, status: lessons.length ? ("ready" as const) : ("future" as const), lessons };
  });
}

type ActiveProgress = Extract<Awaited<ReturnType<typeof readV3Progress>>, { planVersionId: string }>;
async function activeRoute(accountId: string, professionId: string): Promise<ActiveProgress | null> {
  const pr = await readV3Progress(accountId, professionId).catch(() => null);
  return pr && "planVersionId" in pr && !pr.stale ? (pr as ActiveProgress) : null;
}

function lessonAndScript(professionId: string, lessonId: string) {
  const { lesson } = learnerLesson(professionId, lessonId); // 404 unless the library delivers this lesson
  const doc = lesson as unknown as PlayerLesson;
  const script = usableScript(doc);
  if (!script) throw new CareerError(404, "Для этого урока пока есть только полная версия");
  return { doc, script };
}

/** Choices: quiz option ids, which questions were checked, criterion marks. Nothing else is accepted. */
interface Choices { q: Record<string, string>; checked: string[]; c: (boolean | null)[] }
function cleanChoices(raw: unknown, doc: PlayerLesson, exerciseId: string): Choices {
  const empty: Choices = { q: {}, checked: [], c: [] };
  if (raw === undefined) return empty;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CareerError(400, "Неверные отметки");
  const r = raw as Record<string, unknown>;
  if (Object.keys(r).some((k) => !["q", "checked", "c"].includes(k))) throw new CareerError(400, "Неверные отметки");
  const quiz = new Map(doc.content.quiz.map((q) => [q.id, new Set(q.options.map((o) => o.id))]));
  const criteria = doc.content.exercises.find((e) => e.id === exerciseId)!.successCriteria.length;
  const q = (r.q ?? {}) as Record<string, unknown>;
  if (typeof q !== "object" || Array.isArray(q) || Object.entries(q).some(([k, v]) => typeof v !== "string" || !quiz.get(k)?.has(v))) throw new CareerError(400, "Неверные отметки");
  const checked = (r.checked ?? []) as unknown[];
  if (!Array.isArray(checked) || checked.some((x) => typeof x !== "string" || !quiz.has(x))) throw new CareerError(400, "Неверные отметки");
  const c = (r.c ?? []) as unknown[];
  if (!Array.isArray(c) || c.length > criteria || c.some((x) => x !== null && typeof x !== "boolean")) throw new CareerError(400, "Неверные отметки");
  return { q: q as Record<string, string>, checked: [...new Set(checked as string[])], c: c as (boolean | null)[] };
}

export async function readPlayer(accountId: string, professionId: string, lessonId: string, stepPosition: number | null) {
  await requireV3Access(accountId);
  const { doc, script } = lessonAndScript(professionId, lessonId);
  const route = await activeRoute(accountId, professionId);
  const steps = route?.steps ?? [];
  const inRoute = steps.some((s) => s.lessonId === lessonId);
  let step: (typeof steps)[number] | null = null;
  if (stepPosition !== null) {
    step = steps.find((s) => s.position === stepPosition) ?? null;
    if (!step || step.lessonId !== lessonId) throw new CareerError(404, "Этот шаг относится к другому уроку");
  }
  const next = script.skill.nextLessonId;
  let nextLesson: { id: string; title: string } | null = null;
  if (next) try { nextLesson = { id: next, title: learnerLesson(professionId, next).lesson.title }; } catch { nextLesson = null; }
  const { screens, exerciseId } = assemblePlayer(script, doc, { exerciseId: step?.exerciseId ?? null, nextLesson });

  const saved = (await careerPool().query("SELECT * FROM career_v3_player_positions WHERE account_id=$1 AND lesson_id=$2", [accountId, lessonId])).rows[0];
  const sameLesson = !!saved && saved.lesson_version === doc.version && saved.exercise_id === exerciseId;
  const sameScript = sameLesson && saved.script_version === script.scriptVersion && saved.screens === screens.length;
  // A script update keeps the learner's place in theory and practice; later screens restart from the self-check.
  const position = sameScript ? saved.screen : sameLesson ? Math.min(saved.screen, stablePrefix(screens)) : 0;

  // Server-confirmed result.
  const routeQuiz = route?.quizzes?.[lessonId];
  const quizPassed = inRoute ? !!routeQuiz?.passed : sameLesson && !!saved.quiz_passed_at;
  const planStep = step ? route!.plan.steps.find((s) => s.position === step!.position)! : null;
  let nextStep: { position: number; lessonId: string; player: boolean } | null = null;
  if (step) {
    const n = route!.plan.steps.find((s) => s.position > step!.position && route!.steps[s.position - 1]?.state !== "done");
    if (n) {
      let player = false;
      try { player = !!usableScript(learnerLesson(professionId, n.lessonId).lesson as unknown as PlayerLesson); } catch { player = false; }
      nextStep = { position: n.position, lessonId: n.lessonId, player };
    }
  }
  // Rows saved before choices existed carry the column default {}: normalise every field.
  const raw = (sameLesson && saved.choices && typeof saved.choices === "object" ? saved.choices : {}) as Partial<Choices>;
  const choices: Choices = {
    q: raw.q && typeof raw.q === "object" && !Array.isArray(raw.q) ? { ...raw.q } : {},
    checked: Array.isArray(raw.checked) ? [...raw.checked] : [],
    c: Array.isArray(raw.c) ? [...raw.c] : [],
  };
  // Answers already counted in the route are shown as answered: the learner is not asked to redo them.
  if (inRoute && routeQuiz?.passed) {
    choices.q = { ...routeQuiz.answers, ...choices.q };
    choices.checked = [...new Set([...choices.checked, ...Object.keys(routeQuiz.answers ?? {})])];
  }
  if (step?.criteriaMet && !choices.c.length) choices.c = step.criteriaMet;

  return {
    lesson: { id: doc.id, title: doc.title, shortTitle: script.shortTitle, category: categoryTitle(categoryOf(doc.id, doc.moduleId)), version: doc.version },
    scriptVersion: script.scriptVersion, exerciseId, screens, position, choices,
    restarted: !!saved && !sameScript && position !== saved.screen,
    seq: sameLesson ? Number(saved.seq) : 0,
    result: {
      quizPassed, quizCountedIn: inRoute ? ("route" as const) : ("lesson" as const),
      completedAt: sameScript && saved.completed_at ? new Date(saved.completed_at).toISOString() : null,
    },
    step: step && planStep ? {
      position: step.position, stableId: step.stableId, exerciseMatches: step.exerciseId === exerciseId, state: step.state,
      criteriaMet: step.criteriaMet, completionCriteria: planStep.completionCriteria, completedAt: step.completedAt,
    } : null,
    nextStep, inRoute,
  };
}

export async function savePlayerPosition(accountId: string, professionId: string, lessonId: string, body: Record<string, unknown>) {
  await requireV3Access(accountId);
  const { doc, script } = lessonAndScript(professionId, lessonId);
  const { scriptVersion, exerciseId, screen, seq } = body;
  if (scriptVersion !== script.scriptVersion) throw new CareerError(409, "Урок обновился — откройте его заново");
  if (typeof exerciseId !== "string" || practiceFor(script, exerciseId) !== exerciseId) throw new CareerError(400, "Неверное задание");
  const total = assemblePlayer(script, doc, { exerciseId }).screens.length;
  if (!Number.isInteger(screen) || (screen as number) < 0 || (screen as number) >= total) throw new CareerError(400, "Неверный номер экрана");
  if (seq !== undefined && (!Number.isSafeInteger(seq) || (seq as number) < 0)) throw new CareerError(400, "Неверный порядок сохранения");
  const choices = cleanChoices(body.choices, doc, exerciseId);
  // «Completed» needs the last screen AND a mini-test counted on the server — viewing every screen is not enough.
  const route = await activeRoute(accountId, professionId);
  const inRoute = !!route?.steps.some((s) => s.lessonId === lessonId);
  const r = await careerPool().query(
    `INSERT INTO career_v3_player_positions(account_id,lesson_id,lesson_version,script_version,exercise_id,screen,screens,choices,seq)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
     ON CONFLICT(account_id,lesson_id) DO UPDATE SET lesson_version=EXCLUDED.lesson_version, script_version=EXCLUDED.script_version,
       exercise_id=EXCLUDED.exercise_id, screen=EXCLUDED.screen, screens=EXCLUDED.screens, choices=EXCLUDED.choices, seq=EXCLUDED.seq, updated_at=now(),
       quiz_passed_at=CASE WHEN career_v3_player_positions.lesson_version=EXCLUDED.lesson_version THEN career_v3_player_positions.quiz_passed_at END,
       completed_at=CASE WHEN career_v3_player_positions.lesson_version=EXCLUDED.lesson_version AND career_v3_player_positions.script_version=EXCLUDED.script_version
                         THEN career_v3_player_positions.completed_at END
     WHERE EXCLUDED.seq >= career_v3_player_positions.seq
     RETURNING screen, seq, quiz_passed_at`,
    [accountId, lessonId, doc.version, script.scriptVersion, exerciseId, screen, total, JSON.stringify(choices), seq ?? 0]);
  if (!r.rowCount) return { screen: null, stale: true }; // an older request arrived after a newer one: ignored
  const quizPassed = inRoute ? !!route?.quizzes?.[lessonId]?.passed : !!r.rows[0].quiz_passed_at;
  const completed = screen === total - 1 && quizPassed;
  if (completed) await careerPool().query("UPDATE career_v3_player_positions SET completed_at=coalesce(completed_at, now()) WHERE account_id=$1 AND lesson_id=$2", [accountId, lessonId]);
  return { screen, screens: total, completed, stale: false };
}

/** Mini-test from the player. In the route: the existing route endpoint (counts for the steps, same rules).
 *  Outside the route: graded here; a pass is stored with the learner's position. Never trusts the client. */
export async function submitPlayerQuiz(accountId: string, professionId: string, lessonId: string, body: Record<string, unknown>) {
  await requireV3Access(accountId);
  const { doc, script } = lessonAndScript(professionId, lessonId);
  const route = await activeRoute(accountId, professionId);
  if (route?.steps.some((s) => s.lessonId === lessonId)) {
    const r = await submitV3Quiz(accountId, professionId, lessonId, body.answers);
    return { passed: r.passed, correct: r.attempt.correct, total: r.attempt.total, countedIn: "route" as const, results: r.attempt.results };
  }
  const grade = gradeQuiz(doc.content.quiz as unknown as QuizQuestion[], body.answers);
  const exerciseId = practiceFor(script, typeof body.exerciseId === "string" ? body.exerciseId : null);
  const total = assemblePlayer(script, doc, { exerciseId }).screens.length;
  await careerPool().query(
    `INSERT INTO career_v3_player_positions(account_id,lesson_id,lesson_version,script_version,exercise_id,screen,screens,quiz_passed_at)
     VALUES($1,$2,$3,$4,$5,0,$6,CASE WHEN $7 THEN now() END)
     ON CONFLICT(account_id,lesson_id) DO UPDATE SET updated_at=now(),
       quiz_passed_at=CASE WHEN career_v3_player_positions.lesson_version<>EXCLUDED.lesson_version THEN EXCLUDED.quiz_passed_at
                           ELSE coalesce(career_v3_player_positions.quiz_passed_at, EXCLUDED.quiz_passed_at) END`,
    [accountId, lessonId, doc.version, script.scriptVersion, exerciseId, total, grade.passed]);
  const passedEver = (await careerPool().query("SELECT quiz_passed_at FROM career_v3_player_positions WHERE account_id=$1 AND lesson_id=$2", [accountId, lessonId])).rows[0]?.quiz_passed_at;
  return { passed: !!passedEver, correct: grade.correct, total: grade.total, countedIn: "lesson" as const, results: grade.results };
}
