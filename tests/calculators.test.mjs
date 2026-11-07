import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateLabor, parseLaborInput, LABOR_VERSION } from "../lib/tools/labor.ts";
import { calculateAutomation, calculatePayback, defaultAutomation, parseAutomationInput, recommend } from "../lib/tools/automation.ts";
import { automationModel } from "../config/automation-model.ts";
import { parseDecimal, round2 } from "../lib/tools/input.ts";
import { parseToolContext, describeToolContext } from "../lib/tools/context.ts";
import { encodeLaborTransfer, decodeLaborTransfer } from "../lib/tools/storage.ts";
import { escapedField, formatLeadMessage } from "../lib/lead-message.ts";

const labor = { employees: 3, operationsPerDay: 20, minutesPerOperation: 3, workingDays: 22, hourlyCost: 600, automationPercent: 50 };
test("manual work: documented example and all five results", () => {
  assert.deepEqual(calculateLabor(labor), { monthlyHours: 66, monthlyCost: 39600, annualCost: 475200, freedHours: 33, freedTimeValue: 19800 });
});
test("zero values are meaningful and never produce NaN or a divide by zero", () => {
  const zero = Object.fromEntries(Object.keys(labor).map((k) => [k, 0]));
  assert.ok(Object.values(calculateLabor(zero)).every((v) => v === 0));
  assert.equal(calculateLabor({ ...labor, automationPercent: 0 }).freedTimeValue, 0);
  assert.equal(calculateLabor({ ...labor, automationPercent: 100 }).freedTimeValue, 39600);
});
test("money is rounded to kopecks and annual cost agrees with monthly cost", () => {
  assert.equal(round2(1.005), 1.01);
  const r = calculateLabor({ ...labor, employees: 1, operationsPerDay: 1, minutesPerOperation: 60, workingDays: 1, hourlyCost: 1.005 });
  assert.equal(r.monthlyCost, 1.01); assert.equal(r.annualCost, 12.12); assert.equal(r.freedTimeValue, 0.51);
});
for (const [key, value] of [["employees", -1], ["employees", 1.5], ["operationsPerDay", 0.5], ["workingDays", 32], ["automationPercent", 101], ["hourlyCost", Infinity], ["minutesPerOperation", NaN], ["hourlyCost", "600"], ["employees", 1e100]]) {
  test(`labor rejects ${key}: ${value}`, () => {
    assert.equal(parseLaborInput({ ...labor, [key]: value }).ok, false);
    assert.throws(() => calculateLabor({ ...labor, [key]: value }), RangeError);
  });
}
test("large individually valid values cannot exceed aggregate precision bounds", () => {
  assert.equal(parseLaborInput({ employees: 10000, operationsPerDay: 10000, minutesPerOperation: 1440, workingDays: 31, hourlyCost: 1000000, automationPercent: 100 }).ok, false);
  assert.equal(parseLaborInput(null).ok, false);
});
test("decimal UI input accepts comma and refuses partial numbers, exponent and blanks", () => {
  assert.equal(parseDecimal(" 600,50 "), 600.5);
  for (const text of ["", " ", "-1", "1e3", "2abc", "Infinity", "1,2,3", ".5"]) assert.ok(Number.isNaN(parseDecimal(text)), text);
});

