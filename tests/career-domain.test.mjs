import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sandboxVisible, careerConfig } from "../lib/server/career/config.ts";
import {
  careerQuestions,
  syntheticAnswers,
  validateCareerAnswers,
  generateSyntheticAnalysis,
  addCalendarMonths,
} from "../lib/career-diagnostic.ts";
import { careerPdf } from "../lib/server/career/pdf.ts";
const env = () => ({
  CAREER_SANDBOX_ENABLED: "1",
  CAREER_ENVIRONMENT: "synthetic-sandbox",
  CAREER_ONLY_SYNTHETIC: "true",
  CAREER_APP_ORIGIN: "http://127.0.0.1:3300",
  CAREER_DATABASE_URL:
    "postgresql://postgres@127.0.0.1:55433/mironovich_career_test",
  CAREER_DATABASE_NAME: "mironovich_career_test",
  CAREER_DATABASE_HOST: "127.0.0.1:55433",
  CAREER_SESSION_SECRET: "s".repeat(64),
  CAREER_TESTER_SECRET: "t".repeat(48),
  CAREER_PAYMENT_MODE: "fixture",
});
test("sandbox is disabled by default, blocks production and requires explicit synthetic mode", () => {
  assert.equal(sandboxVisible({}), false);
  assert(careerConfig(env()).local);
  for (const patch of [
    { CAREER_ONLY_SYNTHETIC: "false" },
    { CAREER_ENVIRONMENT: "production" },
    { RAILWAY_ENVIRONMENT_NAME: "production" },
    { CAREER_APP_ORIGIN: "https://mironovich.pro" },
    { CAREER_APP_ORIGIN: "http://evil.example" },
  ])
    assert.throws(() => careerConfig({ ...env(), ...patch }));
});
test("database guard rejects another project, wrong host/name and missing secrets", () => {
  for (const patch of [
    {
      CAREER_DATABASE_URL:
        "postgresql://postgres@127.0.0.1:55432/clubops_demo_qa",
    },
    { CAREER_DATABASE_NAME: "railway" },
    { CAREER_DATABASE_HOST: "elsewhere:5432" },
    { CAREER_SESSION_SECRET: "" },
    { CAREER_TESTER_SECRET: "" },
  ])
    assert.throws(() => careerConfig({ ...env(), ...patch }));
});
test("provider fixture cannot be enabled remotely; live or unrotated payment keys rejected", () => {
  assert.throws(() =>
    careerConfig({
      ...env(),
      CAREER_APP_ORIGIN: "https://preview-test.up.railway.app",
    }),
  );
  for (const patch of [
    {},
    {
      YOOKASSA_TEST_KEY_ROTATED: "true",
      YOOKASSA_SHOP_ID: "1000000",
      YOOKASSA_TEST_SECRET_KEY: "live_not_supported",
    },
    {
      YOOKASSA_TEST_KEY_ROTATED: "false",
      YOOKASSA_SHOP_ID: "1000000",
      YOOKASSA_TEST_SECRET_KEY: "test_" + "a".repeat(32),
    },
  ])
    assert.throws(() =>
      careerConfig({ ...env(), CAREER_PAYMENT_MODE: "yookassa", ...patch }),
    );
});
test("18 coded answers, no free text, tasks 1–5 and no foreign keys", () => {
  const a = syntheticAnswers();
  assert.equal(careerQuestions.length, 18);
  assert(validateCareerAnswers(a));
  for (const invalid of [
    { ...a, name: "Real person" },
    { ...a, questions: { ...a.questions, role: "Unrestricted text" } },
    { ...a, questions: {} },
    { ...a, tasks: [] },
    { ...a, tasks: ["table", "table"] },
    { ...a, tasks: ["not-defined"] },
    { ...a, tasks: ["table"], email: "person@example.com" },
  ])
    assert.equal(validateCareerAnswers(invalid), null);
});
test("high risk or forbidden data never recommended for unattended automation", () => {
  const a = syntheticAnswers();
  a.questions.dataSensitivity = "restricted";
  const restricted = generateSyntheticAnalysis(a);
  assert(restricted.tasks.every((t) => t.score === 0));
  assert(restricted.tasks.every((t) => /Не передавать/.test(t.recommendation)));
  a.questions.dataSensitivity = "synthetic";
  a.questions.errorImpact = "high";
  const high = generateSyntheticAnalysis(a);
  assert(high.tasks.every((t) => /человеком/.test(t.recommendation)));
  assert.equal(high.plan.length, 30);
  assert.deepEqual(high.plan.map((step) => step.day), Array.from({length:30},(_,i)=>i+1));
  assert.equal(new Set(high.plan.map((step)=>step.action)).size,30,"each step has its own action");
  assert.ok(high.plan.every((step)=>step.evidence && step.evidence.length>10),"each step has evidence");
  assert.deepEqual([high.plan[0].theme,high.plan[6].theme,high.plan[14].theme,high.plan[23].theme],[
    "Разберите задачу","Попробуйте ИИ","Проверьте качество","Оформите результат",
  ]);
  assert.equal(new Set(high.plan.map((d) => d.day)).size, 30);
  assert.equal(high.directions.length, 3);
  assert.equal(high.synthetic, true);
  assert.match(high.disclaimer, /не настоящий ИИ/);
});
test("12 calendar months clamp leap day and preserve time; access is not extended by adding residue", () => {
  assert.equal(
    addCalendarMonths(new Date("2024-02-29T12:34:56Z"), 12).toISOString(),
    "2025-02-28T12:34:56.000Z",
  );
  assert.equal(
    addCalendarMonths(new Date("2026-11-17T00:00:00Z"), 12).toISOString(),
    "2027-11-17T00:00:00.000Z",
  );
});
test("Unicode PDF contains real pages from the generated 30-step report", async () => {
  const { PDFDocument } = await import("pdf-lib");
  const b = await careerPdf(generateSyntheticAnalysis(syntheticAnswers()));
  assert.match(b.subarray(0, 8).toString(), /^%PDF-/);
  const pdf = await PDFDocument.load(b);
  assert(pdf.getPageCount() >= 2);
  assert(b.length > 10000);
});
test("publication guards and commerce flags remain off; dedicated DB migration is fail-closed", () => {
  assert.equal(
    JSON.parse(fs.readFileSync("config/legal.json")).published,
    false,
  );
  assert.match(
    fs.readFileSync("config/ai-career-commerce.ts", "utf8"),
    /salesEnabled:\s*false/,
  );
  assert.match(
    fs.readFileSync("config/ai-career-commerce.ts", "utf8"),
    /legalApproved:\s*false/,
  );
  const sql = fs.readFileSync(
    "migrations/career/001_synthetic_sandbox.sql",
    "utf8",
  );
  assert.match(sql, /current_database\(\)/);
  assert.match(sql, /mironovich_career_test/);
  assert.match(sql, /CHECK\(synthetic\)/);
  assert.match(sql, /CHECK\(test\)/);
});

test("sandbox progress UI and PDF both describe 30 steps, not 30 calendar days",()=>{
  const ui=fs.readFileSync("components/CareerSandbox.tsx","utf8");
  const pdf=fs.readFileSync("lib/server/career/pdf.ts","utf8");
  const generator=fs.readFileSync("lib/career-diagnostic.ts","utf8");
  assert.match(ui,/План из 30 шагов/);
  assert.match(ui,/Шаг \{d\.day\}/);
  assert.match(ui,/Результат: \{d\.evidence\}/);
  assert.match(pdf,/План из 30 шагов/);
  assert.match(pdf,/Результат: \$\{d\.evidence\}/);
  assert.match(generator,/The 30-step plan must be consecutive/);
  for (const src of [ui,pdf]) assert.doesNotMatch(src,/План на 30 дней|День \{d\.day\}/);
});
