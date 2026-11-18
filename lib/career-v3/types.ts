// AI Career 3.0 engine — shared types. Profession-agnostic: everything profession-specific
// arrives as content (role matrix, diagnostic, curriculum) plus a declarative binding in
// content/career/v3/professions.json. Nothing here imports the v2 synthetic cabinet.

export type ProfessionId = string;
export type LessonStatus = "prototype" | "draft" | "review" | "approved" | "retired";
export type SlotStatus = "planned" | "published" | "retired";

export interface ContentIssue {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
}

// ---------- Profession registry and declarative diagnostic binding ----------

/** Maps semantic diagnostic "slots" of the shared core to question IDs of one profession. */
export interface DiagnosticBinding {
  subtypeQuestion: string;
  subtypeClarifier: string | null;
  mixedSubtypeValue: string | null;
  levelQuestion: string;
  /** Answer value → canonical level. */
  levelMap: Record<string, "starter" | "independent" | "experienced">;
  aiExperienceQuestion: string;
  aiExperienceBasic: string[];
  aiExperienceAdvanced: string[];
  workAreaQuestion: string;
  taskQuestion: string;
  obstacleQuestion: string;
  frequencyQuestion: string;
  durationQuestion: string;
  kpiQuestion: string;
  /** KPI answer → metric IDs of the role matrix. */
  kpiMetricMap: Record<string, string[]>;
  baselineQuestion: string;
  baselineMissing: string[];
  paceQuestion: string;
  paceMinutes: Record<string, number | null>;
  goalQuestion: string;
  company: {
    toolsQuestion: string;
    toolsUnavailable: string[];
    policyQuestion: string;
    policyApproved: string[];
    policyContactQuestion: string | null;
    dataQuestion: string;
    errorCostQuestion: string;
    reviewQuestion: string;
    approvalQuestion: string;
  };
  /** Safety rule ID → engine effects. Rules are evaluated from the diagnostic content itself. */
  safetyEffects: Record<string, SafetyEffect[]>;
  /** Curriculum slots that can never be skipped (safety module). */
  mandatoryModuleId: string;
}

export type SafetyEffect =
  | "synthetic_only"
  | "company_policy_first"
  | "no_real_data_upload"
  | "human_review_required"
  | "no_unattended_changes"
  | "no_personal_commitments"
  | "no_inference";

export interface ProfessionConfig {
  id: ProfessionId;
  title: string;
  status: "pilot" | "planned";
  files: {
    role: string;
    diagnostic: string;
    curriculum: string;
  };
  lessonDirs: string[];
  planCandidateDirs: string[];
  diagnosticBinding: DiagnosticBinding;
}

export interface ProfessionRegistry {
  schemaVersion: string;
  engineVersion: string;
  pilotProfessionId: ProfessionId;
  shared: { lessonSchema: string; planStepSchema: string; prototypeDir: string };
  professions: ProfessionConfig[];
}

// ---------- Role matrix and diagnostic content (subset of fields the engine relies on) ----------

export interface RoleTask {
  id: string;
  title: string;
  subtypeIds: string[];
  stage: string;
  mode: "assist" | "conditional" | "human";
  modeMeaning: string;
  valueDrivers: string[];
  prerequisites: string;
  humanResponsibility: string;
  metricId: string;
  scenarioId: string;
  skillId: string;
  exampleType: string;
}

export interface RoleMatrix {
  schemaVersion: string;
  lastReviewed: string;
  roleId: string;
  roleName: string;
  subtypes: { id: string; label: string; primaryMetrics: string[] }[];
  levels: { id: string; label: string }[];
  skills: { id: string; name: string }[];
  metrics: { id: string; label: string; method: string; caveat: string }[];
  scenarios: { id: string; title: string; metricId: string; taskIds: string[] }[];
  tasks: RoleTask[];
}

export interface DiagnosticOption { value: string; label: string }

export interface DiagnosticQuestion {
  id: string;
  section: string;
  prompt: string;
  help: string;
  why: string;
  affects: string[];
  kind: "single" | "multi" | "matrix_task_multi";
  options: DiagnosticOption[];
  minSelected?: number;
  maxSelected?: number;
  exclusiveOptions?: string[];
  allowOption?: string;
  allowOptionLabel?: string;
  maxVisible?: number;
  showWhen?: { questionId: string; valueIn: string[] };
}

