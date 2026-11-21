// Lesson selection: chooses delivered lessons (buildLibrary) for one diagnostic result.
// Safety constraints are applied before any personal preference and can only remove material.
import type { DiagnosticResultV3 } from "./diagnostic.ts";
import type { LessonSelectionItem, LessonSelectionV3, SelectionReason } from "./contracts.ts";
import type { LibraryIndex, PlanStepCandidate, PublishedLesson } from "./types.ts";
import { resultOutdatedReasons, type EngineContext } from "./engine.ts";

export const SELECTION_MODEL = "career-v3-lesson-selection/1";

export function practiceVariant(result: DiagnosticResultV3): LessonSelectionItem["variant"] {
  if (result.company.aiProhibited || !result.company.toolsAvailable) return "manual_without_ai";
  if (result.safety.mode === "approved_tools_public_data") return "approved_tools_public_data";
  return "synthetic_practice";
}

const templateKind = (l: PublishedLesson, templateId: string) => l.document.content.templates.find((t) => t.id === templateId)?.kind ?? "unknown";

/** Step candidates of a lesson that are allowed for the practice variant. Prompts are never used without AI. */
export function allowedCandidates(library: LibraryIndex, lesson: PublishedLesson, variant: LessonSelectionItem["variant"]): PlanStepCandidate[] {
  return library.planCandidates.filter((c) => c.lessonId === lesson.id && (variant !== "manual_without_ai" || templateKind(lesson, c.templateId) !== "prompt"));
}

function unavailable(ctx: EngineContext, library: LibraryIndex, reason: NonNullable<LessonSelectionV3["unavailableReason"]>, gaps: string[], result: DiagnosticResultV3): LessonSelectionV3 {
  return { modelVersion: SELECTION_MODEL, professionId: ctx.professionId, programVersion: library.programVersion, status: "unavailable",
    unavailableReason: reason, variant: practiceVariant(result), items: [], excluded: [], coverageGaps: gaps };
}

