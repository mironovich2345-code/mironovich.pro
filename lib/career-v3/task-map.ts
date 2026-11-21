// Personal task map (#45). Built from a validated diagnostic result, the role matrix and the
// delivered lesson library. Every statement is traceable to the matrix, the user's answers or the
// safety rules; nothing is generated. Lesson links only point to delivered (approved) lessons.
import type { DiagnosticAnswers } from "./types.ts";
import type { DiagnosticResultV3 } from "./diagnostic.ts";
import type { LessonRef, TaskMapItem, TaskMapV3 } from "./contracts.ts";
import type { LibraryIndex, PublishedLesson } from "./types.ts";
import { currentVersions, metricRef, resultOutdatedReasons, type EngineContext } from "./engine.ts";

export const TASK_MAP_MODEL = "career-v3-task-map/1";

const DECISION_LABEL: Record<TaskMapItem["decision"], string> = {
  ai_can_take_part: "По матрице профессии: ИИ может выполнять часть работы при разрешённых условиях",
  ai_assists: "По матрице профессии: ИИ помогает подготовить черновик, человек проверяет и решает",
  human_decides: "По матрице профессии: решение принимает человек; ИИ — только справочная подготовка",
};
const WORK_USE_LABEL: Record<TaskMapItem["workUse"], string> = {
  allowed_with_review: "На работе: только разрешёнными компанией инструментами, на общедоступных или учебных данных и с проверкой человеком.",
  not_until_rules_confirmed: "На работе ИИ для этой задачи пока не применяется: сначала подтвердите правила компании. Сейчас — только учебная практика на вымышленных данных.",
  not_allowed: "В вашей компании ИИ запрещён: для рабочих задач его не используйте. Навык отрабатывается вручную на учебных примерах.",
};
const DRIVER_LABEL: Record<string, string> = {
  speed: "скорость", quality: "качество", conversion: "конверсия", revenue: "выручка",
  risk: "снижение рисков", retention: "удержание клиентов",
};

export class OutdatedResultError extends Error {
  reasons: string[];
  constructor(reasons: string[]) { super("diagnostic result is outdated: " + reasons.join(", ")); this.reasons = reasons; }
}

export function lessonFits(l: PublishedLesson, result: DiagnosticResultV3) {
  return l.subtypeIds.includes(result.profile.subtype) && l.levels.includes(result.profile.level);
}

export function lessonRefsForTask(library: LibraryIndex, result: DiagnosticResultV3, taskId: string): LessonRef[] {
  if (library.availability.status !== "available") return [];
  return library.published
    .filter((l) => l.taskIds.includes(taskId) && lessonFits(l, result))
    .map((l) => ({ lessonId: l.id, version: l.version, exerciseIds: l.exerciseIds, title: l.title }));
}

