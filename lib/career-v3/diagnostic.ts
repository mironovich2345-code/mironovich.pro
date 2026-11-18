// AI Career 3.0 diagnostic engine. Generic over professions: question IDs and value semantics come
// from the profession's DiagnosticBinding; questions, options, follow-ups and safety rules come from
// the approved diagnostic content, which this module never rewrites.
//
// Order of precedence: safety rules are evaluated first and constrain every personalised output.
import type {
  Curriculum, DiagnosticAnswers, DiagnosticBinding, DiagnosticDefinition, DiagnosticQuestion,
  ProfessionId, RoleMatrix, RoleTask, SafetyEffect,
} from "./types.ts";

export const DIAGNOSTIC_RESULT_MODEL = "career-v3-diagnostic-result/1";

export class DiagnosticConfigError extends Error {}

export interface DiagnosticContext {
  professionId: ProfessionId;
  definition: DiagnosticDefinition;
  role: RoleMatrix;
  curriculum: Curriculum;
  binding: DiagnosticBinding;
}

export interface AnswerError { questionId: string; code: string; message: string }

export type ValidationResult =
  | { ok: true; answers: DiagnosticAnswers; askedQuestionIds: string[] }
  | { ok: false; errors: AnswerError[] };

export interface TaskOption { value: string; label: string; stage: string }

export interface TaskFocus {
  taskId: string;
  title: string;
  stage: string;
  roleMode: RoleTask["mode"];
  /** Preliminary decision for the task map (#45); safety may only make it stricter. */
  decision: "ai_can_take_part" | "ai_assists" | "human_decides";
  practiceMode: "synthetic_practice" | "approved_tools_public_data";
  automationAllowed: boolean;
  humanReviewRequired: true;
  commitmentsNeedApproval: boolean;
  humanResponsibility: string;
  metricId: string;
  scenarioId: string;
  skillId: string;
  restrictions: string[];
}

export interface DiagnosticResultV3 {
  modelVersion: typeof DIAGNOSTIC_RESULT_MODEL;
  professionId: ProfessionId;
  diagnosticVersion: string;
  roleVersion: string;
  evaluatedOn: string;
  answeredQuestions: number;
  synthetic: true;
  profile: {
    subtype: string;
    subtypeSource: string;
    secondarySubtypes: string[];
    level: "starter" | "independent" | "experienced";
    explanationDepth: "basic" | "standard" | "advanced";
    workAreas: string[];
  };
  tasks: {
    selected: TaskFocus[];
    fallback: null | { kind: "training_example"; message: string };
    shortlist: string[];
  };
  scenarios: string[];
  measurement: {
    metricIds: string[];
    baselineRequired: boolean;
    note: string;
  };
  company: {
    aiTools: string[];
    toolsAvailable: boolean;
    policy: string;
    policyApproved: boolean;
    policyContact: string | null;
    dataTypes: string[];
    errorCost: string;
    reviewPractice: string;
    approvalRights: string;
  };
  safety: {
    mode: "synthetic_only" | "approved_tools_public_data";
    appliedRules: { id: string; action: string }[];
    effects: SafetyEffect[];
    aiToolUseInPractice: boolean;
    realEmployerDataAllowed: false;
    mandatorySlots: string[];
    prohibitedInferences: string[];
  };
  learning: {
    sessionMinutes: number | null;
    goals: string[];
    obstacle: string;
    taskFrequency: string;
    taskDuration: string;
  };
}

// ---------- safety rule interpretation (fail closed) ----------

type Predicate = (a: DiagnosticAnswers) => boolean;
const asList = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function parseSafetyCondition(condition: string): Predicate {
  let m = /^(\w+) in \[([^\]]+)\]$/.exec(condition.trim());
  if (m) {
    const [, q, list] = m;
    const values = list.split(",").map((x) => x.trim());
    return (a) => asList(a[q]).some((v) => values.includes(v));
  }
  m = /^(\w+) includes (.+)$/.exec(condition.trim());
  if (m) {
    const [, q, list] = m;
    const values = list.split(/,|\bor\b/).map((x) => x.trim()).filter(Boolean);
    return (a) => asList(a[q]).some((v) => values.includes(v));
  }
  if (/^Never\b/.test(condition.trim())) return () => true;
  throw new DiagnosticConfigError(`Unsupported safety condition: ${condition}`);
}

