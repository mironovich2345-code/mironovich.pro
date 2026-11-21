// Release safety of AI Career 3.0 (audit #49): proofs that nothing in review is delivered as published learning,
// no real route exists without approved lessons, local test modes and test payments cannot reach production,
// v2 is untouched, commerce stays off and no learner data goes to external AI services.
// Runs on any branch: with no lessons, or with all written lessons on an integration branch.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { loadProfessionBundle } from "../lib/server/career-v3/content.ts";
import { fixtureLibraryEnabled, reviewPreviewEnabled } from "../lib/server/career-v3/dev-modes.ts";
import { careerConfig } from "../lib/server/career/config.ts";
import { evaluateDiagnostic } from "../lib/career-v3/diagnostic.ts";
import { selectLessons } from "../lib/career-v3/selection.ts";
import { buildPlan } from "../lib/career-v3/plan.ts";
import { aiCareerCommerce } from "../config/ai-career-commerce.ts";

delete process.env.CAREER_V3_FIXTURE_LIBRARY;
delete process.env.CAREER_V3_REVIEW_PREVIEW;
const TODAY = new Date().toISOString().slice(0, 10);
const lessonDir = "content/career/v3/lessons";
const lessonFiles = existsSync(lessonDir) ? readdirSync(lessonDir).filter((f) => f.endsWith(".json")) : [];
const profiles = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles.filter((p) => p.id !== "FX-diagnostic-changed");
const sandbox = (extra = {}) => ({
  CAREER_SANDBOX_ENABLED: "1", CAREER_ENVIRONMENT: "synthetic-sandbox", CAREER_ONLY_SYNTHETIC: "true", CAREER_APP_ORIGIN: "http://127.0.0.1:3300",
  CAREER_DATABASE_URL: "postgresql://postgres@127.0.0.1:55433/mironovich_career_test", CAREER_DATABASE_NAME: "mironovich_career_test", CAREER_DATABASE_HOST: "127.0.0.1:55433",
  CAREER_SESSION_SECRET: "s".repeat(48), CAREER_TESTER_SECRET: "t".repeat(40), CAREER_PAYMENT_MODE: "fixture",
  YOOKASSA_SHOP_ID: "1534248", YOOKASSA_TEST_SECRET_KEY: "test_" + "a".repeat(24), YOOKASSA_TEST_KEY_ROTATED: "true", ...extra,
});

test("review lessons are never delivered as published learning in the normal content mode", () => {
  const b = loadProfessionBundle("sales_manager", TODAY);
  assert.equal(b.libraryMode, "content");
  for (const f of lessonFiles) {
    const doc = JSON.parse(readFileSync(path.join(lessonDir, f), "utf8"));
    assert.notEqual(doc.status, "approved", `${doc.id} must not be approved in content`);
    assert.equal(doc.quality.canBePublished, false, `${doc.id} must not be publishable`);
    assert.ok(!b.library.published.some((l) => l.id === doc.id), `${doc.id} must not be delivered`);
  }
  assert.equal(b.library.published.length, 0);
  const curriculum = JSON.parse(readFileSync("content/career/v3/curriculum.json", "utf8"));
  assert.ok(curriculum.slots.every((s) => s.status === "planned" && s.publishedLessonId === null), "no slot is published");
});

test("no real route is created without approved lessons — for all nine synthetic profiles", () => {
  const b = loadProfessionBundle("sales_manager", TODAY);
  for (const p of profiles) {
    const r = evaluateDiagnostic(b.diagnostic, p.answers, TODAY);
    const sel = selectLessons(b.engine, r, b.library);
    const plan = buildPlan(b.engine, { result: r, selection: sel, library: b.library, today: TODAY });
    assert.equal(sel.status, "unavailable", p.id);
    assert.equal(plan.status, "unavailable", p.id);
    assert.deepEqual(plan.steps, [], p.id);
  }
});

