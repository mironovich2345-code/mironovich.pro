// 30-step plan constructor (#46). Steps come only from approved plan-step candidates of selected,
// delivered lessons. No step is generated, paraphrased or padded: if there are not enough distinct
// admissible steps, the result is "unavailable" with the missing material listed.
import type { DiagnosticResultV3 } from "./diagnostic.ts";
import { PLAN_STEPS_REQUIRED, type LessonSelectionItem, type LessonSelectionV3, type PlanGap, type PlanStepV3, type PlanV3, type SelectionReason } from "./contracts.ts";
import type { LibraryIndex, PlanPhase, PlanStepCandidate, PublishedLesson } from "./types.ts";
import { currentVersions, metricRef, PHASES, resultOutdatedReasons, type EngineContext } from "./engine.ts";
import { allowedCandidates } from "./selection.ts";

export const PLAN_MODEL = "career-v3-plan/1";
export const MAX_STEPS_PER_LESSON = 4;
export const MAX_STEPS_PER_EXERCISE = 2;

const REASON_TEXT: Record<SelectionReason, string> = {
  mandatory_module: "обязательный модуль безопасности",
  prerequisite: "нужен для следующих уроков",
  selected_task: "связан с выбранной вами задачей",
  scenario: "сценарий вашей работы",
  work_area: "направление, с которым вы работаете",
  subtype_fit: "подходит вашей специализации",
  level_fit: "соответствует уровню подготовки",
  goal_fit: "поддерживает вашу цель развития",
  baseline_first: "сначала нужен исходный замер «было»",
  safe_variant: "безопасный вариант практики",
};
const VARIANT_RULE: Record<LessonSelectionItem["variant"], string> = {
  manual_without_ai: "ИИ не используется: выполните задание вручную по шаблону урока на вымышленных данных.",
  synthetic_practice: "Только вымышленные учебные данные; рабочие инструменты и данные работодателя не используются до подтверждения правил.",
  approved_tools_public_data: "Только разрешённые компанией инструменты и общедоступные или учебные данные; данные клиентов и внутренние условия не вводятся.",
};

interface PoolEntry { c: PlanStepCandidate; lesson: PublishedLesson; item: LessonSelectionItem; phase: PlanPhase; kind: string }

export function phaseTargets(result: DiagnosticResultV3): Record<PlanPhase, number> {
  const t: Record<PlanPhase, number> = { safety: 4, apply: 6, verify: 4, measure: 3, value: 3, next_level: 2 };
  if (result.profile.level === "starter") { t.safety += 2; t.apply += 2; t.verify += 1; t.value -= 1; t.next_level -= 1; }
  if (result.profile.level === "experienced") { t.verify += 1; t.measure += 1; t.value += 1; t.next_level += 1; }
  if (result.safety.effects.includes("human_review_required")) t.verify += 2;
  if (result.measurement.baselineRequired) t.measure += 1;
  for (const g of result.learning.goals) {
    if (g === "manager") t.value += 1;
    if (g === "grow") t.next_level += 1;
    if (g === "quality") t.verify += 1;
    if (g === "less_routine" || g === "customers") t.apply += 1;
  }
  return t;
}

function unavailable(ctx: EngineContext, today: string, reason: Extract<PlanV3, { status: "unavailable" }>["reason"], message: string, gaps: PlanGap[]): PlanV3 {
  return { modelVersion: PLAN_MODEL, status: "unavailable", professionId: ctx.professionId, builtOn: today, reason, message, gaps, steps: [] };
}