export function validateDiagnosticConfig(ctx: DiagnosticContext): string[] {
  const e: string[] = [];
  const { definition: d, binding: b, role } = ctx;
  const all = new Map([...d.primaryQuestions, ...d.followUps].map((q) => [q.id, q]));
  const values = (id: string) => new Set((all.get(id)?.options ?? []).map((o) => o.value));
  const needQ = (id: string | null, slot: string) => { if (id !== null && !all.has(id)) e.push(`binding ${slot}: unknown question ${id}`); };
  const needV = (id: string, vals: string[], slot: string) => {
    for (const v of vals) if (!values(id).has(v)) e.push(`binding ${slot}: ${id} has no option ${v}`);
  };
  needQ(b.subtypeQuestion, "subtypeQuestion"); needQ(b.subtypeClarifier, "subtypeClarifier");
  needQ(b.levelQuestion, "levelQuestion"); needV(b.levelQuestion, Object.keys(b.levelMap), "levelMap");
  needQ(b.aiExperienceQuestion, "aiExperienceQuestion");
  needV(b.aiExperienceQuestion, [...b.aiExperienceBasic, ...b.aiExperienceAdvanced], "aiExperience");
  for (const k of ["workAreaQuestion", "taskQuestion", "obstacleQuestion", "frequencyQuestion", "durationQuestion",
    "kpiQuestion", "baselineQuestion", "paceQuestion", "goalQuestion"] as const) needQ(b[k], k);
  needV(b.kpiQuestion, Object.keys(b.kpiMetricMap), "kpiMetricMap");
  needV(b.baselineQuestion, b.baselineMissing, "baselineMissing");
  needV(b.paceQuestion, Object.keys(b.paceMinutes), "paceMinutes");
  for (const ids of Object.values(b.kpiMetricMap)) for (const m of ids) if (!role.metrics.some((x) => x.id === m)) e.push(`kpiMetricMap: unknown metric ${m}`);
  const c = b.company;
  for (const k of ["toolsQuestion", "policyQuestion", "dataQuestion", "errorCostQuestion", "reviewQuestion", "approvalQuestion"] as const) needQ(c[k], "company." + k);
  needQ(c.policyContactQuestion, "company.policyContactQuestion");
  needV(c.toolsQuestion, c.toolsUnavailable, "company.toolsUnavailable");
  needV(c.policyQuestion, c.policyApproved, "company.policyApproved");
  if (b.mixedSubtypeValue !== null) needV(b.subtypeQuestion, [b.mixedSubtypeValue], "mixedSubtypeValue");
  for (const v of values(b.subtypeQuestion)) {
    if (v !== b.mixedSubtypeValue && !role.subtypes.some((s) => s.id === v)) e.push(`subtype option ${v} is not a role subtype`);
  }
  const ruleIds = new Set(d.safetyRules.map((r) => r.id));
  for (const r of d.safetyRules) {
    try { parseSafetyCondition(r.condition); } catch (x) { e.push((x as Error).message); }
    if (!b.safetyEffects[r.id]?.length) e.push(`safety rule ${r.id} has no engine effect`);
    for (const m of r.condition.matchAll(/\b([QF]\d{2})\b/g)) if (!all.has(m[1])) e.push(`safety rule ${r.id}: unknown question ${m[1]}`);
  }
  for (const id of Object.keys(b.safetyEffects)) if (!ruleIds.has(id)) e.push(`binding refers to unknown safety rule ${id}`);
  if (!ctx.curriculum.modules.some((m) => m.id === b.mandatoryModuleId)) e.push(`unknown mandatory module ${b.mandatoryModuleId}`);
  if (d.noFreeText !== true) e.push("diagnostic must not collect free text");
  if ([...all.values()].some((q) => !["single", "multi", "matrix_task_multi"].includes(q.kind))) e.push("unsupported question kind");
  return e;
}

// ---------- question flow ----------

export function followUpsDue(d: DiagnosticDefinition, answers: DiagnosticAnswers): DiagnosticQuestion[] {
  return d.followUps.filter((f) => f.showWhen && asList(answers[f.showWhen.questionId]).some((v) => f.showWhen!.valueIn.includes(v)));
}

