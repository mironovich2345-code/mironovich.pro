// AI Career 3.0 lesson library: validates lesson files and decides, per lesson, whether it may be
// delivered to a learner. Pure function: the server adapter supplies files; tests supply fixtures.
//
// Delivery gate (all must hold): status "approved"; quality.canBePublished; reviewedOn recorded and
// not in the future; factual claims checked with dated https sources; time-sensitive content within
// its review date; downloads exist; the curriculum slot explicitly points to this lesson
// (publishedLessonId + status "published"); references to role, tasks, scenario, prerequisites,
// exercises and templates resolve; employer data stays prohibited and human review stays mandatory.
// A draftLessonId on a slot never counts as publication.
import { isIsoDate, schemaIssues } from "./json-schema.ts";
import type {
  ContentIssue, CurriculumSlot, ExclusionReason, LessonDocument, LessonEntry, LibraryIndex,
  LibrarySources, PlanStepCandidate, PublishedLesson,
} from "./types.ts";

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const STATUS_REASON: Record<string, ExclusionReason> = {
  prototype: "prototype", draft: "draft", review: "review_pending", retired: "retired",
};

export const UNAVAILABLE_MESSAGE =
  "Утверждённых уроков программы v3 пока нет: материалы находятся на редакционной и правовой приёмке. " +
  "Обучение не подменяется вымышленным содержанием.";

function slotFor(slots: CurriculumSlot[], lessonId: string): CurriculumSlot | null {
  return slots.find((s) => s.publishedLessonId === lessonId)
    ?? slots.find((s) => s.id === lessonId)
    ?? slots.find((s) => lessonId.startsWith(s.id + "-"))
    ?? null;
}

