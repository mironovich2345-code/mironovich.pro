// SYNTHETIC FIXTURE — approved-looking lesson library that exists ONLY inside tests.
// Built in memory from the prototype lesson; never written to content/ and never readable by the
// server loader (lib/server/career-v3/content.ts reads only content/career/v3/). Texts are
// placeholders for engine tests, not teaching material.
import { readFileSync } from "node:fs";

const load = (p) => JSON.parse(readFileSync(p, "utf8"));
export const FIXTURE_MARK = "[SYNTHETIC FIXTURE]";
export const FIXTURE_DOWNLOAD = "content/career/v3/examples/safety-lesson.prototype.json";

const prototype = load("content/career/v3/examples/safety-lesson.prototype.json");
const realCurriculum = load("content/career/v3/curriculum.json");
const role = load("content/career/v3/roles/sales-manager.json");

const TEMPLATE_KINDS = {
  safety: ["checklist", "script"],
  task_mapping: ["script", "checklist"],
  practice: ["prompt", "script", "checklist", "measurement_sheet"],
  trends: ["script", "checklist"],
  value: ["measurement_sheet", "script"],
};
// [exerciseIndex, templateIndex] per plan-step candidate, by module.
// The first step of an exercise performs it; a later step of the same exercise is a follow-up
// (checklist → verification, measurement sheet → measurement), as in the real lessons.
const STEP_PLAN = {
  safety: [[0, 0], [1, 1]],
  task_mapping: [[0, 0], [0, 1]],
  practice: [[0, 0], [0, 2], [1, 1], [1, 3], [2, 1]],
  trends: [[0, 0], [1, 1]],
  value: [[0, 1], [0, 0]],
};
const LEVELS = {
  "SAL-06": ["independent", "experienced"], "SAL-07": ["independent", "experienced"],
  "MAP-04": ["independent", "experienced"], "TRD-03": ["experienced"], "VAL-05": ["experienced"],
};
const PREREQS = { "VAL-02": ["VAL-01"], "MAP-02": ["MAP-01"] };

function lessonFor(slot) {
  const l = structuredClone(prototype);
  const tag = slot.id.replace("-", "");
  const kinds = TEMPLATE_KINDS[slot.moduleId];
  const scenario = slot.scenarioId ? role.scenarios.find((s) => s.id === slot.scenarioId) : null;
  l.id = slot.id;
  l.version = "1.0.0";
  l.status = "approved";
  l.moduleId = slot.moduleId;
  l.title = `${FIXTURE_MARK} ${slot.title}`;
  l.audience.scenarioId = slot.scenarioId;
  l.audience.taskIds = scenario ? scenario.taskIds : [];
  l.audience.subtypeIds = scenario
    ? [...new Set(scenario.taskIds.flatMap((t) => role.tasks.find((x) => x.id === t).subtypeIds))]
    : ["outbound_b2b", "inbound", "account"];
  l.audience.levels = LEVELS[slot.id] ?? ["starter", "independent", "experienced"];
  l.prerequisites = slot.moduleId === "safety" ? [] : (PREREQS[slot.id] ?? ["SAF-01"]);
  l.durationMinutes = slot.moduleId === "practice" ? 40 : 20;
  const exCount = slot.moduleId === "practice" ? 3 : 2;
  const baseEx = l.content.exercises[0];
  l.content.exercises = Array.from({ length: exCount }, (_, i) => ({ ...structuredClone(baseEx), id: `${tag}-TASK-${i + 1}`, title: `${FIXTURE_MARK} упражнение ${i + 1}: ${slot.title}` }));
  const baseTpl = l.content.templates[0];
  l.content.templates = kinds.map((kind, i) => ({ ...structuredClone(baseTpl), id: `TPL-${tag}-${i + 1}`, kind, title: `${FIXTURE_MARK} шаблон ${kind} для ${slot.id}` }));
  l.quality = { ...l.quality, reviewer: "Синтетическая фикстура тестов", reviewedOn: "2026-11-18", canBePublished: true };
  l.sourcePolicy = { factualClaimsChecked: true, timeSensitive: true, nextReviewOn: "2027-05-18" };
  l.downloads = [{ id: `DL-FX-${tag}`, title: "Синтетическая фикстура для тестов движка", kind: "worksheet", repositoryPath: FIXTURE_DOWNLOAD }];
  return l;
}

function candidatesFor(lesson, slot) {
  return STEP_PLAN[slot.moduleId].map(([ex, tpl], i) => {
    const exercise = lesson.content.exercises[ex];
    const template = lesson.content.templates[tpl];
    return {
      stepId: "STEP-" + String(i + 1).padStart(2, "0"),
      position: i + 1,
      lessonId: lesson.id,
      exerciseId: exercise.id,
      linkedTaskId: lesson.audience.taskIds[0] ?? null,
      learningGoal: `${FIXTURE_MARK} цель шага ${i + 1} урока ${slot.id}: освоить приём «${slot.title}».`,
      action: `${FIXTURE_MARK} Выполните ${exercise.id} урока ${slot.id} по шаблону ${template.id} (${template.kind}) на вымышленных данных и сверьте результат с критериями.`,
      templateId: template.id,
      expectedArtifact: `${FIXTURE_MARK} проверенный учебный артефакт ${exercise.id} (${template.kind}).`,
      completionCriteria: [
        `${FIXTURE_MARK} артефакт ${exercise.id} соответствует критериям урока ${slot.id}.`,
        `${FIXTURE_MARK} в артефакте нет реальных данных клиентов и работодателя.`,
        `${FIXTURE_MARK} спорные утверждения отмечены для проверки человеком.`,
      ],
      metricId: template.kind === "measurement_sheet" ? (slot.scenarioId ? role.scenarios.find((s) => s.id === slot.scenarioId).metricId : "report_quality") : "error_rate",
      safetyNote: `${FIXTURE_MARK} только вымышленные данные; при запрете ИИ задание выполняется вручную, результат проверяет человек.`,
      isCalendarDay: false,
    };
  });
}

/** Full approved fixture: every curriculum slot published with a synthetic lesson. Options drop slots. */
export function fixtureLibrarySources({ dropSlots = [], dropModules = [] } = {}) {
  const curriculum = structuredClone(realCurriculum);
  const lessons = [], planSteps = [];
  for (const slot of curriculum.slots) {
    if (dropSlots.includes(slot.id) || dropModules.includes(slot.moduleId)) continue;
    const lesson = lessonFor(slot);
    lessons.push(lesson);
    planSteps.push(...candidatesFor(lesson, slot));
    slot.status = "published";
    slot.publishedLessonId = slot.id;
  }
  return {
    curriculum,
    lessons: lessons.map((document) => ({ path: `fixture/${document.id}.json`, document })),
    planCandidates: [{ path: "fixture/plan-candidates.json", document: { syntheticFixture: true, steps: planSteps } }],
    fileExists: (p) => p === FIXTURE_DOWNLOAD,
  };
}
