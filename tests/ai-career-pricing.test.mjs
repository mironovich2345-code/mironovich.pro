// AI Career 3.0 price: three allowed prices, AUTO ladder by confirmed sales or a MANUAL price; one source for the
// catalogue, the product page, the order, the Robokassa request and the reports; honest page; consistent documents.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const pricing = await import("../config/ai-career-pricing.ts");
const { aiCareerCommerce, commerceCopy } = await import("../config/ai-career-commerce.ts");
const shop = await import("../lib/server/commerce/shop.ts");
const read = (p) => readFileSync(p, "utf8");
const { ALLOWED_PRICES_RUB, DEFAULT_PRICE_RUB, isAllowedPrice, rubles, autoPriceFor } = pricing;

test("three allowed prices; launch price is the same everywhere; sales stay off", () => {
  assert.deepEqual([...ALLOWED_PRICES_RUB], [1993, 3990, 5900]);
  assert.equal(DEFAULT_PRICE_RUB, 1993);
  assert.equal(aiCareerCommerce.priceRub, DEFAULT_PRICE_RUB);
  for (const bad of [0, 1990, 4990, "1993", null, 1993.5]) assert.equal(isAllowedPrice(bad), false, String(bad));
  assert.equal(aiCareerCommerce.salesEnabled, false);
  assert.equal(aiCareerCommerce.legalApproved, false);
  const sql = read("migrations/career/012_stage1_otp_admin_commerce.sql");
  assert.equal((sql.match(/IN \(199300, 399000, 590000\)/g) || []).length, 4, "DB accepts only the three prices (settings, history ×2, orders)");
  assert.equal(rubles(5900), "5 900 ₽");
});

test("AUTO ladder: №1–10 1 993 ₽, №11–20 3 990 ₽, №21–40 5 900 ₽, after №40 still 5 900 ₽", () => {
  const expect = (n, p) => assert.equal(autoPriceFor(n), p, "sale " + n);
  for (const n of [1, 10]) expect(n, 1993);
  for (const n of [11, 20]) expect(n, 3990);
  for (const n of [21, 40, 41, 500]) expect(n, 5900);
  for (const bad of [0, -1, 1.5, NaN]) assert.throws(() => autoPriceFor(bad));
});

test("payment amounts: only whole kopeks that Robokassa may send (1993, 1993.00, 1993.000000)", () => {
  assert.equal(shop.outSumKopeks("1993"), 199300);
  assert.equal(shop.outSumKopeks("1993.00"), 199300);
  assert.equal(shop.outSumKopeks("1993.000000"), 199300);
  assert.equal(shop.outSumKopeks("3990.5"), 399050);
  for (const bad of ["", "1993.001", "-1993", "1e3", "1993,00", "19 93"]) assert.equal(shop.outSumKopeks(bad), null, bad);
});

test("no seat counters, timers or invented discounts on public pages", () => {
  assert.ok(!existsSync("lib/server/commerce/price-periods.ts") && !existsSync("migrations/commerce/001_price_periods.sql"), "period model replaced");
  const ui = ["components/AiCareerPrice.tsx", "components/AiCareerProductPage.tsx", "components/ProductCard.tsx"].map(read).join("\n");
  assert.doesNotMatch(ui, /осталось|мест\b|первых 10|<del\b|<s>|line-through|скидк|Math\.random|localStorage|setInterval|setTimeout|"use client"/);
});

test("one price source: page, catalogue, order and Robokassa all go through shop.quote / the fixed order amount", () => {
  const current = read("lib/server/commerce/price-current.ts");
  assert.match(current, /quote\(/);
  assert.match(current, /if \(!url\) return LAUNCH;/);
  assert.match(current, /return \{ known: false \};/);
  const s = read("lib/server/commerce/shop.ts");
  assert.match(s, /const q = await quote\(tx\);/, "an order takes the quoted price");
  assert.doesNotMatch(s, /UPDATE career_shop_orders SET[^"]*\bprice_kopeks\s*=/, "an order's amount is never recalculated");
  assert.match(read("app/api/career/shop/[action]/route.ts"), /priceKopeks: order\.priceRub \* 100/, "the Robokassa request uses the order's fixed amount");
  assert.match(read("components/AiCareerProductPage.tsx"), /const price = await readCurrentPrice\(\)/);
  assert.match(read("app/products/[slug]/page.tsx"), /export const revalidate = 60;/);
  assert.match(read("components/AiCareerPrice.tsx"), /будет показана при оформлении заказа до подтверждения оплаты/);
});

test("documents: three prices, the rule, order amount fixed at creation; refund = amount in the order", () => {
  const offer = read("app/offer/ai-career/page.tsx");
  assert.match(offer, /составляет 1 993 ₽, 3 990 ₽ или 5 900 ₽: автоматически по порядковому номеру подтверждённой продажи/);
  assert.match(offer, /фиксируется в заказе в момент его оформления, сообщается покупателю до подтверждения оплаты и после оформления заказа не изменяется/);
  assert.match(read("app/refund/page.tsx"), /полная уплаченная сумма, указанная в заказе/);
  for (const p of ["app/delivery/page.tsx", "app/requisites/page.tsx", "app/products/page.tsx"]) {
    const s = read(p);
    for (const x of ["1 993 ₽", "3 990 ₽", "5 900 ₽"]) assert.ok(s.includes(x), `${p}: ${x}`);
    assert.doesNotMatch(s, /первых 10|ценового этапа|фиксированн\S* цен|стоимость фиксирована|в разные периоды/, p);
  }
  assert.match(commerceCopy.pricePeriods, /фиксируется в заказе при его оформлении/);
});

test("price history is append-only and every change needs a reason and a confirmation", () => {
  const sql = read("migrations/career/012_stage1_otp_admin_commerce.sql");
  assert.match(sql, /commerce_price_changes is append-only/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON commerce_price_changes/);
  const s = read("lib/server/commerce/shop.ts");
  assert.match(s, /input\.confirm !== true/);
  assert.match(s, /Укажите причину изменения/);
  assert.match(s, /pg_advisory_xact_lock/);
});

test("product catalog and detail use one server-side current price, not an outdated card price", () => {
  const catalog = read("app/products/page.tsx");
  const card = read("components/ProductCard.tsx");
  assert.match(catalog, /await readCurrentPrice\(\)/);
  assert.match(catalog, /export const revalidate = 60/);
  assert.match(catalog, /currentPrice=\{p\.slug === "ai-career" \? price : undefined\}/);
  assert.match(card, /currentPrice\.known \? rubles\(currentPrice\.priceRub\)/);
  assert.match(card, /Действующая цена уточняется/);
});
