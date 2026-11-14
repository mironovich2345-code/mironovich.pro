import { businessMapModel as model } from "../../../config/business-map-model.ts";
import { businessMapAiPolicy as policy } from "../../../config/business-map-ai.ts";
import type {
  Advice,
  ChatRequest,
  Industry,
  Interpretation,
  ScenarioId,
  WorkloadProposal,
} from "./contracts.ts";
import { scenarioById, scenarioIds } from "./industry.ts";
import { normalizeNumbers } from "./language.ts";
const industries = [
  "fitness",
  "retail",
  "services",
  "agencies",
  "other",
] as const;
const approaches = [
  "organize",
  "existing",
  "api",
  "rules",
  "ai",
  "custom",
  "wait",
] as const;
const systems = [
  "crm",
  "tables",
  "mail",
  "erp",
  "messengers",
  "paper",
  "voice",
  "other",
];
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: string[]) =>
  Object.keys(v).length === expected.length && expected.every((k) => k in v);
const str = (v: unknown, max = 500): v is string =>
  typeof v === "string" &&
  v.trim().length > 0 &&
  v.length <= max &&
  !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v);
const numeric = (v: unknown, min: number, max: number, integer = false) =>
  v === null ||
  (typeof v === "number" &&
    Number.isFinite(v) &&
    v >= min &&
    v <= max &&
    (!integer || Number.isInteger(v)));
const enumValue = (v: unknown, allowed: readonly string[]) =>
  typeof v === "string" && allowed.includes(v);
const enumOrNull = (v: unknown, allowed: readonly unknown[]) =>
  v === null || allowed.includes(v);
