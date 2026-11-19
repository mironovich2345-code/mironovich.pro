import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fixtureLibraryEnabled, reviewPreviewEnabled, localSyntheticSandbox, loadFixtureSources, FIXTURE_FILE } from "../lib/server/career-v3/dev-modes.ts";

const localEnv = (extra = {}) => ({
  CAREER_SANDBOX_ENABLED: "1", CAREER_ENVIRONMENT: "synthetic-sandbox", CAREER_ONLY_SYNTHETIC: "true",
  CAREER_APP_ORIGIN: "http://127.0.0.1:3300", CAREER_PAYMENT_MODE: "fixture", ...extra,
});

test("dev modes are off by default and only work on a local synthetic sandbox with the fixture simulator", () => {
  assert.equal(fixtureLibraryEnabled(localEnv()), false);
  assert.equal(reviewPreviewEnabled(localEnv()), false);
  assert.equal(fixtureLibraryEnabled(localEnv({ CAREER_V3_FIXTURE_LIBRARY: "1" })), true);
  assert.equal(reviewPreviewEnabled(localEnv({ CAREER_V3_REVIEW_PREVIEW: "1" })), true);
  for (const bad of [
    { CAREER_APP_ORIGIN: "https://career-test.up.railway.app" },
    { CAREER_PAYMENT_MODE: "yookassa" },
    { RAILWAY_ENVIRONMENT_NAME: "staging" },
    { RAILWAY_ENVIRONMENT_NAME: "production" },
    { CAREER_SANDBOX_ENABLED: "0" },
  ]) {
    const env = localEnv({ CAREER_V3_FIXTURE_LIBRARY: "1", CAREER_V3_REVIEW_PREVIEW: "1", ...bad });
    assert.equal(fixtureLibraryEnabled(env), false, JSON.stringify(bad));
    assert.equal(reviewPreviewEnabled(env), false, JSON.stringify(bad));
  }
  assert.equal(localSyntheticSandbox({}), false);
});

test("the synthetic fixture library is git-ignored, generated on demand and refused unless explicitly marked", () => {
  assert.match(readFileSync(".gitignore", "utf8"), /^\.career-v3-fixture\/$/m);
  assert.equal(FIXTURE_FILE.startsWith(".career-v3-fixture/"), true);
  if (!existsSync(FIXTURE_FILE)) assert.equal(loadFixtureSources(), null);
  const src = readFileSync("lib/server/career-v3/dev-modes.ts", "utf8");
  assert.match(src, /syntheticFixture !== true \|\| data\.notForUsers !== true/);
});

test("lesson access: learners only get delivered lessons; preview needs the local flag; downloads stay inside content", () => {
  const src = readFileSync("lib/server/career-v3/lessons-view.ts", "utf8");
  assert.match(src, /library\.published\.find/);
  assert.match(src, /if \(!reviewPreviewEnabled\(\)/);
  assert.match(src, /repositoryPath\.startsWith\("content\/career\/v3\/"\)/);
  assert.match(src, /repositoryPath\.includes\("\.\."\)/);
  const route = readFileSync("app/api/career/v3/[...action]/route.ts", "utf8");
  for (const guard of ["careerConfig()", "validGate(", "sessionAccount(", "limit(", "requireV3Access(accountId)"]) assert.ok(route.includes(guard), guard);
  const page = readFileSync("app/career/v3/page.tsx", "utf8");
  assert.match(page, /if \(!sandboxVisible\(\)\) notFound\(\)/);
  assert.match(page, /index: false/);
});

test("the v3 UI does not import the v2 synthetic diagnostic or cabinet, and v2 does not import v3", () => {
  for (const f of readdirSync("components/career-v3")) {
    const s = readFileSync("components/career-v3/" + f, "utf8");
    assert.doesNotMatch(s, /career-diagnostic|CareerSandbox|server\/career\//, f);
  }
  assert.doesNotMatch(readFileSync("components/CareerSandbox.tsx", "utf8"), /career-v3/);
  assert.doesNotMatch(readFileSync("app/career/sandbox/page.tsx", "utf8"), /career-v3/);
});

test("no free-text inputs in the cabinet UI except tester code, synthetic email and one-time code", () => {
  const all = readdirSync("components/career-v3").map((f) => readFileSync("components/career-v3/" + f, "utf8")).join("\n");
  assert.doesNotMatch(all, /<textarea/);
  // Every control is a checkbox, radio, number or date field — except the three sign-in fields.
  const inputs = [...all.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
  const typed = inputs.filter((i) => /type="(password|email)"/.test(i) || (!/type="/.test(i) && /pattern="\[0-9\]\{6\}"/.test(i)));
  assert.equal(typed.length, 3, "only tester code, synthetic email and OTP are typed");
  for (const i of inputs.filter((x) => !typed.includes(x))) assert.match(i, /type=("(checkbox|radio|number|date)"|\{multi \? "checkbox" : "radio"\})/, "no free-text input: " + i.slice(0, 120));
  assert.doesNotMatch(all, /type="text"/);
});

test("user-facing UI never prints internal rule names, statuses or raw IDs", () => {
  const all = readdirSync("components/career-v3").map((f) => readFileSync("components/career-v3/" + f, "utf8")).join("\n");
  assert.doesNotMatch(all, />\s*\{[^}]*\.(taskId|stepId|skillId|exerciseId|templateId)\}\s*</);
  assert.doesNotMatch(all, /appliedRules|safetyRules\}/);
  assert.doesNotMatch(all, /\{[^}]*\.status\}/);
});