for (const [changes, expected] of [
  [{ integrations: 0, api: "yes" }, "Скрипт или небольшой внутренний инструмент"],
  [{ integrations: 2, api: "yes" }, "Интеграция существующих систем"],
  [{ processType: "requests", integrations: 0 }, "Готовый SaaS-сервис"],
  [{ interface: true }, "Разработка приложения"],
  [{ ai: true, documents: true }, "ИИ-автоматизация"],
  [{ integrations: 0, load: "high" }, "Обычная автоматизация"],
]) {
  test(`recommendation: ${expected}`, () => assert.equal(recommend({ ...defaultAutomation, ...changes }).approach, expected));
}
test("AI is not the default and is not recommended for ordinary data exchange", () => {
  assert.equal(recommend(defaultAutomation).usesAI, false);
  const r = calculateAutomation({ ...defaultAutomation, api: "yes", processType: "transfer", ai: true });
  assert.equal(r.recommendation.usesAI, false);
  assert.equal(r.stages.find((s) => s.name === "ИИ-компоненты").hours[1], 0);
});
test("draft pricing stays hidden even if only one publication gate is enabled", () => {
  for (const [approvedByOwner, publicPricingEnabled] of [[false, false], [true, false], [false, true]]) {
    const r = calculateAutomation(defaultAutomation, labor, { ...automationModel, approvedByOwner, publicPricingEnabled });
    assert.equal(r.budget, null); assert.equal(r.recurringTotal, null); assert.equal(r.paybackMonths, null);
    assert.ok(r.recurring.every((s) => s.range === null));
    assert.equal(r.potentialTimeValue, 19800);
  }
});
const simple = { ...defaultAutomation, api: "yes", data: "clean", integrations: 0, support: false };
const approved = { ...automationModel, approvedByOwner: true, publicPricingEnabled: true };
test("stages, approved budget and recurring costs match a hand-checked scenario", () => {
  const r = calculateAutomation(simple, undefined, approved);
  assert.deepEqual(r.hours, [24, 68]);
  assert.deepEqual(r.budget, [72000, 204000]);
  assert.deepEqual(r.recurringTotal, [1000, 4000]);
  assert.deepEqual(r.hours, [r.stages.reduce((n, s) => n + s.hours[0], 0), r.stages.reduce((n, s) => n + s.hours[1], 0)]);
});
test("greater load and worse data increase hours; unavailable API is an explicit risk", () => {
  const base = calculateAutomation({ ...defaultAutomation, api: "yes", data: "clean" });
  const more = calculateAutomation({ ...defaultAutomation, api: "no", data: "poor", load: "high" });
  assert.ok(more.hours[0] > base.hours[0]); assert.ok(more.hours[1] > base.hours[1]);
  assert.ok(more.risks.some((r) => r.includes("невозможной")));
});
test("payback requires confirmed cash benefits, residual labour and approved pricing", () => {
  assert.equal(calculateAutomation(simple, labor, approved).paybackMonths, null);
  const input = { ...simple, confirmedCashBenefit: 50000, residualManualCost: 5000 };
  assert.deepEqual(calculateAutomation(input, labor, approved).paybackMonths, [1.7, 5]);
  assert.equal(calculateAutomation(input, labor).paybackMonths, null);
  assert.equal(calculateAutomation({ ...input, confirmedCashBenefit: 3000 }, labor, approved).paybackMonths, null);
  for (const net of [[0, 100], [-5, 5], [NaN, 100], [10, 5]]) assert.equal(calculatePayback([100, 200], net), null);
});
for (const input of [null, [], { ...simple, employees: -1 }, { ...simple, integrations: 21 }, { ...simple, ai: "true" }, { ...simple, processType: "toString" }, { ...simple, data: "invented" }, { ...simple, confirmedCashBenefit: 100 }]) {
  test(`automation validation: ${JSON.stringify(input)}`, () => assert.equal(parseAutomationInput(input).ok, false));
}
test("server context ignores all client results and recalculates from validated inputs", () => {
  const c = parseToolContext({ tool: "labor-cost", version: LABOR_VERSION, input: { ...labor, processName: "secret" }, result: { monthlyCost: 999999 } });
  assert.deepEqual(c, { tool: "labor-cost", version: LABOR_VERSION, input: labor });
  assert.ok(describeToolContext(c).includes("39600"));
  assert.ok(!describeToolContext(c).includes("999999"));
  assert.ok(!describeToolContext(c).includes("secret"));
  assert.equal(parseToolContext({ ...c, version: "old" }), null);
  assert.equal(parseToolContext({ ...c, input: { ...labor, hourlyCost: -1 } }), null);
});
test("automation lead context validates nested labor and never enables pricing from client flags", () => {
  const c = parseToolContext({ tool: "automation-cost", version: automationModel.version, input: { ...simple, publicPricingEnabled: true }, labor, budget: [1, 2] });
  assert.equal(c.tool, "automation-cost");
  assert.ok(describeToolContext(c).includes("не опубликована"));
  assert.equal(parseToolContext({ ...c, labor: [] }), null);
  assert.equal(parseToolContext({ tool: "<script>", version: "1", input: labor }), null);
});
test("local transfer contains only valid numeric inputs, rejects stale/corrupt data", () => {
  const raw = encodeLaborTransfer({ ...labor, name: "secret", description: "private" }, 1000);
  assert.ok(!raw.includes("secret") && !raw.includes("private"));
  assert.deepEqual(decodeLaborTransfer(raw, 1001), labor);
  assert.equal(decodeLaborTransfer(raw, 1000 + 24 * 3600000 + 1), null);
  assert.equal(decodeLaborTransfer(raw, 999), null);
  for (const bad of [null, "{", JSON.stringify({ version: "bad", savedAt: 1000, input: labor })]) assert.equal(decodeLaborTransfer(bad, 1001), null);
});
test("Telegram message escapes hostile text, caps length and keeps HTML entities intact", () => {
  assert.equal(escapedField('<&>', 30), '&lt;&amp;&gt;');
  const s = formatLeadMessage({ name: '<script>'.repeat(100), phone: '&'.repeat(100), task: '<&>'.repeat(2000), company: '&'.repeat(120), direction: '<'.repeat(100), page: '/tools/automation-cost', date: '07.11.2026', consentVersion: 'v1', context: '<x>'.repeat(2000), attribution: Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','referrer','landingPage'].map((k) => [k, '&'.repeat(100)])) });
  assert.ok(s.length < 4096, s.length);
  assert.ok(!s.includes('<script>') && !s.includes('<x>'));
  assert.equal((s.match(/<b>/g) || []).length, (s.match(/<\/b>/g) || []).length);
  assert.ok(!s.replace(/&(?:amp|lt|gt);/g, '').includes('&'));
});