export interface DiagnosticDefinition {
  schemaVersion: string;
  lastReviewed: string;
  status: string;
  roleMatrix: string;
  primaryQuestions: DiagnosticQuestion[];
  followUps: DiagnosticQuestion[];
  maxTotalQuestions: number;
  noFreeText: boolean;
  optionsSourceRules: {
    matrix_task_multi: {
      roleFilters: Record<string, string[]>;
      stageFilterQuestion: string;
      subtypeQuestion: string;
      showMax: number;
      selectedMax: number;
      areaStageAliases: Record<string, string[]>;
    };
  };
  safetyRules: { id: string; condition: string; action: string }[];
  selectionRules: { id: string; from: string; to: string }[];
}

export type DiagnosticAnswers = Record<string, string | string[]>;

// ---------- Lesson library ----------

export interface CurriculumSlot {
  id: string;
  moduleId: string;
  title: string;
  scenarioId: string | null;
  status: SlotStatus | string;
  publishedLessonId: string | null;
  [extra: string]: unknown;
}

export interface Curriculum {
  schemaVersion: string;
  roleId: string;
  usableForPaidUser: boolean;
  modules: { id: string; title: string }[];
  slots: CurriculumSlot[];
}

/** Lesson JSON as defined by schemas/lesson.schema.json (only fields the engine reads are typed). */
export interface LessonDocument {
  id: string;
  version: string;
  status: LessonStatus;
  moduleId: string;
  title: string;
  audience: { roleIds: string[]; subtypeIds: string[]; levels: string[]; taskIds: string[]; scenarioId: string | null };
  durationMinutes: number;
  prerequisites: string[];
  content: {
    exercises: { id: string; title: string }[];
    templates: { id: string; kind: string }[];
    workedExamples: { id: string }[];
    procedure: { id: string }[];
    quiz: { id: string; correctId: string; options: { id: string }[] }[];
    [k: string]: unknown;
  };
  security: { allowEmployerData: boolean; requireHumanReview: boolean };
  sources: { id: string; title: string; url: string; checkedOn: string; supportsClaim: string }[];
  sourcePolicy: { factualClaimsChecked: boolean; timeSensitive: boolean; nextReviewOn: string | null };
  downloads: { id: string; kind: string; repositoryPath: string }[];
  quality: { reviewer: string; reviewedOn: string | null; canBePublished: boolean; notes: string };
}

export interface PlanStepCandidate {
  stepId: string;
  position: number;
  lessonId: string;
  exerciseId: string;
  linkedTaskId: string | null;
  learningGoal: string;
  action: string;
  templateId: string;
  expectedArtifact: string;
  completionCriteria: string[];
  metricId: string | null;
  safetyNote: string;
  isCalendarDay: false;
}

export interface LessonFile { path: string; document: unknown }

export interface LibrarySources {
  professionId: ProfessionId;
  today: string;
  curriculum: Curriculum;
  role: RoleMatrix;
  lessonSchema: Record<string, unknown>;
  stepSchema: Record<string, unknown>;
  lessons: LessonFile[];
  planCandidates: { path: string; document: unknown }[];
  /** Repository paths that exist (for downloads). */
  fileExists: (repositoryPath: string) => boolean;
}

export type ExclusionReason =
  | "schema_invalid"
  | "not_approved"
  | "prototype"
  | "review_pending"
  | "draft"
  | "retired"
  | "not_publishable"
  | "review_not_recorded"
  | "unverified_sources"
  | "source_review_overdue"
  | "missing_download"
  | "not_published_in_curriculum"
  | "unknown_slot"
  | "foreign_role"
  | "broken_reference"
  | "employer_data_allowed"
  | "human_review_not_required"
  | "duplicate_id";

export interface LessonEntry {
  id: string;
  version: string;
  status: LessonStatus | "unknown";
  path: string;
  moduleId: string | null;
  slotId: string | null;
  deliverable: boolean;
  exclusions: ExclusionReason[];
}

export interface PublishedLesson {
  id: string;
  version: string;
  moduleId: string;
  slotId: string;
  title: string;
  scenarioId: string | null;
  taskIds: string[];
  subtypeIds: string[];
  levels: string[];
  durationMinutes: number;
  exerciseIds: string[];
  templateIds: string[];
  document: LessonDocument;
}

export type LibraryAvailability =
  | { status: "available"; publishedLessons: number }
  | { status: "unavailable"; reason: "no_approved_lessons" | "content_errors"; message: string };

export interface LibraryIndex {
  professionId: ProfessionId;
  programVersion: string;
  entries: LessonEntry[];
  published: PublishedLesson[];
  planCandidates: PlanStepCandidate[];
  issues: ContentIssue[];
  slots: { id: string; moduleId: string; status: string; publishedLessonId: string | null; deliverableLessonId: string | null }[];
  availability: LibraryAvailability;
}