export function buildTaskMap(ctx: EngineContext, input: { result: DiagnosticResultV3; answers: DiagnosticAnswers; library: LibraryIndex; today: string }): TaskMapV3 {
  const { result, answers, library } = input;
  const outdated = resultOutdatedReasons(ctx, result);
  if (outdated.length) throw new OutdatedResultError(outdated);
  const v = currentVersions(ctx);
  const effects = new Set(result.safety.effects);
  const ruleIds = result.safety.appliedRules.map((r) => r.id);

  const tasks: TaskMapItem[] = result.tasks.selected.map((focus) => {
    const t = ctx.role.tasks.find((x) => x.id === focus.taskId)!;
    const drivers = t.valueDrivers.map((d) => DRIVER_LABEL[d] ?? d).join(", ");
    // The commitments rule is a mandatory check (below), not repeated as a company restriction.
    const company: string[] = focus.restrictions.filter((r) => !/уполномоченн/.test(r));
    if (!result.company.policyApproved) company.push("Правила компании по ИИ не подтверждены: сначала уточнить, какие инструменты и данные разрешены.");
    if (!result.company.toolsAvailable || result.company.aiProhibited) company.push("Рабочие ИИ-инструменты недоступны или запрещены: учебные задания выполняются вручную.");
    const risks: string[] = [];
    if (t.mode === "human") risks.push(`Ответственность не передаётся ИИ: ${t.humanResponsibility}.`);
    if (t.mode === "conditional" && !focus.automationAllowed) risks.push("Автоматическое выполнение без проверки может изменить данные клиента или CRM — поэтому отключено.");
    if (effects.has("human_review_required")) risks.push(ctx.role.constraints?.whenHighRisk ?? "Высокая цена ошибки: только учебная репетиция и проверка человеком.");
    if (focus.commitmentsNeedApproval) risks.push("Риск пообещать клиенту неутверждённые цены, скидки или сроки.");
    if (t.valueDrivers.includes("risk")) risks.push("Ошибка в этой задаче влияет на риски компании.");
    risks.push("ИИ может уверенно ошибаться: факты, даты, суммы и имена проверяются по исходным данным.");
    const checks = [`Человек отвечает за: ${t.humanResponsibility}.`, "Сверить результат с исходными данными до использования."];
    if (focus.commitmentsNeedApproval) checks.push("Цены, скидки и обязательства — только после подтверждения уполномоченным сотрудником.");
    if (effects.has("no_real_data_upload") || result.safety.mode === "synthetic_only") checks.push("Перед любым запросом к ИИ убедиться, что в нём нет данных работодателя и клиентов.");
    const skill = ctx.role.skills.find((s) => s.id === t.skillId);
    const workUse: TaskMapItem["workUse"] = result.company.aiProhibited ? "not_allowed"
      : result.safety.mode === "approved_tools_public_data" ? "allowed_with_review" : "not_until_rules_confirmed";
    return {
      taskId: t.id, title: t.title,
      explanation: `${t.title}. Ценность для компании: ${drivers}. Условия применения ИИ: ${t.prerequisites}.`,
      decision: focus.decision, decisionLabel: DECISION_LABEL[focus.decision],
      workUse, workUseLabel: WORK_USE_LABEL[workUse],
      basis: { roleMode: t.mode, modeMeaning: t.modeMeaning, humanResponsibility: t.humanResponsibility,
        tightenedBySafety: t.mode === "conditional" && focus.decision !== "ai_can_take_part", safetyRules: ruleIds },
      companyRestrictions: [...new Set(company)], risks, mandatoryChecks: checks,
      skill: skill ? { skillId: skill.id, name: skill.name, why: skill.why } : null,
      metric: metricRef(ctx, t.metricId),
      lessonRefs: lessonRefsForTask(library, result, t.id),
    };
  });

  const basis = ctx.engine.developmentBasisSignals
    .filter((b) => { const a = answers[b.questionId]; return (Array.isArray(a) ? a : [a]).some((x) => typeof x === "string" && b.values.includes(x)); })
    .map((b) => ({ id: b.id, label: b.label, skillId: b.skillId, source: "self_reported_answer" as const, answer: `${b.questionId}: ${String(answers[b.questionId])}` }));

  const growth = new Map<string, string[]>();
  const add = (skillId: string, reason: string) => growth.set(skillId, [...(growth.get(skillId) ?? []), reason]);
  for (const t of tasks) if (t.skill) add(t.skill.skillId, `задача ${t.taskId}`);
  if (result.safety.mode === "synthetic_only") add("responsible_automation", "правила безопасности ограничивают применение ИИ");
  if (result.measurement.baselineRequired) add("impact_storytelling", "нет исходных замеров «было»");
  const skillIds = new Set(ctx.role.skills.map((s) => s.id));
  const growthSkills = [...growth.entries()].filter(([id]) => skillIds.has(id)).map(([skillId, reasons]) => {
    const s = ctx.role.skills.find((x) => x.id === skillId)!;
    const refs = library.availability.status === "available"
      ? library.published.filter((l) => lessonFits(l, result) && tasks.some((t) => t.skill?.skillId === skillId && l.taskIds.includes(t.taskId)))
        .map((l) => ({ lessonId: l.id, version: l.version, exerciseIds: l.exerciseIds, title: l.title }))
      : [];
    return { skillId, name: s.name, why: s.why, reasons, lessonRefs: refs };
  });

  return {
    modelVersion: TASK_MAP_MODEL,
    professionId: ctx.professionId,
    builtOn: input.today,
    versions: { diagnostic: v.diagnostic, role: v.role, program: library.programVersion, library: library.librarySignature, resultModel: v.resultModel },
    status: tasks.length ? "ready" : "unavailable",
    unavailableReason: tasks.length ? null : "no_tasks_selected",
    tasks,
    fallback: result.tasks.fallback,
    developmentBasis: basis.length
      ? { status: "answer_based", items: basis,
        note: "Это опоры для развития по вашим собственным ответам анкеты, а не подтверждённая оценка профессиональных сильных сторон. Подтверждение появится только в выполненных заданиях и ваших замерах." }
      : { status: "no_basis", items: [],
        note: "По ответам анкеты пока нет оснований выделить опоры для развития. Они могут появиться после выполненных заданий и собственных замеров." },
    level: { id: result.profile.level, ...ctx.engine.levelProfiles[result.profile.level] },
    growthSkills,
    learningRoute: library.availability.status === "available"
      ? { status: "available", reason: null, message: null }
      : { status: "unavailable", reason: library.availability.reason, message: library.availability.message },
  };
}

/** Reasons why a stored map no longer matches current content (empty = up to date). */
export function taskMapStaleReasons(map: TaskMapV3, ctx: EngineContext, library: LibraryIndex): string[] {
  const v = currentVersions(ctx);
  const r: string[] = [];
  if (map.modelVersion !== TASK_MAP_MODEL) r.push("task_map_model_changed");
  if (map.versions.diagnostic !== v.diagnostic) r.push("diagnostic_version_changed");
  if (map.versions.role !== v.role) r.push("role_matrix_version_changed");
  if (map.versions.resultModel !== v.resultModel) r.push("result_model_changed");
  if (map.versions.program !== library.programVersion) r.push("program_version_changed");
  if (map.versions.library !== library.librarySignature) r.push("delivered_lessons_changed");
  return r;
}
