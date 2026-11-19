// Cross-lesson consistency of SAL-01, SAL-03 and SAL-04 (integration branch: needs all three lesson PRs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const j = (p) => JSON.parse(readFileSync(p, "utf8"));
const l1 = j("content/career/v3/lessons/SAL-01.json");
const l3 = j("content/career/v3/lessons/SAL-03.json");
const l4 = j("content/career/v3/lessons/SAL-04.json");
const p3 = j("content/career/v3/materials/sal-03/SAL-03/practice-data.json");
const p4 = j("content/career/v3/materials/sal-04/SAL-04/practice-data.json");
const role = j("content/career/v3/roles/sales-manager.json");

test("SAL-03 and SAL-04 share one fictional price list and the fictional 5% limit", () => {
  for (const k of ["pricePerSeatMonth", "implementation", "includedTrainingSessions", "managerDiscountLimitPercent", "managerDiscountLimitSource"]) {
    assert.deepEqual(p4.priceList[k], p3.priceList[k], k);
  }
  assert.equal(p4.exercises[1].answerKey.numbers.offerTotal, p3.exercises[1].answerKey.numbers.firstYearTotal, "SAL-04 continues the SAL-03 offer");
});

test("scenarios S01, S03, S04: lessons serve their own scenario and tasks do not overlap", () => {
  const sc = (id) => role.scenarios.find((s) => s.id === id);
  assert.deepEqual([l1.audience.scenarioId, l3.audience.scenarioId, l4.audience.scenarioId], ["S01", "S03", "S04"]);
  for (const l of [l1, l3, l4]) for (const t of l.audience.taskIds) assert.ok(sc(l.audience.scenarioId).taskIds.includes(t), `${l.id}: ${t}`);
  const t3 = new Set(l3.audience.taskIds), t4 = new Set(l4.audience.taskIds), t1 = new Set(l1.audience.taskIds);
  for (const t of t4) assert.ok(!t3.has(t) && !t1.has(t), `task ${t} shared`);
});

test("IDs of exercises, templates, quiz items and downloads are unique across the three lessons", () => {
  const ids = [l1, l3, l4].flatMap((l) => [...l.content.exercises, ...l.content.templates, ...l.content.quiz, ...l.content.workedExamples, ...l.content.procedure, ...l.downloads].map((x) => x.id));
  assert.equal(new Set(ids).size, ids.length);
});
