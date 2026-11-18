// AI Career 3.0 — contracts for the next components (#45 task map, lesson selection, #46 30-step
// constructor, progress and artifacts, #47 measurements, profession onboarding).
// Types only, plus one implemented guard: assessPlanReadiness(), which decides whether the
// approved library can support a 30-step plan at all. It never produces steps itself.
import type { DiagnosticResultV3 } from "./diagnostic.ts";
import type { LibraryIndex, PlanStepCandidate, ProfessionId } from "./types.ts";

export const PLAN_STEPS_REQUIRED = 30;

// ---------- Personal task map (#45) ----------

export interface LessonRef { lessonId: string; version: string; exerciseId: string | null }

export interface TaskMapItem {
  taskId: string;
  decision: "ai_can_take_part" | "ai_assists" | "human_decides";
  /** Why: from the role matrix (modeMeaning / humanResponsibility), never generated. */
  why: string;
  conditions: string[];
  risks: string[];
  restrictions: string[];
  metricId: string;
  lessonRefs: LessonRef[];
}

export interface TaskMapV3 {
  modelVersion: "career-v3-task-map/1";
  professionId: ProfessionId;
  diagnosticResultId: string;
  programVersion: string;
  status: "ready" | "unavailable";
  unavailableReason?: "no_approved_lessons" | "no_tasks_selected";
  tasks: TaskMapItem[];
  strengths: { skillId: string; basis: string }[];
  growthSkills: { skillId: string; lessonRefs: LessonRef[] }[];
}

// ---------- Lesson selection ----------

export type SelectionReason =
  | "mandatory_module" | "selected_task" | "work_area" | "subtype_fit" | "level_fit"
  | "goal_fit" | "baseline_first" | "safe_variant";

export interface LessonSelectionItem {
  lessonId: string;
  version: string;
  slotId: string;
  moduleId: string;
  mandatory: boolean;
  variant: "synthetic_practice" | "approved_tools_public_data" | "manual_without_ai";
  reasons: SelectionReason[];
}

export interface LessonSelectionV3 {
  modelVersion: "career-v3-lesson-selection/1";
  professionId: ProfessionId;
  programVersion: string;
  status: "ready" | "unavailable";
  items: LessonSelectionItem[];
  coverageGaps: string[];
}

// ---------- 30-step constructor (#46) ----------

export type PlanPhase = "safety" | "apply" | "verify" | "measure" | "value" | "next_level";

export interface PlanStepV3 extends PlanStepCandidate {
  phase: PlanPhase;
  lessonVersion: string;
  personalization: SelectionReason[];
  restrictions: string[];
}

export type PlanV3 =
  | {
    modelVersion: "career-v3-plan/1";
    status: "ready";
    professionId: ProfessionId;
    programVersion: string;
    diagnosticResultId: string;
    steps: PlanStepV3[]; // exactly PLAN_STEPS_REQUIRED, each pointing to a delivered lesson/exercise/template
  }
  | {
    modelVersion: "career-v3-plan/1";
    status: "unavailable";
    professionId: ProfessionId;
    programVersion: string;
    readiness: PlanReadiness;
    steps: []; // never filled with placeholders
  };

// ---------- Progress and learning artifacts ----------

export type StepState = "not_started" | "in_progress" | "self_checked" | "done";

/** Pilot artifacts are checklists against the lesson's success criteria — no free text of real data. */
export interface LearningArtifact {
  kind: "criteria_checklist";
  lessonId: string;
  exerciseId: string;
  criteriaMet: boolean[];
  syntheticOnly: true;
}

export interface ProgressRecord {
  planStepId: string;
  lessonId: string;
  exerciseId: string;
  state: StepState;
  artifact: LearningArtifact | null;
  updatedAt: string;
}

// ---------- Measurements "было → стало" (#47) ----------

export interface MeasurementPoint {
  value: number;
  unit: "minutes" | "count" | "percent" | "fields";
  measuredOn: string;
  sampleSize: number;
  enteredBy: "user";
}

