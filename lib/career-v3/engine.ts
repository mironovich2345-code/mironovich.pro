// Shared context for the task map, lesson selection and plan builder, plus validation of the
// profession's declarative engine config. Nothing here is specific to one profession.
import { DIAGNOSTIC_RESULT_MODEL, type DiagnosticResultV3 } from "./diagnostic.ts";
import type { MetricRef } from "./contracts.ts";
import type { Curriculum, DiagnosticBinding, DiagnosticDefinition, EngineConfig, PlanPhase, ProfessionId, RoleMatrix } from "./types.ts";

export const PHASES: PlanPhase[] = ["safety", "apply", "verify", "measure", "value", "next_level"];

export interface EngineContext {
  professionId: ProfessionId;
  role: RoleMatrix;
  curriculum: Curriculum;
  definition: DiagnosticDefinition;
  binding: DiagnosticBinding;
  engine: EngineConfig;
  modulePhases: Record<string, PlanPhase>;
  templateKindPhases: Record<string, PlanPhase>;
}

export function currentVersions(ctx: EngineContext) {
  return { diagnostic: ctx.definition.schemaVersion, role: ctx.role.schemaVersion, resultModel: DIAGNOSTIC_RESULT_MODEL };
}

/** Why a diagnostic result can no longer be used as input (empty = usable). */
export function resultOutdatedReasons(ctx: EngineContext, result: DiagnosticResultV3): string[] {
  const v = currentVersions(ctx);
  const r: string[] = [];
  if (result.professionId !== ctx.professionId) r.push("profession_changed");
  if (result.modelVersion !== v.resultModel) r.push("result_model_changed");
  if (result.diagnosticVersion !== v.diagnostic) r.push("diagnostic_version_changed");
  if (result.roleVersion !== v.role) r.push("role_matrix_version_changed");
  return r;
}

export function metricRef(ctx: EngineContext, metricId: string | null): MetricRef | null {
  if (!metricId) return null;
  const m = ctx.role.metrics.find((x) => x.id === metricId);
  if (!m) return null;
  const kind = ctx.engine.metricKinds[metricId];
  return {
    metricId, label: m.label, method: m.method, caveat: m.caveat, kind,
    attribution: kind === "exercise" ? "exercise_result" : "observed_not_attributed",
  };
}

export function validateEngineConfig(ctx: EngineContext): string[] {
  const e: string[] = [];
  const { engine, role, curriculum, definition } = ctx;
  const metricIds = new Set(role.metrics.map((m) => m.id));
  for (const m of metricIds) if (!engine.metricKinds[m]) e.push(`metric ${m} has no kind (exercise | workplace_outcome)`);
  for (const [m, k] of Object.entries(engine.metricKinds)) {
    if (!metricIds.has(m)) e.push(`metricKinds: unknown metric ${m}`);
    if (k !== "exercise" && k !== "workplace_outcome") e.push(`metricKinds: bad kind ${k}`);
  }
  for (const d of engine.disputedKpiMappings) {
    if (!(ctx.binding.kpiMetricMap[d.kpi] ?? []).includes(d.metricId)) e.push(`disputed mapping ${d.kpi}→${d.metricId} is not in kpiMetricMap`);
  }
  // Every KPI link to a workplace outcome must be declared disputed: it is never a proven training effect.
  for (const [kpi, ids] of Object.entries(ctx.binding.kpiMetricMap)) {
    for (const id of ids) {
      if (engine.metricKinds[id] === "workplace_outcome" && !engine.disputedKpiMappings.some((d) => d.kpi === kpi && d.metricId === id))
        e.push(`KPI ${kpi}→${id} links to a workplace outcome without a declared methodological caveat`);
    }
  }
  const questions = new Map([...definition.primaryQuestions, ...definition.followUps].map((q) => [q.id, q]));
  const skills = new Set(role.skills.map((s) => s.id));
  for (const s of engine.strengthSignals) {
    const q = questions.get(s.questionId);
    if (!q) { e.push(`strength ${s.id}: unknown question ${s.questionId}`); continue; }
    for (const v of s.values) if (!q.options.some((o) => o.value === v)) e.push(`strength ${s.id}: ${s.questionId} has no option ${v}`);
    if (!skills.has(s.skillId)) e.push(`strength ${s.id}: unknown skill ${s.skillId}`);
  }
  const goalQ = questions.get(ctx.binding.goalQuestion);
  const modules = new Set(curriculum.modules.map((m) => m.id));
  for (const [goal, mods] of Object.entries(engine.goalModuleMap)) {
    if (!goalQ?.options.some((o) => o.value === goal)) e.push(`goalModuleMap: unknown goal ${goal}`);
    for (const m of mods) if (!modules.has(m)) e.push(`goalModuleMap: unknown module ${m}`);
  }
  for (const m of modules) if (!ctx.modulePhases[m]) e.push(`module ${m} has no plan phase`);
  for (const p of [...Object.values(ctx.modulePhases), ...Object.values(ctx.templateKindPhases)]) if (!PHASES.includes(p)) e.push(`unknown phase ${p}`);
  return e;
}