test("fixture library and review preview cannot be enabled outside the local synthetic sandbox", () => {
  const on = { CAREER_V3_FIXTURE_LIBRARY: "1", CAREER_V3_REVIEW_PREVIEW: "1" };
  assert.equal(fixtureLibraryEnabled(sandbox(on)), true, "control: local sandbox with explicit flags");
  for (const bad of [
    { RAILWAY_ENVIRONMENT_NAME: "production" }, { RAILWAY_PROJECT_ID: "x" }, { CAREER_APP_ORIGIN: "https://mironovich.pro" },
    { CAREER_PAYMENT_MODE: "yookassa" }, { CAREER_SANDBOX_ENABLED: "0" }, { CAREER_ENVIRONMENT: "production" },
  ]) {
    assert.equal(fixtureLibraryEnabled(sandbox({ ...on, ...bad })), false, JSON.stringify(bad));
    assert.equal(reviewPreviewEnabled(sandbox({ ...on, ...bad })), false, JSON.stringify(bad));
  }
  assert.equal(fixtureLibraryEnabled({}), false);
});

test("test payments cannot become real: simulator only on loopback, YooKassa only with a rotated test key", () => {
  assert.equal(careerConfig(sandbox()).mode, "fixture");
  assert.throws(() => careerConfig(sandbox({ CAREER_APP_ORIGIN: "https://mironovich.pro" })), /Тестовый контур закрыт/, "the production domain never opens the sandbox");
  assert.throws(() => careerConfig(sandbox({ RAILWAY_ENVIRONMENT_NAME: "production" })), /Тестовый контур закрыт/);
  assert.throws(() => careerConfig(sandbox({ CAREER_APP_ORIGIN: "https://career-test.up.railway.app" })), /Симулятор допускается только локально/);
  assert.throws(() => careerConfig(sandbox({ CAREER_PAYMENT_MODE: "yookassa", YOOKASSA_TEST_SECRET_KEY: "live_" + "a".repeat(24) })), /тестовый ключ/);
  assert.throws(() => careerConfig(sandbox({ CAREER_PAYMENT_MODE: "yookassa", YOOKASSA_TEST_KEY_ROTATED: "false" })), /тестовый ключ/);
  assert.throws(() => careerConfig(sandbox({ CAREER_PAYMENT_MODE: "live" })), /платёжный режим/);
});

test("salesEnabled and legalApproved stay false", () => {
  assert.equal(aiCareerCommerce.salesEnabled, false);
  assert.equal(aiCareerCommerce.legalApproved, false);
});

test("v3 migrations run only in the synthetic test database and never change v2 tables", () => {
  const v3 = readdirSync("migrations/career").filter((f) => /^00[5-9]_v3_.*\.sql$/.test(f));
  assert.ok(v3.length >= 1);
  for (const f of v3) {
    const sql = readFileSync(path.join("migrations/career", f), "utf8");
    assert.match(sql, /CAREER_TEST_DATABASE_REQUIRED/, f);
    assert.doesNotMatch(sql, /\b(ALTER|DROP|UPDATE|DELETE|TRUNCATE)\b[^;]*\bcareer_(diagnostics|reports|progress|orders|accounts|refunds|sessions)\b(?!_)/i, f);
  }
});

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => { const p = path.join(dir, n); return statSync(p).isDirectory() ? files(p) : [p]; });
}

test("no learner data is sent to external AI services from the v3 code", () => {
  const code = ["lib/career-v3", "lib/server/career-v3", "app/api/career/v3", "app/career/v3", "components/career-v3"].flatMap(files).filter((f) => /\.(ts|tsx|mjs)$/.test(f));
  assert.ok(code.length > 5);
  for (const f of code) {
    const t = readFileSync(f, "utf8");
    assert.doesNotMatch(t, /ai-provider|openai|anthropic|responses\.create|api\.openai|generativelanguage/i, f);
    assert.doesNotMatch(t, /fetch\(\s*["'`]https?:\/\//, `${f}: no direct external requests`);
  }
});
