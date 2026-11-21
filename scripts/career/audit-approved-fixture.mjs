#!/usr/bin/env node
// AUDIT ONLY (#49). Writes the git-ignored local fixture .career-v3-fixture/library.json from the REAL written
// lessons, temporarily marked approved INSIDE THE FIXTURE so the full 30-step path can be exercised on real texts.
// Content files are not touched; the server reads the fixture only with CAREER_V3_FIXTURE_LIBRARY=1 on a local
// synthetic sandbox (lib/server/career-v3/dev-modes.ts). `remove` deletes it.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";

const DIR = ".career-v3-fixture";
if (process.argv[2] === "remove") { rmSync(DIR, { recursive: true, force: true }); console.log("REMOVED " + DIR); process.exit(0); }
const today = new Date().toISOString().slice(0, 10);
const j = (p) => JSON.parse(readFileSync(p, "utf8"));
const curriculum = j("content/career/v3/curriculum.json");
const lessons = readdirSync("content/career/v3/lessons").filter((f) => f.endsWith(".json")).map((f) => ({ path: `content/career/v3/lessons/${f}`, document: j(`content/career/v3/lessons/${f}`) }));
const written = new Set(lessons.map((l) => l.document.id));
for (const l of lessons) {
  const d = l.document;
  if (d.status !== "review") throw new Error(`${d.id}: expected review in content, got ${d.status}`);
  d.status = "approved"; d.quality = { ...d.quality, reviewedOn: today, canBePublished: true, reviewer: "AUDIT FIXTURE ONLY — not an editorial approval" };
  d.sourcePolicy = { ...d.sourcePolicy, factualClaimsChecked: true };
}
for (const s of curriculum.slots) if (written.has(s.id)) { s.status = "published"; s.publishedLessonId = s.id; }
const planCandidates = readdirSync("content/career/v3/plan-candidates").filter((f) => f.endsWith(".json")).map((f) => ({ path: `content/career/v3/plan-candidates/${f}`, document: j(`content/career/v3/plan-candidates/${f}`) }));
const downloadPaths = [...new Set(lessons.flatMap((l) => l.document.downloads.map((d) => d.repositoryPath)))].filter((p) => existsSync(p));
mkdirSync(DIR, { recursive: true });
writeFileSync(`${DIR}/library.json`, JSON.stringify({
  syntheticFixture: true, notForUsers: true,
  note: "AUDIT #49: real review lessons temporarily approved in a git-ignored local test fixture. Not an editorial or legal approval.",
  curriculum, lessons, planCandidates, downloadPaths,
}));
console.log(`WROTE ${DIR}/library.json (${lessons.length} real lessons approved in the fixture only, ${planCandidates.length} candidate files, ${downloadPaths.length} downloads)`);
