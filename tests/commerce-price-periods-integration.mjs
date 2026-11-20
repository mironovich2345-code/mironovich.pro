// Price periods (PREPARED, not connected): owner changes the price without a deploy, history is kept,
// orders keep the price fixed at creation, report per period. Needs a throw-away synthetic PostgreSQL DB:
// COMMERCE_TEST_DATABASE_URL=…/mironovich_career_test_pricing node --experimental-strip-types tests/commerce-price-periods-integration.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.COMMERCE_TEST_DATABASE_URL;
assert.ok(url && /\/mironovich_career_test(_[a-z0-9]+)*$/.test(url), "COMMERCE_TEST_DATABASE_URL must point to a synthetic test database");
const pool = new pg.Pool({ connectionString: url, max: 15 });
const P = await import("../lib/server/commerce/price-periods.ts");
const { readCurrentPrice } = await import("../lib/server/commerce/price-current.ts");
const { periodText } = await import("../config/ai-career-pricing.ts");
const pass = (n) => console.log("PASS", n);
const H = 3600_000;
const at = (ms) => new Date(Date.now() + ms);
const cli = (...args) => execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/commerce/price-admin.mjs", ...args], { env: { ...process.env, COMMERCE_DATABASE_URL: url } }).toString();

try {
  await pool.query("DROP TABLE IF EXISTS commerce_order_prices, commerce_price_periods");
  await pool.query(readFileSync("migrations/commerce/001_price_periods.sql", "utf8"));

  let r = await P.resolvePrice(pool);
  assert.deepEqual([r.price.kind, r.price.priceRub, r.periodId], ["default", 1993, null]);
  const launchOrder = await P.quoteOrder(pool, randomUUID());
  assert.deepEqual([launchOrder.priceRub, launchOrder.periodId], [1993, null]);
  pass("no periods recorded → launch price 1 993 ₽");

  // Owner sets a base price and plans a promotion — no code change, no deploy.
  const base = Number(await P.setBasePrice(pool, 3990, new Date(), "тест спроса 3 990"));
  r = await P.resolvePrice(pool);
  assert.deepEqual([r.price.kind, r.price.priceRub, r.periodId], ["base", 3990, base]);
  const promo = Number(await P.schedulePromo(pool, 1993, at(H), at(25 * H), "акция на сутки"));
  r = await P.resolvePrice(pool, at(2 * H));
  assert.deepEqual([r.price.kind, r.price.priceRub, r.price.afterPriceRub, r.periodId], ["promo", 1993, 3990, promo]);
  assert.match(periodText(r.price), /^Цена действует до \d{1,2} [а-я]+ \d{4} г\., \d{2}:\d{2} МСК включительно\.$/);
  assert.equal((await P.resolvePrice(pool, at(26 * H))).price.priceRub, 3990, "after the promotion the base price applies again");
  pass("base price and a promotion with start and end; real end shown; base returns after it");

  for (const [fn, msg] of [
    [() => P.setBasePrice(pool, 4990), /Допустимые цены/],
    [() => P.setBasePrice(pool, "3990"), /Допустимые цены/],
    [() => P.setBasePrice(pool, 5900, at(-H)), /не может быть в прошлом/],
    [() => P.schedulePromo(pool, 5900, at(3 * H), at(4 * H)), /Пересекается с акцией/],
    [() => P.schedulePromo(pool, 5900, at(30 * H), at(29 * H)), /позже начала/],
  ]) await assert.rejects(fn(), msg);
  await assert.rejects(pool.query("INSERT INTO commerce_price_periods(kind,price_kopeks,starts_at) VALUES('base',450000,now())"), /check/i);
  pass("only 1 993 / 3 990 / 5 900 ₽; no rewriting the past; no overlapping promotions (checked under a lock); prices also bound by a DB CHECK");

  // Orders keep the price fixed at creation.
  const o1 = randomUUID();
  const q = await Promise.all(Array.from({ length: 10 }, () => P.quoteOrder(pool, o1)));
  assert.equal(new Set(q.map((x) => `${x.priceRub}/${x.periodId}`)).size, 1, "parallel repeats of one checkout → one price");
  assert.deepEqual([q[0].priceRub, q[0].periodId], [3990, base]);
  const next = Number(await P.setBasePrice(pool, 5900, new Date(), "тест 5 900"));
  assert.equal((await P.quoteOrder(pool, o1)).priceRub, 3990, "a later price change does not alter an existing order");
  const o2 = randomUUID();
  assert.equal((await P.quoteOrder(pool, o2)).priceRub, 5900);
  pass("order price fixed at creation; later change applies only to new orders");

  // Payment verification against the fixed amount; idempotent notifications.
  assert.equal(await P.markOrderPaid(pool, { orderId: o1, paymentId: "pay-0000-0001", amountKopeks: 590000 }), "rejected", "amount must equal the order price");
  assert.equal(await P.markOrderPaid(pool, { orderId: o1, paymentId: "pay-0000-0001", amountKopeks: 399000 }), "paid");
  assert.equal(await P.markOrderPaid(pool, { orderId: o1, paymentId: "pay-0000-0001", amountKopeks: 399000 }), "already_paid");
  assert.equal(await P.markOrderPaid(pool, { orderId: o1, paymentId: "pay-0000-0002", amountKopeks: 399000 }), "rejected", "a second payment for one order");
  assert.equal(await P.markOrderCanceled(pool, o1), false, "a paid order is not cancelled");
  assert.equal(await P.markOrderPaid(pool, { orderId: o2, paymentId: "pay-0000-0003", amountKopeks: 590000 }), "paid");
  assert.equal(await P.markOrderRefunded(pool, o2), true);
  const o3 = randomUUID();
  await P.quoteOrder(pool, o3);
  assert.equal(await P.markOrderCanceled(pool, o3), true);
  pass("payment must match the fixed amount; repeated notifications are idempotent; refunds and cancellations recorded");

  // Stopping periods keeps history.
  assert.equal(await P.stopPeriod(pool, promo), "canceled", "future promotion cancelled");
  const live = Number(await P.schedulePromo(pool, 1993, new Date(), at(H), "короткая акция"));
  assert.equal((await P.resolvePrice(pool)).periodId, live);
  assert.equal(await P.stopPeriod(pool, live), "ended", "running promotion ended now");
  assert.equal((await P.resolvePrice(pool)).price.priceRub, 5900);
  await assert.rejects(P.stopPeriod(pool, next), /заменяют новой базовой ценой/);
  const all = await P.listPeriods(pool);
  assert.ok(all.find((p) => p.id === promo).canceledAt && all.find((p) => p.id === live).endsAt, "nothing is deleted");
  pass("future periods are cancelled, running promotions ended early — history is kept");

  const rep = await P.periodReport(pool);
  const byId = (id) => rep.find((x) => x.periodId === id);
  assert.deepEqual([byId(null).ordersCreated, byId(null).priceRub], [1, 1993]);
  assert.deepEqual([byId(base).ordersCreated, byId(base).ordersPaid, byId(base).revenueRub, byId(base).paidShare], [1, 1, 3990, 100]);
  assert.deepEqual([byId(next).ordersCreated, byId(next).ordersPaid, byId(next).ordersRefunded, byId(next).revenueRub], [2, 1, 1, 0], "refunds excluded from revenue");
  assert.ok(byId(base).endsAt, "a base period ends when the next base price starts");
  pass("report per price period: orders, payments, refunds, paid share, revenue");

  assert.match(cli("current"), /Сейчас: 5 900 ₽ · базовая цена/);
  assert.match(cli("set", "3990", "", "через CLI"), /Записан период №\d+\. Сейчас: 3 990 ₽/);
  assert.match(execFileSync("bash", ["-c", `COMMERCE_DATABASE_URL='${url}' ${process.execPath} --experimental-strip-types --no-warnings scripts/commerce/price-admin.mjs set 4990 2>&1 || true`]).toString(), /Отклонено: Допустимые цены/);
  assert.match(cli("list"), /ОТМЕНЁН/);
  assert.match(cli("report"), /выручка/);
  pass("owner CLI: current, set, list, report; invalid price refused");

  assert.deepEqual(await readCurrentPrice({ COMMERCE_DATABASE_URL: url }), { known: true, kind: "base", priceRub: 3990, startsAt: (await P.resolvePrice(pool)).price.startsAt, endsAt: null, afterPriceRub: null });
  assert.deepEqual(await readCurrentPrice({}), { known: true, kind: "default", priceRub: 1993, startsAt: null, endsAt: null, afterPriceRub: null });
  pass("page reads the current price from the database; without one, the launch price");
  console.log("commerce price periods: 9 checks passed");
} finally {
  await pool.end();
}
