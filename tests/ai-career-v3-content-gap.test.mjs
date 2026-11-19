// Reproducible content-gap calculation (integration branch only: needs the engine and all lesson PRs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { computeContentGap, renderContentGap, GROWTH, OUT } from "../scripts/career/report-v3-content-gap.mjs";
import { loadProfessionBundle } from "../lib/server/career-v3/content.ts";
import { FIXTURE_MARK } from "./fixtures/career-v3/fixture-library.mjs";

const TODAY = "2026-11-19";
const g = computeContentGap({ today: TODAY });
const by = (rows) => Object.fromEntries(rows.map((r) => [r.id.replace("FX-", ""), r.steps]));

test("calculation is deterministic and the committed report matches it", () => {
  assert.deepEqual(computeContentGap({ today: TODAY }), g);
  assert.equal(readFileSync(OUT, "utf8"), renderContentGap(g));
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/career/report-v3-content-gap.mjs", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("the date is a parameter: sources checked after the calculation date are withheld", () => {
  assert.throws(() => computeContentGap({ today: "19.11.2026" }), /YYYY-MM-DD/);
  const earlier = computeContentGap({ today: "2026-11-18" });
  const withheld = earlier.whatIf.withheld.map((w) => w.id);
  assert.ok(withheld.includes("SAL-03") && withheld.includes("SAL-04"), "SAL-03/04 sources were checked on 2026-11-19");
  assert.ok(earlier.whatIf.withheld.every((w) => w.exclusions.includes("unverified_sources")));
  assert.equal(g.whatIf.withheld.length, 0, "on the check date every written lesson is deliverable once approved");
});

test("all written lessons and all step candidates take part", () => {
  assert.deepEqual(g.written, ["MAP-01", "SAF-01", "SAF-02", "SAF-03", "SAF-04", "SAL-01", "SAL-02", "SAL-03", "SAL-04", "SAL-05", "TRD-01", "VAL-01"]);
  assert.equal(g.stepCount, 39);
  assert.deepEqual(g.orphanSteps, []);
  assert.deepEqual(g.whatIf.deliverable.sort(), g.written);
});

test("actual state is reported separately: nothing is approved, no profile gets a route", () => {
  assert.deepEqual(g.actual.deliverable, []);
  for (const e of g.actual.entries) assert.equal(e.status, "review");
  for (const p of g.actual.profiles) { assert.equal(p.steps, 0); assert.equal(p.selection, "unavailable"); }
});

test("hypothesis: steps per profile if every written lesson were approved", () => {
  assert.deepEqual(by(g.whatIf.profiles), {
    "b2b-experienced-public-tools": 27, "inbound-starter": 22, "account-ai-prohibited": 23, "account-approved": 23,
    "no-policy": 27, "no-baseline": 27, "high-error-cost": 23, "mixed-duties": 30, "minimal-time": 23,
  });
  const lessonsOf = (id) => g.whatIf.profiles.find((p) => p.id === id).lessons;
  assert.ok(lessonsOf("FX-high-error-cost").includes("SAL-03"), "SAL-03 fills the proposal profile");
  assert.ok(lessonsOf("FX-b2b-experienced-public-tools").includes("SAL-03") && lessonsOf("FX-b2b-experienced-public-tools").includes("SAL-04"));
});

test("stand-ins are created only for missing lessons and never reach the actual or hypothetical sections", () => {
  const written = new Set(g.written);
  for (const s of g.growth) {
    for (const id of s.stubs) assert.ok(!written.has(id), `stand-in for written lesson ${id}`);
    const wanted = GROWTH.find(([label]) => label === s.label)[1];
    assert.deepEqual([...s.stubs].sort(), wanted.filter((id) => !written.has(id)).sort());
  }
  for (const p of [...g.actual.profiles, ...g.whatIf.profiles]) for (const id of p.lessons) assert.ok(written.has(id), `${id} is not a written lesson`);
  // Real delivery: the server bundle reads only content/career/v3 and holds no stand-in.
  const b = loadProfessionBundle("sales_manager", TODAY);
  for (const [, doc] of b.lessonDocuments) assert.ok(!JSON.stringify(doc).includes(FIXTURE_MARK));
});

test("growth estimate: what still separates each profile from 30 steps", () => {
  const [sal07, plus2] = g.growth;
  assert.deepEqual(sal07.stubs, ["SAL-07"]);
  assert.equal(by(g.profiles.map((p, i) => ({ id: p.id, steps: sal07.steps[i] })))["b2b-experienced-public-tools"], 30);
  assert.ok(plus2.steps.filter((x) => x === 30).length >= 7);
});
