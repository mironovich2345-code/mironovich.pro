import type {
  Company,
  Process,
  ProcessResult,
  Quantity,
} from "../contracts.ts";
export type Industry = "fitness" | "retail" | "services" | "agencies" | "other";
export type ScenarioId =
  | "reporting"
  | "transfer"
  | "missed-leads"
  | "slow-response"
  | "onboarding"
  | "sales-control"
  | "renewals";
export type Approach =
  "organize" | "existing" | "api" | "rules" | "ai" | "custom" | "wait";
export type QuestionKey =
  "confirm" | "volume" | "duration" | "risk" | "scope" | "staff";
export type Workload = {
  employees: number | null;
  operations: number | null;
  scope: "team" | "per-person" | "unknown";
  period: "day" | "week" | "month" | null;
  minutes: number | null;
  hourlyRate: number | null;
};
export type QuickInsight = {
  hours: Quantity | null;
  timeCost: Quantity | null;
  teamOperations: number | null;
  missing: string[];
  warnings: string[];
  firstAction: string;
  solution: Approach;
  kind: "early-hypothesis" | "user-data";
};
export type LiveStatus =
  | "discovered"
  | "clarifying"
  | "insufficient"
  | "pilot"
  | "prepare"
  | "not-recommended";
export type LiveProcess = {
  id: string;
  scenarioId: ScenarioId;
  name: string;
  confirmed: boolean | null;
  facts: string[];
  hypotheses: string[];
  workload: Workload;
  error: Process["error"];
  asked: QuestionKey[];
  core: Process | null;
  result: ProcessResult | null;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  source: "user" | "rules" | "core" | "openai" | "demo";
};
export type FactProposal = { text: string; evidence: string };
export type WorkloadProposal = {
  scenarioId: ScenarioId;
  employees: number | null;
  operations: number | null;
  scope: Workload["scope"];
  period: Workload["period"];
  minutes: number | null;
  evidence: string;
};
export type Interpretation = {
  industry: Industry | null;
  locations: number | null;
  scaleEvidence: string | null;
  systems: { code: string; evidence: string }[];
  facts: FactProposal[];
  hypotheses: { scenarioId: ScenarioId; reason: string }[];
  workloads: WorkloadProposal[];
};
export type Advice = {
  approach: Approach;
  problem: string;
  hypothesis: string;
  firstStep: string;
  prepare: string[];
  metrics: string[];
  risks: string[];
  continueIf: string;
  stopIf: string;
};
export type ConversationState = {
  industry: Industry | null;
  locations: number | null;
  systems: string[];
  company: Company | null;
  processes: LiveProcess[];
  overflow: ScenarioId[];
  messages: Message[];
  activeId: string | null;
  question: QuestionKey | null;
  proposal: Interpretation | null;
  proposalSource: "openai" | "demo" | null;
  advice: Record<string, Advice>;
  revision: number;
  diagnosticEnded: boolean;
};
/** Future voice input uses the same text contract; no audio is captured or sent today. */
export type ConversationInput = { kind: "text"; text: string };
export type ChatRequest = {
  requestId: string;
  intent: "interpret" | "advise";
  message: string;
  industry: Industry | null;
  scenarioId: ScenarioId | null;
  facts: string[];
  question: QuestionKey | null;
  risk: Process["error"];
};
export type ChatResponse =
  | {
      ok: true;
      source: "openai";
      interpretation: Interpretation | null;
      advice: Advice | null;
    }
  | { ok: false; source: "unavailable"; error: string; code: string };
