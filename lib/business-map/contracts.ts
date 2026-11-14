export type Period = "day" | "week" | "month";
export type Band = "low" | "medium" | "high";
export type Group = "first" | "preliminary" | "later" | "prepare" | "not-now" | "insufficient" | "excluded";
export type Range = readonly [number, number];
export type Company = {
  industry: string; headcount: "1-10" | "11-50" | "51-100" | "101-250" | "over250";
  goal: "cost" | "speed" | "errors" | "growth"; systems: string[];
  salary?: number | null; salaryLoad?: number; monthlyHours?: number;
};
export type Process = {
  id: string; name: string; description?: string;
  employees: number | null;
  /** TOTAL operations of the whole team. Never multiply by employees. */
  operations: number | null; period: Period; minutes: number | null;
  source: "measured" | "estimate" | "unknown";
  mechanical: "under25" | "from25to50" | "from50to75" | "over75" | "unknown";
  systems: string[] | null;
  regulation: "yes" | "partial" | "no" | "unknown";
  exceptions: "under10" | "from10to30" | "from30to50" | "over50" | "unknown";
  error: "minor" | "noticeable" | "serious" | "critical" | "unknown";
  judgment: "rare" | "sometimes" | "mostly" | "unknown";
  access: "available" | "manual" | "unknown";
  personalData: "yes" | "no" | "unknown";
  hourlyRate?: number | null;
  minutesRange?: Range;
  /** Explicit calendar/rate provenance, primarily for calculator transfers. */
  periodsPerMonth?: number;
  monthlyHours?: number;
  rateSource?: "user-hourly" | "calculator-salary" | "calculator-employer";
  independent: boolean; overlapsWith: string[];
  cash?: { disposition: "retained" | "avoid-hire" | "reduce-contractor"; replaceableHours: number; replacementRate: number; cancelledPayments: number };
  capacityRevenue?: number | null;
  costs?: { implementation?: Range; training?: Range; licenses?: Range; maintenance?: Range; external?: Range };
};
export type BusinessMapInput = { company: Company; processes: Process[] };
export type Quantity = { value: number; exact: string; display: number };
export type Payback = { status: "not-calculated" | "not-recoverable" | "calculated"; months: Quantity | null; missing: string[] };
export type Scenario = {
  name: "conservative" | "base" | "optimistic";
  hours: Quantity; freedHours: Quantity; residualHours: Quantity; fte: Quantity;
  freedTimeValue: Quantity | null; cashReduction: Quantity; capacityRevenue: number | null;
  oneOff: Quantity | null; recurring: Quantity | null; payback: Payback;
};
export type ProcessResult = {
  id: string; name: string; modelVersion: string; hours: Quantity | null; hourlyRate: Quantity | null; timeCost: Quantity | null;
  scenarios: Scenario[]; value: Band | null; complexity: { score: number | null; level: Band | null }; risk: { score: number | null; level: Band | null };
  paybackRange: { min: Quantity; max: Quantity } | null;
  confidence: Band; suitability: "eligible" | "needs-data" | "prepare" | "excluded";
  matrixGroup: Group | null; group: Group; reasons: string[]; missing: string[]; flags: string[]; longPayback: boolean;
};
export type BusinessMapResult = {
  modelVersion: string; processes: ProcessResult[];
  ranking: string[]; recommendedId: string | null; fallbackId: string | null;
  totals: { hours: Quantity; timeCost: Quantity | null } | null; totalBlockers: string[];
};
/** Persistence envelope only. Account ownership must be enforced by the future server. */
export type AnalysisSnapshot = { schemaVersion: "business-map-1"; accountId: string; analysisId: string; revision: number; createdAt: string; input: BusinessMapInput; result: BusinessMapResult };