export interface MeasurementV3 {
  metricId: string;
  method: string;
  baseline: MeasurementPoint | null;
  after: MeasurementPoint | null;
  reviewMinutes: number | null;
  errorsFound: number | null;
  isTrainingData: boolean;
  /** The product never attributes revenue/conversion change to AI. */
  attribution: "not_claimed";
  caveats: string[];
}

// ---------- API contract (sandbox-only route /api/career/v3/...) ----------

export interface CareerV3Api {
  "GET library": { response: ReturnType<typeof import("./library.ts").learnerCatalog> };
  "GET diagnostic/questions": { response: ReturnType<typeof import("./diagnostic.ts").questionnaire> };
  "POST diagnostic/task-options": { body: { answers: Record<string, string | string[]> }; response: { options: { value: string; label: string }[] } };
  "POST diagnostic": { body: { answers: Record<string, string | string[]> }; response: { result: DiagnosticResultV3; savedAt: string } };
  "GET diagnostic": { response: { result: DiagnosticResultV3 | null } };
  "GET plan/readiness": { response: PlanReadiness };
}

// ---------- Plan readiness guard (implemented) ----------

export type PlanReadiness =
  | {
    status: "unavailable";
    reason: "no_approved_lessons" | "content_errors" | "mandatory_module_missing" | "insufficient_steps" | "scenario_not_covered";
    requiredSteps: number;
    eligibleSteps: number;
    gaps: string[];
    message: string;
  }
  | { status: "ready_for_construction"; requiredSteps: number; eligibleSteps: number; candidateStepIds: string[] };

export function assessPlanReadiness(library: LibraryIndex, result: DiagnosticResultV3): PlanReadiness {
  const unavailable = (reason: Extract<PlanReadiness, { status: "unavailable" }>["reason"], gaps: string[], eligible = 0, message?: string): PlanReadiness => ({
    status: "unavailable", reason, requiredSteps: PLAN_STEPS_REQUIRED, eligibleSteps: eligible, gaps,
    message: message ?? "Персональный план из 30 шагов не строится: в утверждённой библиотеке недостаточно материалов. Пустые или вымышленные шаги не выдаются.",
  });
  if (library.professionId !== result.professionId) return unavailable("content_errors", ["profession mismatch"]);
  if (library.availability.status !== "available") return unavailable(library.availability.reason, [], 0, library.availability.message);

  const delivered = new Map(library.published.map((l) => [l.id, l]));
  const gaps: string[] = [];
  for (const slot of result.safety.mandatorySlots) {
    if (!library.slots.find((s) => s.id === slot)?.deliverableLessonId) gaps.push(`mandatory slot ${slot} has no approved lesson`);
  }
  if (gaps.length) return unavailable("mandatory_module_missing", gaps);

  const fits = (lessonId: string) => {
    const l = delivered.get(lessonId);
    return !!l && l.subtypeIds.includes(result.profile.subtype) && l.levels.includes(result.profile.level);
  };
  const eligible = library.planCandidates.filter((s) => fits(s.lessonId));
  const covered = new Set(library.published.filter((l) => fits(l.id)).map((l) => l.scenarioId).filter(Boolean));
  const wanted = result.tasks.selected.map((t) => t.scenarioId);
  const uncovered = [...new Set(wanted)].filter((s) => !covered.has(s));
  if (wanted.length && uncovered.length === new Set(wanted).size) {
    return unavailable("scenario_not_covered", uncovered.map((s) => `scenario ${s} has no approved lesson for this profile`), eligible.length);
  }
  const unique = new Set(eligible.map((s) => `${s.lessonId}/${s.exerciseId}/${s.stepId}`));
  if (unique.size < PLAN_STEPS_REQUIRED) {
    return unavailable("insufficient_steps", [`${unique.size} of ${PLAN_STEPS_REQUIRED} approved step candidates fit this profile`], unique.size);
  }
  return { status: "ready_for_construction", requiredSteps: PLAN_STEPS_REQUIRED, eligibleSteps: unique.size, candidateStepIds: eligible.map((s) => `${s.lessonId}/${s.stepId}`) };
}
