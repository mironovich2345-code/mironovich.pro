import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BASE_EXPENSES, BASE_CASH, BASE_CHANNELS,
  summarizeExpenses, forecastCash, costPerSale,
} from "../lib/club-ops-demo.ts";
import { projectBySlug, verifiedProjectDemo } from "../content/projects.ts";

test("CLUB OPS demo scenarios use synthetic documented baselines", () => {
  assert.deepEqual(summarizeExpenses(BASE_EXPENSES), {
    plan: 500_000, fact: 610_000, difference: 110_000,
  });
  assert.equal(forecastCash(BASE_CASH), -250_000);
  assert.equal(costPerSale(BASE_CHANNELS[0].spend, BASE_CHANNELS[0].sales), 10_000);
  assert.equal(costPerSale(BASE_CHANNELS[1].spend, BASE_CHANNELS[1].sales), 18_000);
});

test("recalculation is deterministic with positive, zero and negative scenarios", () => {
  assert.equal(forecastCash({ opening: 200_000, receipts: 2_500_000, payments: 1_000_000 }), 1_700_000);
  assert.equal(forecastCash({ opening: 200_000, receipts: 800_000, payments: 1_000_000 }), 0);
  assert.equal(costPerSale(10_000, 0), null);
  assert.equal(costPerSale(0, 2), 0);
  const changed = BASE_EXPENSES.map(line => line.key === "marketing" ? { ...line, fact: 80_000 } : line);
  assert.deepEqual(summarizeExpenses(changed), { plan: 500_000, fact: 550_000, difference: 50_000 });
  assert.equal(BASE_EXPENSES.find(line => line.key === "marketing").fact, 140_000);
});

test("new demo route starts unindexed and explicitly synthetic", () => {
  const page = readFileSync(new URL("../app/demos/club-ops/page.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../components/demos/ClubOpsSandbox.tsx", import.meta.url), "utf8");
  assert.match(page, /noindex:\s*true/);
  assert.match(page, /синтетические данные|вымышлены/);
  assert.match(client, /Данные и ситуации вымышлены/);
  assert.match(client, /не сохраняются/);
  assert.doesNotMatch(client, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/);
  assert.match(client, /aria-pressed/);
  assert.match(client, /type="range"/);
});

test("internal demo link stays closed until explicit verification", () => {
  const p = projectBySlug("club-ops");
  assert.ok(p);
  assert.equal(p.demoUrl, "/demos/club-ops");
  assert.equal(verifiedProjectDemo(p), undefined);
  const approved = structuredClone(p);
  approved.demoVerification = { checkedAt: "2026-11-16", available: true, permission: "Owner permitted synthetic standalone demo" };
  assert.equal(verifiedProjectDemo(approved), "/demos/club-ops");
  approved.demoUrl = "/demos/../../privacy";
  assert.equal(verifiedProjectDemo(approved), undefined);
  approved.demoUrl = "//external.example/unsafe";
  assert.equal(verifiedProjectDemo(approved), undefined);
});
