// Client view of the server progress API (GET progress). The client never sends a state — only
// checklists of booleans, option IDs and the step's position + stable ID; the server derives the rest.
import type { PlanStepV3, PlanV3, StepState } from "@/lib/career-v3/contracts";

export type ReadyPlan = Extract<PlanV3, { status: "ready" }>;
export interface StepProgress {
  position: number; stableId: string; lessonId: string; lessonVersion: string; exerciseId: string; state: StepState;
  criteriaMet: boolean[] | null; completionMet: boolean[] | null; completedAt: string | null; updatedAt: string | null;
}
export interface QuizProgress { lessonVersion: string; passed: boolean; attempts: number; correct: number; total: number; answers: Record<string, string> }
export interface HistoryItem { createdAt: string; supersededAt: string; reasons: string[]; done: number; total: number }
export interface Summary { total: number; done: number; selfChecked: number; inProgress: number; notStarted: number; percent: number }
export type Progress =
  | { plan: null; history: HistoryItem[] }
  | {
    planVersionId: string; plan: ReadyPlan; startedAt: string; stale: boolean; staleReasons: string[];
    steps: StepProgress[]; quizzes: Record<string, QuizProgress>; summary: Summary; resumePosition: number | null; history: HistoryItem[];
  };
export type ActiveProgress = Extract<Progress, { planVersionId: string }>;
export type { PlanStepV3, StepState };

export const lessonTitles = (plan: ReadyPlan) => Object.fromEntries(plan.steps.map((s) => [s.lessonId, s.lessonTitle]));
export const cleanTitle = (t: string) => t.replace("[SYNTHETIC FIXTURE] ", "");
