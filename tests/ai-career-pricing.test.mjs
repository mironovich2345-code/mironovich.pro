// AI Career 3.0 price tiers: one source of terms, honest seat counter, consistent public wording.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pricing = await import("../config/ai-career-pricing.ts");
const { aiCareerCommerce, commerceCopy } = await import("../config/ai-career-commerce.ts");
const read = (p) => readFileSync(p, "utf8");
const { PRICE_TIERS, tierForSeat, priceView, seatsWord, rubles } = pricing;

test("tiers: 1–10 → 1 993 ₽, 11–20 → 3 990 ₽, 21+ → 5 900 ₽, contiguous and increasing", () => {
  assert.deepEqual(PRICE_TIERS.map((t) => [t.from, t.to, t.priceRub]), [[1, 10, 1993], [11, 20, 3990], [21, null, 5900]]);
  for (const [seat, price] of [[1, 1993], [10, 1993], [11, 3990], [20, 3990], [21, 5900], [500, 5900]]) assert.equal(tierForSeat(seat).priceRub, price, String(seat));
  assert.throws(() => tierForSeat(0));
  assert.throws(() => tierForSeat(1.5));
  assert.equal(aiCareerCommerce.priceRub, PRICE_TIERS[0].priceRub, "first-tier price is the same everywhere");
  assert.equal(aiCareerCommerce.salesEnabled, false);
  assert.equal(aiCareerCommerce.legalApproved, false);
});

test("without confirmed server data: launch tier, no seat count", () => {
  const v = priceView({ confirmed: false });
  assert.equal(v.current.id, "first");
  assert.equal(v.remaining, null);
});

test("with confirmed ledger data: counter follows paid seats plus active holds, never negative", () => {
  assert.deepEqual(priceView({ confirmed: true, paidSeats: 3, activeHolds: 0 }).remaining, { left: 7, of: 10 });
  assert.deepEqual(priceView({ confirmed: true, paidSeats: 3, activeHolds: 2 }).remaining, { left: 5, of: 10 });
  const ten = priceView({ confirmed: true, paidSeats: 10, activeHolds: 0 });
  assert.equal(ten.current.id, "second");
  assert.deepEqual(ten.remaining, { left: 10, of: 10 });
  const std = priceView({ confirmed: true, paidSeats: 25, activeHolds: 1 });
  assert.equal(std.current.id, "standard");
  assert.equal(std.remaining, null, "the open-ended tier has no counter");
});

test("Russian plural and ruble formatting", () => {
  assert.deepEqual([1, 2, 5, 10, 11, 21, 22].map(seatsWord), ["место", "места", "мест", "мест", "мест", "место", "места"]);
  assert.equal(rubles(1993), "1 993 ₽");
  assert.equal(rubles(5900), "5 900 ₽");
});

test("page: server data only — no random, localStorage, timers or hard-coded remaining count", () => {
  const block = read("components/AiCareerPriceTiers.tsx");
  const page = read("components/AiCareerProductPage.tsx");
  const avail = read("lib/server/commerce/price-availability.ts");
  for (const src of [block, page]) {
    assert.doesNotMatch(src, /Math\.random|localStorage|sessionStorage|setInterval|setTimeout|useState|"use client"/);
    assert.doesNotMatch(src, /осталось 7|left:\s*7/);
  }
  assert.match(page, /priceView\(await readPriceAvailability\(\)\)/);
  assert.match(avail, /return \{ confirmed: false \}/);
  assert.doesNotMatch(avail, /confirmed: true/, "nothing is claimed while sales are off");
  assert.match(block, /remaining \?/, "the counter renders only with confirmed data");
  assert.doesNotMatch(block, /30 дней/);
  assert.doesNotMatch(page, /(программ\S*|курс\S*|маршрут\S*) (на|за|из) 30 дней|30-дневн/i, "the program is 30 steps, not 30 days");
  assert.match(page, /30 шагов/);
});

test("public wording: tiers agree everywhere, no 'fixed 1 993' and no old discount", () => {
  assert.match(commerceCopy.priceTiers, /1 993 ₽ для первых 10 покупателей, 3 990 ₽ для покупателей с 11-го по 20-го, 5 900 ₽ начиная с 21-го/);
  for (const p of ["app/offer/ai-career/page.tsx", "app/delivery/page.tsx", "app/requisites/page.tsx", "app/products/page.tsx"]) {
    const s = read(p);
    assert.match(s, /1 993 ₽/, p);
    assert.match(s, /3 990 ₽/, p);
    assert.match(s, /5 900 ₽/, p);
    assert.doesNotMatch(s, /фиксированн\S* цен\S* 1 993|стоимость фиксирована/, p);
  }
  assert.match(read("app/refund/page.tsx"), /полная уплаченная сумма — 1 993 ₽, 3 990 ₽ или 5 900 ₽/);
  assert.match(read("app/offer/ai-career/page.tsx"), /фиксируется в заказе при его оформлении и сообщается до подтверждения оплаты/);
  const all = ["components/AiCareerProductPage.tsx", "components/AiCareerPriceTiers.tsx", "config/ai-career-commerce.ts"].map(read).join("\n");
  assert.doesNotMatch(all, /referencePriceRub|плановая стандартная стоимость/);
});

test("seat ledger schema: tier/price/seat bound by CHECKs; paid seats are never released", () => {
  const sql = read("migrations/commerce/001_price_seats.sql");
  assert.match(sql, /tier = 'first' AND seat BETWEEN 1 AND 10 AND price_kopeks = 199300/);
  assert.match(sql, /CAREER_TEST_DATABASE_REQUIRED/);
  const ledger = read("lib/server/commerce/price-seats.ts");
  assert.match(ledger, /pg_advisory_xact_lock/);
  assert.match(ledger, /state IN \('held','capturing'\)/);
  assert.doesNotMatch(ledger, /DELETE FROM commerce_price_seats WHERE[^"]*state='paid'/);
});