export function selectLessons(ctx: EngineContext, result: DiagnosticResultV3, library: LibraryIndex): LessonSelectionV3 {
  const outdated = resultOutdatedReasons(ctx, result);
  if (outdated.length) return unavailable(ctx, library, "diagnostic_outdated", outdated, result);
  if (library.professionId !== ctx.professionId) return unavailable(ctx, library, "content_errors", ["profession mismatch"], result);
  if (library.availability.status !== "available") return unavailable(ctx, library, library.availability.reason, [library.availability.message], result);

  const variant = practiceVariant(result);
  const bySlot = new Map(library.published.map((l) => [l.slotId, l]));
  const selectedTasks = new Set(result.tasks.selected.map((t) => t.taskId));
  const shortlist = new Set(result.tasks.shortlist);
  const goalModules = new Set(result.learning.goals.flatMap((g) => ctx.engine.goalModuleMap[g] ?? []));
  const mandatoryModule = ctx.binding.mandatoryModuleId;
  const excluded: LessonSelectionV3["excluded"] = [];

  // 1. Hard filters: profile fit, practice variant, a verifiable exercise and at least one step candidate.
  const eligible = new Map<string, PublishedLesson>();
  for (const l of library.published) {
    const subtypes = [result.profile.subtype, ...result.profile.secondarySubtypes];
    if (!l.subtypeIds.some((s) => subtypes.includes(s))) { excluded.push({ lessonId: l.id, reason: "subtype_mismatch" }); continue; }
    if (!l.levels.includes(result.profile.level)) { excluded.push({ lessonId: l.id, reason: "level_mismatch" }); continue; }
    const exercisesOk = l.document.content.exercises.every((x) => {
      const ex = x as unknown as { expectedArtifact?: string; successCriteria?: string[] };
      return !!ex.expectedArtifact && (ex.successCriteria?.length ?? 0) > 0;
    });
    if (!exercisesOk) { excluded.push({ lessonId: l.id, reason: "no_verifiable_result" }); continue; }
    if (allowedCandidates(library, l, variant).length === 0) {
      excluded.push({ lessonId: l.id, reason: variant === "manual_without_ai" ? "no_manual_variant" : "no_step_candidates" });
      continue;
    }
    eligible.set(l.id, l);
  }

  // 2. Mandatory module (safety): every slot must be present and usable for this profile.
  const gaps: string[] = [];
  for (const slot of ctx.curriculum.slots.filter((s) => s.moduleId === mandatoryModule)) {
    const l = bySlot.get(slot.id);
    if (!l) gaps.push(`обязательный урок ${slot.id} не утверждён`);
    else if (!eligible.has(l.id)) gaps.push(`обязательный урок ${slot.id} недоступен для профиля: ${excluded.find((x) => x.lessonId === l.id)?.reason}`);
  }
  if (gaps.length) return { ...unavailable(ctx, library, "mandatory_module_missing", gaps, result), excluded };

  // 3. Relevance and scoring (personalisation inside the safe set).
  const items = new Map<string, LessonSelectionItem>();
  for (const l of eligible.values()) {
    const reasons = new Set<SelectionReason>();
    let score = 0;
    const mandatory = l.moduleId === mandatoryModule;
    if (mandatory) { reasons.add("mandatory_module"); score += 100; }
    const taskHits = l.taskIds.filter((t) => selectedTasks.has(t)).length;
    if (taskHits) { reasons.add("selected_task"); score += 30 * taskHits; }
    const scenarioIdx = l.scenarioId ? result.scenarios.indexOf(l.scenarioId) : -1;
    if (scenarioIdx >= 0) { reasons.add("scenario"); score += Math.max(4, 16 - 3 * scenarioIdx); }
    if (l.taskIds.some((t) => shortlist.has(t))) { reasons.add("work_area"); score += 8; }
    if (goalModules.has(l.moduleId)) { reasons.add("goal_fit"); score += 10; }
    const hasMeasure = l.document.content.templates.some((t) => t.kind === "measurement_sheet");
    if (result.measurement.baselineRequired && l.moduleId === "value" && hasMeasure) { reasons.add("baseline_first"); score += 12; }
    if (l.subtypeIds.includes(result.profile.subtype)) { reasons.add("subtype_fit"); score += 5; }
    reasons.add("level_fit");
    if (variant !== "approved_tools_public_data") reasons.add("safe_variant");
    // Practice lessons must relate to the person's work; others (mapping, trends, value) are shared modules.
    const relevant = mandatory || l.moduleId !== "practice" || reasons.has("selected_task") || reasons.has("scenario") || reasons.has("work_area");
    if (!relevant) { excluded.push({ lessonId: l.id, reason: "not_relevant_to_selected_work" }); continue; }
    items.set(l.id, { lessonId: l.id, version: l.version, slotId: l.slotId, moduleId: l.moduleId, mandatory, variant, reasons: [...reasons], score });
  }

  // 4. Prerequisites: a lesson stays only if all its prerequisite slots are selectable for this profile.
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of [...items.values()]) {
      const l = eligible.get(item.lessonId)!;
      for (const slot of l.document.prerequisites) {
        const pre = bySlot.get(slot);
        if (!pre || !eligible.has(pre.id)) {
          items.delete(item.lessonId); excluded.push({ lessonId: item.lessonId, reason: `prerequisite_${slot}_unavailable` }); changed = true; break;
        }
        if (!items.has(pre.id)) {
          items.set(pre.id, { lessonId: pre.id, version: pre.version, slotId: pre.slotId, moduleId: pre.moduleId, mandatory: pre.moduleId === mandatoryModule,
            variant, reasons: ["prerequisite", "level_fit"], score: item.score - 1 });
          changed = true;
        } else if (!items.get(pre.id)!.reasons.includes("prerequisite")) items.get(pre.id)!.reasons.push("prerequisite");
      }
    }
  }

  const list = [...items.values()].sort((a, b) => b.score - a.score || a.lessonId.localeCompare(b.lessonId));
  const coverage: string[] = [];
  const coveredScenarios = new Set(list.map((i) => eligible.get(i.lessonId)!.scenarioId).filter(Boolean));
  for (const s of new Set(result.tasks.selected.map((t) => t.scenarioId))) if (!coveredScenarios.has(s)) coverage.push(`сценарий ${s}: нет утверждённого урока для профиля`);
  const practice = list.filter((i) => i.moduleId === "practice");
  if (practice.length === 0) return { ...unavailable(ctx, library, "nothing_fits_profile", ["нет практических уроков для выбранных задач и профиля", ...coverage], result), excluded };
  return { modelVersion: SELECTION_MODEL, professionId: ctx.professionId, programVersion: library.programVersion, status: "ready",
    unavailableReason: null, variant, items: list, excluded, coverageGaps: coverage };
}
