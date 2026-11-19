// Seat ledger (PREPARED, not connected): concurrency, idempotent notifications, refunds, cancellations.
// Needs a throw-away synthetic PostgreSQL database: COMMERCE_TEST_DATABASE_URL=…/mironovich_career_test_pricing
// Usage: node --experimental-strip-types tests/commerce-price-seats-integration.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.COMMERCE_TEST_DATABASE_URL;
assert.ok(url && /\/mironovich_career_test(_[a-z0-9]+)*$/.test(url), "COMMERCE_TEST_DATABASE_URL must point to a synthetic test database");
const pool = new pg.Pool({ connectionString: url, max: 25 });
const L = await import("../lib/server/commerce/price-seats.ts");
const { priceView } = await import("../config/ai-career-pricing.ts");
const pass = (n) => console.log("PASS", n);
const pay = (o, h, id = "pay-" + o.slice(0, 8)) => ({ orderId: o, paymentId: id, amountKopeks: h.priceKopeks });

try {
  await pool.query("DROP TABLE IF EXISTS commerce_price_seats");
  await pool.query(readFileSync("migrations/commerce/001_price_seats.sql", "utf8"));

  // 1. 25 buyers start checkout at the same moment: unique seats 1..25, exactly 10 at the first price.
  const orders = Array.from({ length: 25 }, () => randomUUID());
  const holds = await Promise.all(orders.map((o) => L.holdSeat(pool, o)));
  assert.deepEqual(holds.map((h) => h.seat).sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i + 1));
  assert.equal(holds.filter((h) => h.priceKopeks === 199300).length, 10);
  assert.equal(holds.filter((h) => h.priceKopeks === 399000).length, 10);
  assert.equal(holds.filter((h) => h.priceKopeks === 590000).length, 5);
  assert.deepEqual(await L.holdSeat(pool, orders[0]), holds[0], "repeat checkout of the same order keeps its seat and price");
  pass("concurrent checkouts: no race for the last seat, never more than 10 at 1 993 ₽, price fixed per order");

  // 2. Payment flow with duplicate notifications.
  const [o1] = orders, h1 = holds[0];
  assert.equal(await L.decideCapture(pool, pay(o1, h1)), "capture");
  assert.equal(await L.decideCapture(pool, pay(o1, h1)), "capture", "repeated waiting_for_capture");
  assert.equal(await L.confirmPaid(pool, pay(o1, h1)), "paid");
  for (let i = 0; i < 5; i++) assert.equal(await L.confirmPaid(pool, pay(o1, h1)), "already_paid");
  let a = await L.readAvailability(pool);
  assert.equal(a.paidSeats, 1, "duplicate succeeded notifications do not increase the counter");
  pass("idempotent ЮKassa notifications: one seat per paid order");

  // 3. Wrong amount, foreign payment id, unknown order → no capture.
  const o2 = orders[1], h2 = holds[1];
  assert.equal(await L.decideCapture(pool, { ...pay(o2, h2), amountKopeks: 100 }), "cancel");
  assert.equal(await L.decideCapture(pool, pay(o2, h2, "pay-other-1")), "capture");
  assert.equal(await L.decideCapture(pool, pay(o2, h2, "pay-other-2")), "cancel", "second payment for one order");
  assert.equal(await L.confirmPaid(pool, pay(o2, h2, "pay-other-2")), "rejected");
  assert.equal(await L.decideCapture(pool, pay(randomUUID(), h2)), "cancel");
  pass("amount and payment id must match the order");

  // 4. Canceled payment releases the seat; the next checkout takes the lowest free seat at its tier price.
  const o3 = orders[2];
  assert.equal(await L.releaseUnpaid(pool, o3), true);
  const late = await L.holdSeat(pool, randomUUID());
  assert.deepEqual([late.seat, late.priceKopeks], [3, 199300]);
  assert.equal(await L.releaseUnpaid(pool, o1), false, "a paid seat is never released by a cancel notification");
  pass("canceled/unpaid holds are released; paid seats are not");

  // 5. Refund: money back, seat stays — the price never steps back down.
  assert.equal(await L.markRefunded(pool, o1), true);
  a = await L.readAvailability(pool);
  assert.equal(a.paidSeats, 1);
  pass("refund keeps the seat (explicit rule)");

  // 6. Expired hold: reclaimed, and a late payment for it is cancelled instead of captured.
  const o4 = orders[3], h4 = holds[3];
  await pool.query("UPDATE commerce_price_seats SET hold_expires_at=now()-interval '1 minute' WHERE order_id=$1", [o4]);
  assert.equal(await L.decideCapture(pool, pay(o4, h4)), "cancel");
  pass("payment after an expired hold is cancelled — no money is taken at a stale price");

  // 7. Page counter from the ledger.
  await pool.query("DELETE FROM commerce_price_seats");
  for (let i = 0; i < 3; i++) {
    const o = randomUUID(), h = await L.holdSeat(pool, o);
    await L.decideCapture(pool, pay(o, h));
    await L.confirmPaid(pool, pay(o, h));
  }
  await L.holdSeat(pool, randomUUID());
  a = await L.readAvailability(pool);
  assert.deepEqual(priceView(a).remaining, { left: 6, of: 10 });
  pass("counter = 10 − paid − active holds (3 paid + 1 hold → 6 of 10)");

  // 8. The database itself refuses a first-tier price on seat 11.
  await assert.rejects(pool.query("INSERT INTO commerce_price_seats(seat,tier,price_kopeks,order_id,state,hold_expires_at) VALUES(11,'first',199300,$1,'held',now())", [randomUUID()]));
  pass("schema CHECK forbids an 11th seat at 1 993 ₽");
  console.log("commerce price seats: 8 checks passed");
} finally {
  await pool.end();
}
