// AI Career 3.0 price: three allowed prices, set by the owner at run time; honest page; consistent documents.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const pricing = await import("../config/ai-career-pricing.ts");
const { aiCareerCommerce, commerceCopy } = await import("../config/ai-career-commerce.ts");
const read = (p) => readFileSync(p, "utf8");
const { ALLOWED_PRICES_RUB, DEFAULT_PRICE_RUB, isAllowedPrice, periodText, rubles, moscowDateTime } = pricing;

test("three allowed prices; launch price is the same everywhere; sales stay off", () => {
  assert.deepEqual([...ALLOWED_PRICES_RUB], [1993, 3990, 5900]);
  assert.equal(DEFAULT_PRICE_RUB, 1993);
  assert.equal(aiCareerCommerce.priceRub, DEFAULT_PRICE_RUB);
  for (const bad of [0, 1990, 4990, "1993", null, 1993.5]) assert.equal(isAllowedPrice(bad), false, String(bad));
  assert.equal(aiCareerCommerce.salesEnabled, false);
  assert.equal(aiCareerCommerce.legalApproved, false);
  const sql = read("migrations/commerce/001_price_periods.sql");
  assert.equal((sql.match(/price_kopeks IN \(199300, 399000, 590000\)/g) || []).length, 2, "DB accepts only the three prices");
});

test("promotion end is shown in Moscow time as the last included minute; base price has no period text", () => {
  const promo = { known: true, kind: "promo", priceRub: 1993, startsAt: "2026-11-30T21:00:00.000Z", endsAt: "2026-12-07T21:00:00.000Z", afterPriceRub: 3990 };
  assert.equal(periodText(promo), "Цена действует до 7 декабря 2026 г., 23:59 МСК включительно.");
  assert.equal(periodText({ ...promo, kind: "base", endsAt: null }), null);
  assert.equal(periodText({ known: false }), null);
  assert.equal(moscowDateTime("2026-12-01T00:00:00Z"), "1 декабря 2026 г., 03:00 МСК");
  assert.equal(rubles(5900), "5 900 ₽");
});

test("no seat limits, counters or invented discounts anywhere", () => {
  assert.ok(!existsSync("lib/server/commerce/price-seats.ts") && !existsSync("components/AiCareerPriceTiers.tsx"), "seat reservation removed");
  const ui = ["components/AiCareerPrice.tsx", "components/AiCareerProductPage.tsx", "components/ProductCard.tsx"].map(read).join("\n");
  assert.doesNotMatch(ui, /осталось|мест\b|первых 10|<del\b|скидк|Math\.random|localStorage|setInterval|setTimeout|"use client"/);
  const code = read("config/ai-career-pricing.ts").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /seat|capacity/i, "no seat logic in the price config");
});

test("page: price read on the server at request time, refreshed within a minute, unknown price never guessed", () => {
  const page = read("components/AiCareerProductPage.tsx");
  assert.match(page, /const price = await readCurrentPrice\(\)/);
  assert.match(read("app/products/[slug]/page.tsx"), /export const revalidate = 60;/);
  const current = read("lib/server/commerce/price-current.ts");
  assert.match(current, /if \(!url\) return LAUNCH;/);
  assert.match(current, /return \{ known: false \};/);
  const block = read("components/AiCareerPrice.tsx");
  assert.match(block, /будет показана при оформлении заказа до подтверждения оплаты/);
  assert.doesNotMatch(page, /(программ\S*|курс\S*|маршрут\S*) (на|за|из) 30 дней|30-дневн/i, "30 steps, not 30 days");
  assert.match(page, /30 шагов/);
});

test("documents: price may change by period; order amount fixed at creation; refund = amount in the order", () => {
  const offer = read("app/offer/ai-career/page.tsx");
  assert.match(offer, /может изменяться в разные периоды; она составляет 1 993 ₽, 3 990 ₽ или 5 900 ₽/);
  assert.match(offer, /фиксируется в заказе в момент его оформления, сообщается покупателю до подтверждения оплаты и после оформления заказа не изменяется/);
  assert.match(read("app/refund/page.tsx"), /полная уплаченная сумма, указанная в заказе/);
  for (const p of ["app/delivery/page.tsx", "app/requisites/page.tsx", "app/products/page.tsx"]) {
    const s = read(p);
    for (const x of ["1 993 ₽", "3 990 ₽", "5 900 ₽"]) assert.ok(s.includes(x), `${p}: ${x}`);
    assert.doesNotMatch(s, /первых 10|ценового этапа|фиксированн\S* цен|стоимость фиксирована/, p);
  }
  assert.match(commerceCopy.pricePeriods, /фиксируется в заказе при его оформлении/);
});

test("price changes are validated and kept as history; orders keep their price", () => {
  const lib = read("lib/server/commerce/price-periods.ts");
  assert.match(lib, /pg_advisory_xact_lock/);
  assert.match(lib, /не может быть в прошлом: история цен не переписывается/);
  assert.doesNotMatch(lib, /DELETE FROM commerce_price_periods/, "history is never deleted");
  assert.doesNotMatch(lib, /UPDATE commerce_order_prices SET[^"]*price_kopeks/, "an order's price is never recalculated");
  assert.match(read("scripts/commerce/price-admin.mjs"), /set <1993\|3990\|5900>/);
});

test("product catalog and detail use one server-side current price, not an outdated card price", () => {
  const catalog = read("app/products/page.tsx");
  const card = read("components/ProductCard.tsx");
  assert.match(catalog, /await readCurrentPrice\(\)/);
  assert.match(catalog, /export const revalidate = 60/);
  assert.match(catalog, /currentPrice=\{p\.slug === "ai-career" \? price : undefined\}/);
  assert.match(card, /currentPrice\.known \? rubles\(currentPrice\.priceRub\)/);
  assert.match(card, /Действующая цена уточняется/);
  assert.match(read("components/AiCareerProductPage.tsx"), /await readCurrentPrice\(\)/);
});
