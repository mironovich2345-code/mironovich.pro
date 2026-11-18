import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("content/career/v3/roles/sales-manager.json", "utf8");
const role = JSON.parse(src);
const doc = readFileSync("docs/products/ai-career-v3/role-sales-matrix.md", "utf8");
const unique = values => new Set(values).size === values.length;
const has = (array, id) => array.some(item => item.id === id);

test("sales role matrix has exactly three subtypes, twenty-four tasks and seven professional scenarios", () => {
  assert.equal(role.roleId, "sales_manager");
  assert.equal(role.subtypes.length, 3);
  assert.deepEqual(role.subtypes.map(s => s.id).sort(), ["account", "inbound", "outbound_b2b"]);
  assert.equal(role.tasks.length, 24);
  assert.equal(role.scenarios.length, 7);
  assert.equal(role.metrics.length, 11);
  assert.equal(role.skills.length, 8);
  for (const section of ["subtypes", "tasks", "scenarios", "metrics", "skills"])
    assert.ok(unique(role[section].map(item => item.id)), section + " has duplicate IDs");
  assert.deepEqual(role.scenarios.map(s => s.id), ["S01","S02","S03","S04","S05","S06","S07"]);
});

test("each work task has an explicit role, decision boundary, business value, metric, scenario and skill", () => {
  const modes = ["conditional", "assist", "human"];
  for (const t of role.tasks) {
    assert.match(t.id, /^T\d{2}$/);
    for (const value of ["title", "prerequisites", "humanResponsibility", "modeMeaning"])
      assert.ok(typeof t[value] === "string" && t[value].trim().length >= 9, t.id + ": " + value);
    assert.ok(modes.includes(t.mode), t.id + ": unknown mode");
    assert.ok(typeof t.stage === "string" && t.stage.length >= 3, t.id + ": missing sales stage");
    assert.ok(t.subtypeIds.length >= 1 && t.subtypeIds.every(id => has(role.subtypes, id)), t.id + ": subtype");
    assert.ok(t.valueDrivers.length >= 1, t.id + ": missing company impact");
    assert.ok(has(role.metrics, t.metricId), t.id + ": metric reference");
    assert.ok(has(role.scenarios, t.scenarioId), t.id + ": scenario reference");
    assert.ok(role.scenarios.find(s => s.id === t.scenarioId).taskIds.includes(t.id), t.id + ": reverse scenario reference");
    assert.ok(has(role.skills, t.skillId), t.id + ": skill reference");
    assert.equal(t.exampleType, "synthetic_only", t.id + ": production data must be prohibited");
    assert.match(doc, new RegExp("\\| " + t.id + " \\|"), t.id + " absent from human-readable matrix");
  }
  for (const sub of role.subtypes) {
    assert.ok(role.tasks.filter(t => t.subtypeIds.includes(sub.id)).length >= 7, "subtype has insufficient task coverage");
    assert.ok(sub.primaryMetrics.length >= 3);
    assert.ok(sub.primaryMetrics.every(id => has(role.metrics, id)));
  }
  for (const mode of modes)
    assert.ok(role.tasks.some(t=>t.mode===mode), "missing automation category " + mode);
  for (const skill of role.skills)
    assert.ok(role.tasks.some(t => t.skillId === skill.id), "orphaned skill " + skill.id);
});

test("seven teaching scenarios are grounded in canonical tasks and assessable artefacts", () => {
  for (const s of role.scenarios) {
    assert.ok(s.taskIds.length >= 2 && s.taskIds.every(id => has(role.tasks, id)), s.id + ": task reference");
    assert.ok(has(role.metrics, s.metricId), s.id + ": metric");
    assert.ok(s.input.length >= 30, s.id + ": missing safe example");
    assert.ok(s.artifact.length >= 25, s.id + ": missing deliverable");
    assert.ok(s.review.length >= 30, s.id + ": missing human checks");
    assert.ok(s.difficulty.includes("experienced"));
    assert.match(doc, new RegExp("\\| " + s.id + " \\|"));
  }
});

test("sales matrix never claims guaranteed job security and keeps sensitive data away from test AI", () => {
  assert.ok(role.constraints.neverUpload.length >= 3);
  assert.match(role.constraints.whenNotApproved, /вымышленн/);
  assert.match(role.constraints.whenHighRisk, /проверка человеком/);
  assert.match(doc, /не гарантирует|неавтоматизируемости|не вычисляется и не обещается/);
  assert.match(doc, /не передавать реальных личных данных/);
  assert.doesNotMatch(doc, /[0-9]+% вероятности увольнения/i);
  assert.doesNotMatch(src, /@(?:gmail|yandex|mail)\.(?:com|ru)/);
});

test("diagnostic and pedagogical next steps are specified and research limitations disclosed", () => {
  assert.ok(role.diagnosticSignals.length >= 12);
  assert.ok(role.methodologicalSources.length >= 4);
  for (const s of role.methodologicalSources) {
    assert.match(s.url, /^https:\/\//);
    assert.ok(s.note.length > 25);
  }
  assert.match(doc, /Что ещё не подтверждено/);
  assert.match(doc, /внешние основания/);
  assert.match(doc, /B2B/);
  assert.match(doc, /Входящие/);
  assert.match(doc, /Действующие/);
  assert.match(doc, /Семь профессиональных учебных сценариев/);
});
