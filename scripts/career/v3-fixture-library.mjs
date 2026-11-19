#!/usr/bin/env node
// Writes the in-test SYNTHETIC FIXTURE library to .career-v3-fixture/library.json (git-ignored)
// for local browser tests of the v3 cabinet. The server reads it only when CAREER_V3_FIXTURE_LIBRARY=1
// on a local synthetic sandbox (lib/server/career-v3/dev-modes.ts). `remove` deletes it.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fixtureLibrarySources, FIXTURE_DOWNLOAD } from "../../tests/fixtures/career-v3/fixture-library.mjs";

const DIR = ".career-v3-fixture";
if (process.argv[2] === "remove") {
  rmSync(DIR, { recursive: true, force: true });
  console.log("REMOVED " + DIR);
} else {
  const src = fixtureLibrarySources();
  mkdirSync(DIR, { recursive: true });
  writeFileSync(`${DIR}/library.json`, JSON.stringify({
    syntheticFixture: true, notForUsers: true,
    note: "SYNTHETIC FIXTURE for local browser tests only. Not teaching material.",
    curriculum: src.curriculum, lessons: src.lessons, planCandidates: src.planCandidates, downloadPaths: [FIXTURE_DOWNLOAD],
  }));
  console.log(`WROTE ${DIR}/library.json (${src.lessons.length} fixture lessons)`);
}