export function parseChatRequest(raw: unknown): ChatRequest | null {
  if (
    !obj(raw) ||
    !keys(raw, [
      "requestId",
      "intent",
      "message",
      "industry",
      "scenarioId",
      "facts",
      "question",
      "risk",
    ])
  )
    return null;
  if (
    !str(raw.requestId, 80) ||
    !/^[a-zA-Z0-9-]{12,80}$/.test(raw.requestId) ||
    !enumValue(raw.intent, ["interpret", "advise"])
  )
    return null;
  if (
    !str(raw.message, policy.maxMessageCharacters) ||
    !enumOrNull(raw.industry, industries) ||
    !enumOrNull(raw.scenarioId, scenarioIds)
  )
    return null;
  if (
    !Array.isArray(raw.facts) ||
    raw.facts.length > 12 ||
    raw.facts.some((f) => !str(f, 300))
  )
    return null;
  if (
    !enumOrNull(raw.question, [
      "confirm",
      "volume",
      "duration",
      "risk",
      "scope",
      "staff",
    ]) ||
    !enumValue(raw.risk, [
      "minor",
      "noticeable",
      "serious",
      "critical",
      "unknown",
    ])
  )
    return null;
  if (
    raw.message.length + raw.facts.join(" ").length >
      policy.maxContextCharacters ||
    (raw.intent === "advise" && raw.scenarioId === null)
  )
    return null;
  return raw as ChatRequest;
}
const fieldString = { type: "string" };
const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };
const nullableEnum = (values: readonly string[]) => ({
  type: ["string", "null"],
  enum: [...values, null],
});
const array = (items: unknown) => ({ type: "array", items });
const schemaObject = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
export const interpretationSchema = schemaObject({
  industry: nullableEnum(industries),
  locations: nullableNumber,
  scaleEvidence: nullableString,
  systems: array(
    schemaObject({
      code: { type: "string", enum: systems },
      evidence: fieldString,
    }),
  ),
  facts: array(schemaObject({ text: fieldString, evidence: fieldString })),
  hypotheses: array(
    schemaObject({
      scenarioId: { type: "string", enum: scenarioIds },
      reason: fieldString,
    }),
  ),
  workloads: array(
    schemaObject({
      scenarioId: { type: "string", enum: scenarioIds },
      employees: nullableNumber,
      operations: nullableNumber,
      scope: { type: "string", enum: ["team", "per-person", "unknown"] },
      period: nullableEnum(["day", "week", "month"]),
      minutes: nullableNumber,
      evidence: fieldString,
    }),
  ),
});
export const adviceSchema = schemaObject({
  approach: { type: "string", enum: approaches },
  problem: fieldString,
  hypothesis: fieldString,
  firstStep: fieldString,
  prepare: array(fieldString),
  metrics: array(fieldString),
  risks: array(fieldString),
  continueIf: fieldString,
  stopIf: fieldString,
});
function numbersIn(text: string): string[] {
  return normalizeNumbers(text).match(/-?\d+(?:\.\d+)?/g) ?? [];
}
function supportedNumbers(text: string, evidence: string): boolean {
  return numbersIn(text).every((n) => numbersIn(evidence).includes(n));
}
/** Evidence must be an exact substring of the current user message, not the system prompt. */
export function parseInterpretation(
  raw: unknown,
  message: string,
): Interpretation | null {
  if (
    !obj(raw) ||
    !keys(raw, [
      "industry",
      "locations",
      "scaleEvidence",
      "systems",
      "facts",
      "hypotheses",
      "workloads",
    ]) ||
    !enumOrNull(raw.industry, industries) ||
    !numeric(raw.locations, 1, policy.maxLocations, true)
  )
    return null;
  const evidence = (v: unknown): v is string =>
    str(v, 1000) && message.includes(v);
  if (
    raw.locations !== null &&
    (!evidence(raw.scaleEvidence) ||
      !numbersIn(raw.scaleEvidence).includes(String(raw.locations)))
  )
    return null;
  if (raw.locations === null && raw.scaleEvidence !== null) return null;
  if (
    !Array.isArray(raw.systems) ||
    raw.systems.length > 8 ||
    raw.systems.some(
      (v) =>
        !obj(v) ||
        !keys(v, ["code", "evidence"]) ||
        !enumValue(v.code, systems) ||
        !evidence(v.evidence),
    )
  )
    return null;
  if (
    !Array.isArray(raw.facts) ||
    raw.facts.length > 8 ||
    raw.facts.some(
      (v) =>
        !obj(v) ||
        !keys(v, ["text", "evidence"]) ||
        !str(v.text, 300) ||
        !evidence(v.evidence) ||
        !supportedNumbers(v.text, v.evidence),
    )
  )
    return null;
  if (
    !Array.isArray(raw.hypotheses) ||
    raw.hypotheses.length > 7 ||
    raw.hypotheses.some(
      (v) =>
        !obj(v) ||
        !keys(v, ["scenarioId", "reason"]) ||
        !scenarioIds.includes(v.scenarioId as ScenarioId) ||
        !str(v.reason, 300) ||
        /[\d₽%$]/.test(v.reason),
    )
  )
    return null;
  if (!Array.isArray(raw.workloads) || raw.workloads.length > 5) return null;
  for (const v of raw.workloads) {
    if (
      !obj(v) ||
      !keys(v, [
        "scenarioId",
        "employees",
        "operations",
        "scope",
        "period",
        "minutes",
        "evidence",
      ]) ||
      !scenarioIds.includes(v.scenarioId as ScenarioId) ||
      !evidence(v.evidence)
    )
      return null;
    if (
      !numeric(v.employees, 1, model.limits.employees, true) ||
      !numeric(v.operations, 0, model.limits.monthlyOperations) ||
      !numeric(v.minutes, ...model.limits.minutes) ||
      !enumValue(v.scope, ["team", "per-person", "unknown"]) ||
      !enumOrNull(v.period, ["day", "week", "month"])
    )
      return null;
    // Scope may still need user clarification; a model cannot invent or multiply operations.
    for (const n of [v.employees, v.operations, v.minutes])
      if (n !== null && !numbersIn(v.evidence).includes(String(n))) return null;
  }
  return raw as Interpretation;
}
export function parseAdvice(raw: unknown, request: ChatRequest): Advice | null {
  if (
    !obj(raw) ||
    !keys(raw, [
      "approach",
      "problem",
      "hypothesis",
      "firstStep",
      "prepare",
      "metrics",
      "risks",
      "continueIf",
      "stopIf",
    ]) ||
    !approaches.includes(raw.approach as Advice["approach"])
  )
    return null;
  if (
    !request.scenarioId ||
    !scenarioById(request.scenarioId).solutions.includes(
      raw.approach as Advice["approach"],
    )
  )
    return null;
  if (
    request.risk === "critical" &&
    !["wait", "organize"].includes(String(raw.approach))
  )
    return null;
  const prose = (v: unknown) =>
    str(v, 700) &&
    !/[\d₽%$]|https?:\/\/|окуп|сэконом|экономи|гарантирован|рубл|процент/iu.test(
      v,
    );
  if (
    [
      raw.problem,
      raw.hypothesis,
      raw.firstStep,
      raw.continueIf,
      raw.stopIf,
    ].some((v) => !prose(v))
  )
    return null;
  for (const a of [raw.prepare, raw.metrics, raw.risks])
    if (
      !Array.isArray(a) ||
      a.length < 1 ||
      a.length > 5 ||
      a.some((v) => !prose(v))
    )
      return null;
  return raw as Advice;
}
export type { Industry, WorkloadProposal };