/** Task shortlist for the dynamic task question (Q04 in sales), ranked per optionsSourceRules. */
export function taskShortlist(ctx: DiagnosticContext, answers: DiagnosticAnswers): TaskOption[] {
  const rules = ctx.definition.optionsSourceRules.matrix_task_multi;
  const subtypeAnswer = answers[rules.subtypeQuestion];
  const areas = asList(answers[rules.stageFilterQuestion]);
  if (typeof subtypeAnswer !== "string" || !rules.roleFilters[subtypeAnswer] || areas.length === 0) return [];
  const subtypes = rules.roleFilters[subtypeAnswer];
  const lead = ctx.binding.subtypeClarifier ? answers[ctx.binding.subtypeClarifier] : undefined;
  const primary = typeof lead === "string" ? lead : subtypeAnswer;
  const areaRank = (t: RoleTask) => areas.findIndex((a) => (rules.areaStageAliases[a] ?? []).includes(t.stage));
  return ctx.role.tasks
    .filter((t) => t.subtypeIds.some((s) => subtypes.includes(s)) && areaRank(t) >= 0)
    .sort((x, y) => areaRank(x) - areaRank(y)
      || Number(!x.subtypeIds.includes(primary)) - Number(!y.subtypeIds.includes(primary))
      || x.id.localeCompare(y.id))
    .slice(0, rules.showMax)
    .map((t) => ({ value: t.id, label: t.title, stage: t.stage }));
}

export function validateAnswers(ctx: DiagnosticContext, input: unknown): ValidationResult {
  const d = ctx.definition;
  const errors: AnswerError[] = [];
  const fail = (questionId: string, code: string, message: string) => errors.push({ questionId, code, message });
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: [{ questionId: "*", code: "invalid_payload", message: "Ответы должны быть объектом" }] };
  }
  const answers = input as Record<string, unknown>;
  const known = new Map([...d.primaryQuestions, ...d.followUps].map((q) => [q.id, q]));
  for (const key of Object.keys(answers)) if (!known.has(key)) fail(key, "unknown_question", "Неизвестный вопрос");
  const clean: DiagnosticAnswers = {};

  const check = (q: DiagnosticQuestion, allowed: string[]) => {
    const v = answers[q.id];
    if (v === undefined) { fail(q.id, "missing", "Нужен ответ на вопрос"); return; }
    if (q.kind === "single") {
      if (typeof v !== "string") { fail(q.id, "type", "Нужен один вариант"); return; }
      if (!allowed.includes(v)) { fail(q.id, "invalid_option", "Недопустимый вариант ответа"); return; }
      clean[q.id] = v; return;
    }
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) { fail(q.id, "type", "Нужен список вариантов"); return; }
    const list = v as string[];
    if (new Set(list).size !== list.length) { fail(q.id, "duplicate", "Варианты повторяются"); return; }
    const exclusive = [...(q.exclusiveOptions ?? []), ...(q.allowOption ? [q.allowOption] : [])];
    const valid = [...allowed, ...(q.allowOption ? [q.allowOption] : [])];
    if (list.some((x) => !valid.includes(x))) { fail(q.id, "invalid_option", "Недопустимый вариант ответа"); return; }
    if (list.some((x) => exclusive.includes(x)) && list.length > 1) { fail(q.id, "exclusive", "Этот вариант выбирается отдельно"); return; }
    const min = q.minSelected ?? 1, max = q.maxSelected ?? valid.length;
    if (list.length < min || list.length > max) { fail(q.id, "count", `Выберите от ${min} до ${max} вариантов`); return; }
    clean[q.id] = list;
  };

  for (const q of d.primaryQuestions) {
    if (q.kind === "matrix_task_multi") continue;
    check(q, q.options.map((o) => o.value));
  }
  const due = followUpsDue(d, clean);
  for (const f of d.followUps) {
    if (due.includes(f)) check(f, f.options.map((o) => o.value));
    else if (answers[f.id] !== undefined) fail(f.id, "not_applicable", "Уточнение не требуется при выбранных ответах");
  }
  for (const q of d.primaryQuestions.filter((x) => x.kind === "matrix_task_multi")) {
    const options = taskShortlist(ctx, clean).map((o) => o.value);
    if (options.length === 0 && answers[q.id] === undefined) { fail(q.id, "missing", "Нужен ответ на вопрос"); continue; }
    check(q, options);
  }
  const asked = [...d.primaryQuestions.map((q) => q.id), ...due.map((f) => f.id)];
  if (asked.length > d.maxTotalQuestions) fail("*", "too_many_questions", "Превышено допустимое число вопросов");
  return errors.length ? { ok: false, errors } : { ok: true, answers: clean, askedQuestionIds: asked };
}