export function buildPlan(ctx: EngineContext, input: { result: DiagnosticResultV3; selection: LessonSelectionV3; library: LibraryIndex; today: string }): PlanV3 {
  const { result, selection, library, today } = input;
  const outdated = resultOutdatedReasons(ctx, result);
  if (outdated.length) return unavailable(ctx, today, "diagnostic_outdated", "Диагностика устарела: пройдите её заново, прежний план не используется.", []);
  if (selection.status !== "ready") {
    const reason = selection.unavailableReason ?? "nothing_fits_profile";
    return unavailable(ctx, today, reason, reason === "no_approved_lessons"
      ? "Утверждённых уроков пока нет: персональный план из 30 шагов не строится и не подменяется вымышленными шагами."
      : "Для этого профиля недостаточно утверждённых материалов: " + selection.coverageGaps.join("; "),
    selection.coverageGaps.map((g) => ({ phase: "total" as const, needed: 0, available: 0, missing: g })));
  }
  if (selection.programVersion !== library.programVersion) return unavailable(ctx, today, "content_errors", "Подбор уроков выполнен для другой версии программы.", []);

  // Pool of admissible, distinct candidates.
  const lessons = new Map(library.published.map((l) => [l.id, l]));
  const pool: PoolEntry[] = [];
  const seenKey = new Set<string>(), seenAction = new Set<string>();
  for (const item of selection.items) {
    const lesson = lessons.get(item.lessonId);
    if (!lesson || lesson.version !== item.version) return unavailable(ctx, today, "content_errors", "Урок из подбора больше не выдаётся.", []);
    for (const c of allowedCandidates(library, lesson, selection.variant).sort((a, b) => a.position - b.position)) {
      const kind = lesson.document.content.templates.find((t) => t.id === c.templateId)?.kind ?? "unknown";
      const key = `${c.lessonId}|${c.exerciseId}|${c.templateId}`;
      const action = c.action.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, " ").trim();
      if (seenKey.has(key) || seenAction.has(action)) continue; // the same exercise+template or the same action is never repeated
      const base = ctx.modulePhases[lesson.moduleId];
      const phase = base === "safety" || base === "next_level" ? base : (ctx.templateKindPhases[kind] ?? base);
      // One exercise appears at most once per phase: a prompt version and a manual version of the
      // same exercise are alternatives, not two steps (candidates are in the lesson's own order).
      const exercisePhase = `${c.lessonId}|${c.exerciseId}|${phase}`;
      if (seenKey.has(exercisePhase)) continue;
      seenKey.add(key); seenKey.add(exercisePhase); seenAction.add(action);
      pool.push({ c, lesson, item, phase, kind });
    }
  }

  const targets = phaseTargets(result);
  const picked: PoolEntry[] = [];
  const perLesson = new Map<string, number>(), perExercise = new Map<string, number>();
  const canTake = (p: PoolEntry) => !picked.includes(p) && (perLesson.get(p.lesson.id) ?? 0) < MAX_STEPS_PER_LESSON
    && (perExercise.get(p.lesson.id + "|" + p.c.exerciseId) ?? 0) < MAX_STEPS_PER_EXERCISE;
  const take = (p: PoolEntry) => {
    picked.push(p);
    perLesson.set(p.lesson.id, (perLesson.get(p.lesson.id) ?? 0) + 1);
    perExercise.set(p.lesson.id + "|" + p.c.exerciseId, (perExercise.get(p.lesson.id + "|" + p.c.exerciseId) ?? 0) + 1);
  };
  const rank = (a: PoolEntry, b: PoolEntry) => b.item.score - a.item.score || a.lesson.id.localeCompare(b.lesson.id) || a.c.position - b.c.position;

  // Every mandatory lesson appears at least once.
  for (const item of selection.items.filter((i) => i.mandatory)) {
    const first = pool.filter((p) => p.lesson.id === item.lessonId).sort(rank)[0];
    if (first && canTake(first)) take(first);
  }
  for (const phase of PHASES) {
    for (const p of pool.filter((x) => x.phase === phase).sort(rank)) {
      if (picked.filter((x) => x.phase === phase).length >= targets[phase] || picked.length >= PLAN_STEPS_REQUIRED) break;
      if (canTake(p)) take(p);
    }
  }
  for (const p of [...pool].sort(rank)) {
    if (picked.length >= PLAN_STEPS_REQUIRED) break;
    if (canTake(p)) take(p);
  }

  const gaps: PlanGap[] = [];
  for (const phase of PHASES) {
    const available = pool.filter((p) => p.phase === phase).length;
    if (available === 0) gaps.push({ phase, needed: targets[phase], available, missing: `нет утверждённых шагов этапа «${phase}» для этого профиля` });
  }
  if (picked.length < PLAN_STEPS_REQUIRED) gaps.push({ phase: "total", needed: PLAN_STEPS_REQUIRED, available: picked.length,
    missing: `доступно ${picked.length} различных допустимых шагов из ${PLAN_STEPS_REQUIRED} (с учётом лимитов: не больше ${MAX_STEPS_PER_LESSON} на урок и ${MAX_STEPS_PER_EXERCISE} на упражнение)` });
  if (gaps.length) {
    return unavailable(ctx, today, "insufficient_material",
      "Недостаточно содержательно разных утверждённых шагов: план не строится и не дополняется искусственно.", gaps);
  }

  // Order: phase sequence; inside a phase by relevance, keeping each lesson's own step order.
  const ordered: PoolEntry[] = [];
  for (const phase of PHASES) {
    const inPhase = picked.filter((p) => p.phase === phase);
    const lessonOrder = [...new Set(inPhase.sort(rank).map((p) => p.lesson.id))];
    for (const id of lessonOrder) ordered.push(...inPhase.filter((p) => p.lesson.id === id).sort((a, b) => a.c.position - b.c.position));
  }
  if (result.measurement.baselineRequired) {
    const preferred = ordered.findIndex((p) => p.phase === "measure" && p.item.reasons.includes("baseline_first"));
    const idx = preferred >= 0 ? preferred : ordered.findIndex((p) => p.phase === "measure");
    const afterSafety = ordered.findIndex((p) => p.phase !== "safety");
    if (idx > afterSafety && afterSafety >= 0) ordered.splice(afterSafety, 0, ...ordered.splice(idx, 1));
  }

  const perLessonInPlan = new Map<string, number>();
  for (const p of ordered) perLessonInPlan.set(p.lesson.id, (perLessonInPlan.get(p.lesson.id) ?? 0) + 1);
  const sessionMinutes = result.learning.sessionMinutes ?? 20;
  let session = 1, used = 0;
  const selectedTasks = result.tasks.selected;
  const steps: PlanStepV3[] = ordered.map((p, i) => {
    const minutes = Math.max(5, Math.ceil(p.lesson.durationMinutes / (perLessonInPlan.get(p.lesson.id) ?? 1)));
    if (used > 0 && used + minutes > sessionMinutes) { session += 1; used = 0; }
    used += minutes;
    const reasons = [...p.item.reasons] as SelectionReason[];
    if (result.measurement.baselineRequired && p.phase === "measure" && !reasons.includes("baseline_first")) reasons.push("baseline_first");
    const metric = metricRef(ctx, p.c.metricId);
    const restrictions = [VARIANT_RULE[selection.variant], p.c.safetyNote];
    for (const t of selectedTasks.filter((x) => p.lesson.taskIds.includes(x.taskId))) restrictions.push(...t.restrictions);
    if (metric?.kind === "workplace_outcome") restrictions.push("Рабочий показатель только наблюдается: изменение не приписывается обучению или ИИ.");
    return {
      ...p.c,
      stepId: "STEP-" + String(i + 1).padStart(2, "0"),
      position: i + 1,
      stableId: `${p.lesson.id}@${p.lesson.version}/${p.c.stepId}`,
      phase: p.phase,
      lessonVersion: p.lesson.version,
      lessonTitle: p.lesson.title,
      templateKind: p.kind,
      variant: selection.variant,
      metric,
      restrictions: [...new Set(restrictions)],
      why: { reasons, text: "Шаг выбран, потому что: " + reasons.map((r) => REASON_TEXT[r]).join("; ") + "." },
      estimatedMinutes: minutes,
      session,
      isCalendarDay: false,
    };
  });
  const v = currentVersions(ctx);
  const phaseCounts = Object.fromEntries(PHASES.map((ph) => [ph, steps.filter((s) => s.phase === ph).length])) as Record<PlanPhase, number>;
  return {
    modelVersion: PLAN_MODEL, status: "ready", professionId: ctx.professionId, builtOn: today,
    versions: { diagnostic: v.diagnostic, role: v.role, program: library.programVersion, library: library.librarySignature, resultModel: v.resultModel,
      lessons: Object.fromEntries([...new Set(steps.map((s) => s.lessonId))].map((id) => [id, lessons.get(id)!.version])) },
    variant: selection.variant, sessionMinutes, phaseCounts, steps,
  };
}

/** Reasons why a stored plan no longer matches current content (empty = up to date). */
export function planStaleReasons(plan: PlanV3, ctx: EngineContext, library: LibraryIndex): string[] {
  if (plan.status !== "ready") return [];
  const v = currentVersions(ctx);
  const r: string[] = [];
  if (plan.modelVersion !== PLAN_MODEL) r.push("plan_model_changed");
  if (plan.versions.diagnostic !== v.diagnostic) r.push("diagnostic_version_changed");
  if (plan.versions.role !== v.role) r.push("role_matrix_version_changed");
  if (plan.versions.resultModel !== v.resultModel) r.push("result_model_changed");
  if (plan.versions.program !== library.programVersion) r.push("program_version_changed");
  const delivered = new Map(library.published.map((l) => [l.id, l.version]));
  for (const [id, ver] of Object.entries(plan.versions.lessons)) {
    if (!delivered.has(id)) r.push(`lesson_withdrawn:${id}`);
    else if (delivered.get(id) !== ver) r.push(`lesson_version_changed:${id}`);
  }
  return r;
}
