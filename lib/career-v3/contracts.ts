// AI Career 3.0 — contracts: task map (#45, lib/career-v3/task-map.ts), lesson selection
// (selection.ts), 30-step plan (#46, plan.ts), progress/artifacts and measurements (#47, types only),
// plus assessPlanReadiness(), a quick guard that never produces steps itself.
import type { DiagnosticResultV3 } from "./diagnostic.ts";
import type { LibraryIndex, MetricKind, PlanPhase, PlanStepCandidate, ProfessionId } from "./types.ts";

export const PLAN_STEPS_REQUIRED = 30;

// ---------- Personal task map (#45) ----------

export interface LessonRef { lessonId: string; version: string; exerciseIds: string[]; title: string }

export interface MetricRef {
  metricId: string;
  label: string;
  method: string;
  caveat: string;
  kind: MetricKind;
  /** Training metrics are measured on the learner's artifacts; workplace outcomes are observed only. */
  attribution: "exercise_result" | "observed_not_attributed";
}

export interface TaskMapItem {
  taskId: string;
  title: string;
  explanation: string;
  decision: "ai_can_take_part" | "ai_assists" | "human_decides";
  decisionLabel: string;
  /** Basis comes from the role matrix (mode, modeMeaning, humanResponsibility) — never generated. */
  basis: { roleMode: string; modeMeaning: string; humanResponsibility: string; tightenedBySafety: boolean; safetyRules: string[] };
  companyRestrictions: string[];
  risks: string[];
  mandatoryChecks: string[];
  skill: { skillId: string; name: string; why: string } | null;
  metric: MetricRef | null;
  lessonRefs: LessonRef[];
}

export interface TaskMapV3 {
  modelVersion: "career-v3-task-map/1";
  professionId: ProfessionId;
  builtOn: string;
  versions: { diagnostic: string; role: string; program: string; library: string; resultModel: string };
  status: "ready" | "unavailable";
  unavailableReason: null | "no_tasks_selected";
  tasks: TaskMapItem[];
  fallback: null | { kind: "training_example"; message: string };
  strengths: { status: "evidenced" | "insufficient_evidence"; items: { id: string; label: string; skillId: string; evidence: string }[]; note: string };
  growthSkills: { skillId: string; name: string; why: string; reasons: string[]; lessonRefs: LessonRef[] }[];
  learningRoute: { status: "available" | "unavailable"; reason: string | null; message: string | null };
}

// ---------- Lesson selection ----------

export type SelectionReason =
  | "mandatory_module" | "prerequisite" | "selected_task" | "scenario" | "work_area" | "subtype_fit" | "level_fit"
  | "goal_fit" | "baseline_first" | "safe_variant";

export interface LessonSelectionItem {
  lessonId: string;
  version: string;
  slotId: string;
  moduleId: string;
  mandatory: boolean;
  variant: "synthetic_practice" | "approved_tools_public_data" | "manual_without_ai";
  reasons: SelectionReason[];
  score: number;
}

export interface LessonSelectionV3 {
  modelVersion: "career-v3-lesson-selection/1";
  professionId: ProfessionId;
  programVersion: string;
  status: "ready" | "unavailable";
  unavailableReason: null | "no_approved_lessons" | "content_errors" | "mandatory_module_missing" | "diagnostic_outdated" | "nothing_fits_profile";
  variant: LessonSelectionItem["variant"];
  items: LessonSelectionItem[];
  excluded: { lessonId: string; reason: string }[];
  coverageGaps: string[];
}

// ---------- 30-step constructor (#46) ----------

export interface PlanStepV3 extends PlanStepCandidate {
  /** Stable across rebuilds: lesson/version/candidate. stepId/position are the order in this plan. */
  stableId: string;
  phase: PlanPhase;
  lessonVersion: string;
  lessonTitle: string;
  templateKind: string;
  variant: LessonSelectionItem["variant"];
  metric: MetricRef | null;
  restrictions: string[];
  why: { reasons: SelectionReason[]; text: string };
  estimatedMinutes: number;
  session: number;
}

export interface PlanGap { phase: PlanPhase | "total"; needed: number; available: number; missing: string }

export type PlanV3 =
  | {
    modelVersion: "career-v3-plan/1";
    status: "ready";
    professionId: ProfessionId;
    builtOn: string;
    versions: { diagnostic: string; role: string; program: string; library: string; resultModel: string; lessons: Record<string, string> };
    variant: LessonSelectionItem["variant"];
    sessionMinutes: number;
    phaseCounts: Record<PlanPhase, number>;
    steps: PlanStepV3[]; // exactly PLAN_STEPS_REQUIRED; each references a delivered lesson/exercise/template
  }
  | {
    modelVersion: "career-v3-plan/1";
    status: "unavailable";
    professionId: ProfessionId;
    builtOn: string;
    reason: "no_approved_lessons" | "content_errors" | "mandatory_module_missing" | "diagnostic_outdated" | "nothing_fits_profile" | "insufficient_material";
    message: string;
    gaps: PlanGap[];
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
  "POST task-map": { response: { taskMap: TaskMapV3; savedAt: string } };
  "GET task-map": { response: { taskMap: TaskMapV3 | null; stale: boolean; staleReasons: string[] } };
  "GET lessons/selection": { response: LessonSelectionV3 };
  "POST plan": { response: { plan: PlanV3; savedAt: string | null } };
  "GET plan": { response: { plan: PlanV3 | null; stale: boolean; staleReasons: string[] } };
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