export function buildLibrary(src: LibrarySources): LibraryIndex {
  const issues: ContentIssue[] = [];
  const err = (code: string, path: string, message: string) => issues.push({ severity: "error", code, path, message });
  const warn = (code: string, path: string, message: string) => issues.push({ severity: "warning", code, path, message });
  const { curriculum, role } = src;
  let globalBroken = false;

  if (curriculum.roleId !== role.roleId) {
    err("role_mismatch", "curriculum.roleId", `curriculum is for ${curriculum.roleId}, role matrix is ${role.roleId}`);
    globalBroken = true;
  }
  const moduleIds = new Set(curriculum.modules.map((m) => m.id));
  const slotIds = new Set(curriculum.slots.map((s) => s.id));
  if (slotIds.size !== curriculum.slots.length) { err("duplicate_slot", "curriculum.slots", "duplicate slot IDs"); globalBroken = true; }
  for (const s of curriculum.slots) {
    if (!moduleIds.has(s.moduleId)) { err("unknown_module", `slot ${s.id}`, `unknown module ${s.moduleId}`); globalBroken = true; }
    if (s.scenarioId !== null && !role.scenarios.some((x) => x.id === s.scenarioId)) {
      err("unknown_scenario", `slot ${s.id}`, `unknown scenario ${s.scenarioId}`); globalBroken = true;
    }
  }
  const taskIds = new Set(role.tasks.map((t) => t.id));
  const metricIds = new Set(role.metrics.map((m) => m.id));

  // --- lessons ---
  const byId = new Map<string, number>();
  for (const f of src.lessons) {
    const id = isObject(f.document) && typeof f.document.id === "string" ? f.document.id : f.path;
    byId.set(id, (byId.get(id) ?? 0) + 1);
  }
  const entries: LessonEntry[] = [];
  const docs = new Map<string, LessonDocument>();
  for (const f of src.lessons) {
    const raw = f.document;
    const id = isObject(raw) && typeof raw.id === "string" ? raw.id : f.path;
    const reasons = new Set<ExclusionReason>();
    const add = (r: ExclusionReason) => reasons.add(r);
    const schema = isObject(raw) ? schemaIssues(src.lessonSchema, raw, id) : [id + ": not an object"];
    if (schema.length) {
      add("schema_invalid");
      for (const m of schema.slice(0, 20)) err("schema_invalid", f.path, m);
    }
    if ((byId.get(id) ?? 0) > 1) { add("duplicate_id"); err("duplicate_id", f.path, `lesson ID ${id} is defined more than once`); }
    if (schema.length) {
      entries.push({ id, version: "unknown", status: "unknown", path: f.path, moduleId: null, slotId: null, deliverable: false, exclusions: [...reasons] });
      continue;
    }
    const doc = raw as unknown as LessonDocument;
    docs.set(id, doc);
    if (doc.status !== "approved") add(STATUS_REASON[doc.status] ?? "not_approved");
    const slot = slotFor(curriculum.slots, id);
    if (!slot) { add("unknown_slot"); err("unknown_slot", f.path, `no curriculum slot for ${id}`); }
    else {
      if (slot.moduleId !== doc.moduleId) { add("broken_reference"); err("module_mismatch", f.path, `module ${doc.moduleId} differs from slot ${slot.id} (${slot.moduleId})`); }
      if (slot.scenarioId !== null && doc.audience.scenarioId !== slot.scenarioId) {
        add("broken_reference"); err("scenario_mismatch", f.path, `scenario ${doc.audience.scenarioId} differs from slot ${slot.scenarioId}`);
      }
      if (!(slot.publishedLessonId === id && slot.status === "published")) add("not_published_in_curriculum");
    }
    if (!doc.audience.roleIds.includes(role.roleId)) add("foreign_role");
    for (const t of doc.audience.taskIds) if (!taskIds.has(t)) { add("broken_reference"); err("unknown_task", f.path, `unknown task ${t}`); }
    if (doc.audience.scenarioId !== null && !role.scenarios.some((s) => s.id === doc.audience.scenarioId)) {
      add("broken_reference"); err("unknown_scenario", f.path, `unknown scenario ${doc.audience.scenarioId}`);
    }
    for (const p of doc.prerequisites) if (!slotIds.has(p)) { add("broken_reference"); err("unknown_prerequisite", f.path, `unknown prerequisite ${p}`); }
    const c = doc.content;
    for (const group of ["exercises", "templates", "workedExamples", "procedure", "quiz"] as const) {
      const ids = (c[group] as { id: string }[]).map((x) => x.id);
      if (new Set(ids).size !== ids.length) { add("broken_reference"); err("duplicate_item", f.path, `duplicate IDs in ${group}`); }
    }
    for (const q of c.quiz) if (!q.options.some((o) => o.id === q.correctId)) { add("broken_reference"); err("quiz_answer", f.path, `quiz ${q.id} has no correct option`); }
    if (doc.security.allowEmployerData !== false) add("employer_data_allowed");
    if (doc.security.requireHumanReview !== true) add("human_review_not_required");
    if (!doc.quality.canBePublished) add("not_publishable");
    if (!doc.quality.reviewedOn || doc.quality.reviewedOn > src.today) add("review_not_recorded");
    const sourcesOk = doc.sourcePolicy.factualClaimsChecked === true && doc.sources.length > 0 &&
      doc.sources.every((s) => /^https:\/\//.test(s.url) && isIsoDate(s.checkedOn) && s.checkedOn <= src.today &&
        (!doc.quality.reviewedOn || s.checkedOn <= doc.quality.reviewedOn));
    if (!sourcesOk) add("unverified_sources");
    if (doc.sourcePolicy.timeSensitive && (!doc.sourcePolicy.nextReviewOn || doc.sourcePolicy.nextReviewOn < src.today)) add("source_review_overdue");
    if (doc.downloads.length === 0 || doc.downloads.some((d) => d.repositoryPath.includes("..") || !src.fileExists(d.repositoryPath))) add("missing_download");
    if (doc.status === "approved" && reasons.size) {
      warn("approved_not_deliverable", f.path, `approved lesson ${id} is withheld: ${[...reasons].join(", ")}`);
    }
    entries.push({ id, version: doc.version, status: doc.status, path: f.path, moduleId: doc.moduleId, slotId: slot?.id ?? null, deliverable: reasons.size === 0, exclusions: [...reasons] });
  }

  // Prerequisites must themselves be deliverable (fixpoint: withdrawing one lesson can cascade).
  let changed = true;
  while (changed) {
    changed = false;
    const deliveredSlots = new Set(entries.filter((e) => e.deliverable).map((e) => e.slotId));
    for (const e of entries.filter((x) => x.deliverable)) {
      const missing = docs.get(e.id)!.prerequisites.filter((p) => !deliveredSlots.has(p));
      if (missing.length) {
        e.deliverable = false;
        e.exclusions.push("broken_reference");
        warn("prerequisite_unavailable", e.path, `prerequisites not delivered: ${missing.join(", ")}`);
        changed = true;
      }
    }
  }

  const published: PublishedLesson[] = entries.filter((e) => e.deliverable).map((e) => {
    const d = docs.get(e.id)!;
    return {
      id: d.id, version: d.version, moduleId: d.moduleId, slotId: e.slotId!, title: d.title,
      scenarioId: d.audience.scenarioId, taskIds: d.audience.taskIds, subtypeIds: d.audience.subtypeIds,
      levels: d.audience.levels, durationMinutes: d.durationMinutes,
      exerciseIds: d.content.exercises.map((x) => x.id), templateIds: d.content.templates.map((x) => x.id), document: d,
    };
  });

  // --- plan-step candidates ---
  const planCandidates: PlanStepCandidate[] = [];
  const knownLessons = new Map(entries.map((e) => [e.id, e]));
  for (const f of src.planCandidates) {
    const steps = isObject(f.document) && Array.isArray(f.document.steps) ? f.document.steps : null;
    if (!steps) { err("plan_file_invalid", f.path, "plan candidate file must contain steps[]"); continue; }
    steps.forEach((raw: unknown, i: number) => {
      const loc = `${f.path}#steps[${i}]`;
      const s = schemaIssues(src.stepSchema, raw, loc);
      if (s.length) { for (const m of s) err("schema_invalid", loc, m); return; }
      const step = raw as PlanStepCandidate;
      const entry = knownLessons.get(step.lessonId);
      const doc = docs.get(step.lessonId);
      if (!entry || !doc) { err("unknown_lesson", loc, `step references missing lesson ${step.lessonId}`); return; }
      if (!doc.content.exercises.some((x) => x.id === step.exerciseId)) { err("unknown_exercise", loc, `missing exercise ${step.exerciseId}`); return; }
      if (!doc.content.templates.some((x) => x.id === step.templateId)) { err("unknown_template", loc, `missing template ${step.templateId}`); return; }
      if (step.linkedTaskId !== null && !taskIds.has(step.linkedTaskId)) { err("unknown_task", loc, `unknown task ${step.linkedTaskId}`); return; }
      if (step.metricId !== null && !metricIds.has(step.metricId)) { err("unknown_metric", loc, `unknown metric ${step.metricId}`); return; }
      if (entry.deliverable) planCandidates.push(step);
    });
  }

  const deliverableBySlot = new Map(entries.filter((e) => e.deliverable).map((e) => [e.slotId, e.id]));
  const slots = curriculum.slots.map((s) => ({
    id: s.id, moduleId: s.moduleId, status: String(s.status), publishedLessonId: s.publishedLessonId,
    deliverableLessonId: deliverableBySlot.get(s.id) ?? null,
  }));
  const availability: LibraryIndex["availability"] = globalBroken
    ? { status: "unavailable", reason: "content_errors", message: "Библиотека v3 содержит структурные ошибки и не выдаётся пользователям." }
    : published.length === 0
      ? { status: "unavailable", reason: "no_approved_lessons", message: UNAVAILABLE_MESSAGE }
      : { status: "available", publishedLessons: published.length };

  return {
    professionId: src.professionId,
    programVersion: `${curriculum.schemaVersion}+role-${role.schemaVersion}`,
    entries, published: globalBroken ? [] : published, planCandidates: globalBroken ? [] : planCandidates,
    issues, slots, availability,
  };
}

/** Only what a learner may receive. Never returns non-deliverable lessons. */
export function learnerCatalog(index: LibraryIndex) {
  if (index.availability.status !== "available") {
    return { professionId: index.professionId, programVersion: index.programVersion, status: "unavailable" as const,
      reason: index.availability.reason, message: index.availability.message, lessons: [] };
  }
  return {
    professionId: index.professionId, programVersion: index.programVersion, status: "available" as const,
    lessons: index.published.map((l) => ({
      id: l.id, version: l.version, moduleId: l.moduleId, slotId: l.slotId, title: l.title, scenarioId: l.scenarioId,
      taskIds: l.taskIds, subtypeIds: l.subtypeIds, levels: l.levels, durationMinutes: l.durationMinutes,
      exerciseIds: l.exerciseIds, templateIds: l.templateIds,
    })),
  };
}

export function lessonForLearner(index: LibraryIndex, lessonId: string): LessonDocument | null {
  return index.published.find((l) => l.id === lessonId)?.document ?? null;
}
