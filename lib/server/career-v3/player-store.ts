// Lesson player on the server: the script is used only for a lesson the library actually delivers to this
// learner (so review lessons never reach the normal product), only for the exact lesson version it was
// written for, and the saved screen is restored only for the same script, lesson version and exercise.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CareerError } from "../career/config.ts";
import { careerPool } from "../career/db.ts";
import { loadProfessionBundle } from "./content.ts";
import { learnerLesson } from "./lessons-view.ts";
import { readV3Progress, requireV3Access } from "./store.ts";
import {
  assemblePlayer, CATEGORIES, categoryOf, categoryTitle, practiceFor, validatePlayerScript, type PlayerLesson, type PlayerScript,
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

interface Ctx { exerciseId: string | null; stableId: string | null; position: number | null; inRoute: boolean; quizPassed: boolean }

async function routeContext(accountId: string, professionId: string, lessonId: string, stepPosition: number | null): Promise<Ctx> {
  const pr = await readV3Progress(accountId, professionId).catch(() => null);
  const active = pr && "planVersionId" in pr && !pr.stale ? pr : null;
  const steps = active?.steps ?? [];
  const inRoute = !!steps.some((s) => s.lessonId === lessonId);
  const quizPassed = !!active?.quizzes?.[lessonId]?.passed;
  if (stepPosition === null || !active) return { exerciseId: null, stableId: null, position: null, inRoute, quizPassed };
  const step = steps.find((s) => s.position === stepPosition);
  if (!step || step.lessonId !== lessonId) throw new CareerError(404, "Этот шаг относится к другому уроку");
  return { exerciseId: step.exerciseId, stableId: step.stableId, position: step.position, inRoute, quizPassed };
}

export async function readPlayer(accountId: string, professionId: string, lessonId: string, stepPosition: number | null) {
  await requireV3Access(accountId);
  const { lesson } = learnerLesson(professionId, lessonId); // 404 unless the library delivers this lesson
  const doc = lesson as unknown as PlayerLesson;
  const script = usableScript(doc);
  if (!script) throw new CareerError(404, "Для этого урока пока есть только полная версия");
  const ctx = await routeContext(accountId, professionId, lessonId, stepPosition);
  const next = script.skill.nextLessonId;
  let nextLesson: { id: string; title: string } | null = null;
  if (next) try { nextLesson = { id: next, title: learnerLesson(professionId, next).lesson.title }; } catch { nextLesson = null; }
  const { screens, exerciseId } = assemblePlayer(script, doc, { exerciseId: ctx.exerciseId, nextLesson });
  const saved = (await careerPool().query("SELECT * FROM career_v3_player_positions WHERE account_id=$1 AND lesson_id=$2", [accountId, lessonId])).rows[0];
  const same = saved && saved.script_version === script.scriptVersion && saved.lesson_version === doc.version && saved.exercise_id === exerciseId && saved.screens === screens.length;
  return {
    lesson: { id: doc.id, title: doc.title, shortTitle: script.shortTitle, category: categoryTitle(categoryOf(doc.id, doc.moduleId)), version: doc.version },
    scriptVersion: script.scriptVersion, exerciseId, screens,
    position: same ? saved.screen : 0,
    restarted: !!saved && !same, // the lesson or its script changed since the learner's last visit
    completedAt: same && saved.completed_at ? new Date(saved.completed_at).toISOString() : null,
    step: ctx.position === null ? null : { position: ctx.position, stableId: ctx.stableId, exerciseMatches: ctx.exerciseId === exerciseId },
    inRoute: ctx.inRoute, quizPassed: ctx.quizPassed,
  };
}

export async function savePlayerPosition(accountId: string, professionId: string, lessonId: string, body: Record<string, unknown>) {
  await requireV3Access(accountId);
  const { lesson } = learnerLesson(professionId, lessonId);
  const doc = lesson as unknown as PlayerLesson;
  const script = usableScript(doc);
  if (!script) throw new CareerError(404, "Для этого урока пока есть только полная версия");
  const { scriptVersion, exerciseId, screen } = body;
  if (scriptVersion !== script.scriptVersion) throw new CareerError(409, "Урок обновился — откройте его заново");
  if (typeof exerciseId !== "string" || practiceFor(script, exerciseId) !== exerciseId) throw new CareerError(400, "Неверное задание");
  const total = assemblePlayer(script, doc, { exerciseId }).screens.length;
  if (!Number.isInteger(screen) || (screen as number) < 0 || (screen as number) >= total) throw new CareerError(400, "Неверный номер экрана");
  const done = screen === total - 1;
  await careerPool().query(
    `INSERT INTO career_v3_player_positions(account_id,lesson_id,lesson_version,script_version,exercise_id,screen,screens,completed_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $8 THEN now() END)
     ON CONFLICT(account_id,lesson_id) DO UPDATE SET lesson_version=EXCLUDED.lesson_version, script_version=EXCLUDED.script_version,
       exercise_id=EXCLUDED.exercise_id, screen=EXCLUDED.screen, screens=EXCLUDED.screens, updated_at=now(),
       completed_at=CASE WHEN $8 THEN coalesce(career_v3_player_positions.completed_at, now())
                         WHEN career_v3_player_positions.script_version=EXCLUDED.script_version AND career_v3_player_positions.lesson_version=EXCLUDED.lesson_version
                         THEN career_v3_player_positions.completed_at END`,
    [accountId, lessonId, doc.version, script.scriptVersion, exerciseId, screen, total, done]);
  return { screen, screens: total, completed: done };
}