// ---------- evaluation ----------

const PROHIBITED_INFERENCES = [
  "вероятность потери работы", "заменимость роли", "реально сэкономленные деньги",
  "согласие клиентов или работодателя", "гарантия роста дохода или карьеры",
];

export function evaluateDiagnostic(ctx: DiagnosticContext, input: unknown, today: string): DiagnosticResultV3 {
  const problems = validateDiagnosticConfig(ctx);
  if (problems.length) throw new DiagnosticConfigError(problems.join("; "));
  const v = validateAnswers(ctx, input);
  if (!v.ok) throw Object.assign(new Error("invalid_answers"), { errors: v.errors });
  const a = v.answers;
  const b = ctx.binding, c = b.company;
  const one = (id: string) => a[id] as string;
  const many = (id: string) => asList(a[id]);

  // 1. Safety first.
  const applied = ctx.definition.safetyRules.filter((r) => parseSafetyCondition(r.condition)(a));
  const effects = [...new Set(applied.flatMap((r) => b.safetyEffects[r.id]))] as SafetyEffect[];
  const toolsAvailable = !many(c.toolsQuestion).some((x) => c.toolsUnavailable.includes(x));
  const policyApproved = c.policyApproved.includes(one(c.policyQuestion));
  const syntheticOnly = effects.includes("synthetic_only") || effects.includes("no_real_data_upload") || !toolsAvailable || !policyApproved;
  const reviewRequired = effects.includes("human_review_required") || effects.includes("no_unattended_changes");
  const commitmentsNeedApproval = effects.includes("no_personal_commitments");

  // 2. Profile.
  const subtypeAnswer = one(b.subtypeQuestion);
  const mixed = b.mixedSubtypeValue !== null && subtypeAnswer === b.mixedSubtypeValue;
  const subtype = mixed && b.subtypeClarifier ? one(b.subtypeClarifier) : subtypeAnswer;
  const secondary = mixed ? ctx.definition.optionsSourceRules.matrix_task_multi.roleFilters[subtypeAnswer].filter((s) => s !== subtype) : [];
  const level = b.levelMap[one(b.levelQuestion)];
  const exp = one(b.aiExperienceQuestion);
  const explanationDepth = level === "starter" || b.aiExperienceBasic.includes(exp) ? "basic"
    : level === "experienced" && b.aiExperienceAdvanced.includes(exp) ? "advanced" : "standard";

  // 3. Tasks — personalised, but bounded by safety.
  const shortlist = taskShortlist(ctx, a);
  const chosen = many(b.taskQuestion).filter((id) => ctx.role.tasks.some((t) => t.id === id));
  const selected: TaskFocus[] = chosen.map((id) => {
    const t = ctx.role.tasks.find((x) => x.id === id)!;
    const restrictions: string[] = [];
    let decision: TaskFocus["decision"] = t.mode === "human" ? "human_decides" : t.mode === "conditional" ? "ai_can_take_part" : "ai_assists";
    const automationAllowed = t.mode === "conditional" && !syntheticOnly && !reviewRequired;
    if (decision === "ai_can_take_part" && !automationAllowed) {
      decision = "ai_assists";
      restrictions.push("Автоматизация части работы отключена правилами безопасности: только черновик с проверкой человеком.");
    }
    if (syntheticOnly) restrictions.push("Практика только на учебных вымышленных данных; данные работодателя не используются.");
    if (commitmentsNeedApproval) restrictions.push("Цены, скидки и обязательства перед клиентом подтверждает уполномоченный сотрудник.");
    if (reviewRequired) restrictions.push("Обязательна проверка человеком; без автоматических изменений в CRM и сообщениях клиенту.");
    return {
      taskId: t.id, title: t.title, stage: t.stage, roleMode: t.mode, decision,
      practiceMode: syntheticOnly ? "synthetic_practice" : "approved_tools_public_data",
      automationAllowed, humanReviewRequired: true, commitmentsNeedApproval,
      humanResponsibility: t.humanResponsibility, metricId: t.metricId, scenarioId: t.scenarioId, skillId: t.skillId, restrictions,
    };
  });
  const fallback = selected.length === 0
    ? { kind: "training_example" as const, message: "Конкретная задача не выбрана: начнём с учебного примера и уточним задачу позже, не делая выводов о реальной работе." }
    : null;

  // 4. Scenarios and metrics.
  const shortTasks = shortlist.map((o) => ctx.role.tasks.find((t) => t.id === o.value)!);
  const scenarios = [...new Set([...selected.map((s) => s.scenarioId), ...shortTasks.map((t) => t.scenarioId)])];
  const kpiMetrics = (b.kpiMetricMap[one(b.kpiQuestion)] ?? []);
  const metricIds = [...new Set([...selected.map((s) => s.metricId), ...kpiMetrics])];
  const baselineRequired = b.baselineMissing.includes(one(b.baselineQuestion));

  const mandatorySlots = ctx.curriculum.slots.filter((s) => s.moduleId === b.mandatoryModuleId).map((s) => s.id);

  return {
    modelVersion: DIAGNOSTIC_RESULT_MODEL,
    professionId: ctx.professionId,
    diagnosticVersion: ctx.definition.schemaVersion,
    roleVersion: ctx.role.schemaVersion,
    evaluatedOn: today,
    answeredQuestions: v.askedQuestionIds.length,
    synthetic: true,
    profile: { subtype, subtypeSource: mixed && b.subtypeClarifier ? b.subtypeClarifier : b.subtypeQuestion, secondarySubtypes: secondary,
      level, explanationDepth, workAreas: many(b.workAreaQuestion) },
    tasks: { selected, fallback, shortlist: shortlist.map((o) => o.value) },
    scenarios,
    measurement: {
      metricIds, baselineRequired,
      note: baselineRequired
        ? "Исходных цифр нет: первый шаг измерений — снять собственный замер «было», а не оценивать результат на глаз."
        : "Сравнение «было → стало» строится на собственных замерах пользователя; вклад ИИ в выручку и конверсию не приписывается без оснований.",
    },
    company: {
      aiTools: many(c.toolsQuestion), toolsAvailable, policy: one(c.policyQuestion), policyApproved,
      policyContact: c.policyContactQuestion && a[c.policyContactQuestion] !== undefined ? one(c.policyContactQuestion) : null,
      dataTypes: many(c.dataQuestion), errorCost: one(c.errorCostQuestion), reviewPractice: one(c.reviewQuestion), approvalRights: one(c.approvalQuestion),
    },
    safety: {
      mode: syntheticOnly ? "synthetic_only" : "approved_tools_public_data",
      appliedRules: applied.map((r) => ({ id: r.id, action: r.action })),
      effects, aiToolUseInPractice: !syntheticOnly, realEmployerDataAllowed: false, mandatorySlots,
      prohibitedInferences: PROHIBITED_INFERENCES,
    },
    learning: {
      sessionMinutes: b.paceMinutes[one(b.paceQuestion)] ?? null,
      goals: many(b.goalQuestion), obstacle: one(b.obstacleQuestion),
      taskFrequency: one(b.frequencyQuestion), taskDuration: one(b.durationQuestion),
    },
  };
}

/** Public question set for a UI: no internal task IDs beyond option values, no scoring rules. */
export function questionnaire(ctx: DiagnosticContext) {
  const view = (q: DiagnosticQuestion) => ({
    id: q.id, section: q.section, prompt: q.prompt, help: q.help, why: q.why, kind: q.kind,
    options: q.options, minSelected: q.minSelected ?? null, maxSelected: q.maxSelected ?? null,
    exclusiveOptions: q.exclusiveOptions ?? [], allowOption: q.allowOption ? { value: q.allowOption, label: q.allowOptionLabel ?? "" } : null,
    showWhen: q.showWhen ?? null,
  });
  return {
    professionId: ctx.professionId, diagnosticVersion: ctx.definition.schemaVersion,
    maxTotalQuestions: ctx.definition.maxTotalQuestions, noFreeText: true as const,
    questions: ctx.definition.primaryQuestions.map(view), followUps: ctx.definition.followUps.map(view),
  };
}
