// Seat ledger for the AI Career 3.0 price tiers. PREPARED, NOT CONNECTED to any route: real sales are off.
// Every function runs in one transaction under one advisory lock, so concurrent checkouts are serialised:
// two buyers can never get the same seat and the first tier can never exceed 10 seats (also enforced by CHECKs).
// Payment status must come from a verified GET /payments/{id} (never from a notification body alone).
import type { PoolClient, Pool } from "pg";
import { PRICE_TIERS, tierForSeat, type ConfirmedAvailability } from "../../../config/ai-career-pricing.ts";

export const HOLD_MINUTES = 30;
const LOCK = "SELECT pg_advisory_xact_lock(hashtext('ai-career-price-seats'))";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function tx<T>(pool: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(LOCK);
    const v = await fn(c);
    await c.query("COMMIT");
    return v;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
/** Expired holds that were never captured go back to the pool (called under the lock). */
const reclaim = (c: PoolClient) => c.query("DELETE FROM commerce_price_seats WHERE state='held' AND hold_expires_at <= now()");

export interface Hold { seat: number; tier: string; priceKopeks: number; expiresAt: string }
const holdOf = (r: { seat: number; tier: string; price_kopeks: number; hold_expires_at: Date }): Hold =>
  ({ seat: r.seat, tier: r.tier, priceKopeks: r.price_kopeks, expiresAt: new Date(r.hold_expires_at).toISOString() });

/** Checkout: reserve the lowest free seat and fix its price in the order. Idempotent per order. */
export function holdSeat(pool: Pool, orderId: string): Promise<Hold> {
  if (!UUID.test(orderId)) throw new Error("order id must be a UUID");
  return tx(pool, async (c) => {
    await reclaim(c);
    const mine = await c.query("SELECT * FROM commerce_price_seats WHERE order_id=$1", [orderId]);
    if (mine.rows[0]) return holdOf(mine.rows[0]);
    const free = await c.query(
      "SELECT min(s)::int AS seat FROM generate_series(1, (SELECT coalesce(max(seat),0)+1 FROM commerce_price_seats)) s WHERE NOT EXISTS (SELECT 1 FROM commerce_price_seats WHERE seat=s)");
    const seat = free.rows[0].seat as number;
    const tier = tierForSeat(seat);
    const r = await c.query(
      "INSERT INTO commerce_price_seats(seat,tier,price_kopeks,order_id,state,hold_expires_at) VALUES($1,$2,$3,$4,'held',now()+make_interval(mins=>$5)) RETURNING *",
      [seat, tier.id, tier.priceRub * 100, orderId, HOLD_MINUTES]);
    return holdOf(r.rows[0]);
  });
}

export type CaptureDecision = "capture" | "cancel";
/** Verified waiting_for_capture (two-stage payment). Capture only if this order still holds its seat and the
 *  amount equals the fixed price; otherwise cancel — no money is taken and the buyer re-quotes. Idempotent. */
export function decideCapture(pool: Pool, p: { orderId: string; paymentId: string; amountKopeks: number }): Promise<CaptureDecision> {
  return tx(pool, async (c) => {
    const r = await c.query("SELECT * FROM commerce_price_seats WHERE order_id=$1", [p.orderId]);
    const row = r.rows[0];
    if (!row) return "cancel"; // hold reclaimed and possibly given to another buyer
    if (row.payment_id && row.payment_id !== p.paymentId) return "cancel"; // a second payment for the same order
    if (row.price_kopeks !== p.amountKopeks) return "cancel";
    if (row.state === "held") {
      if (new Date(row.hold_expires_at).getTime() <= Date.now()) {
        await c.query("DELETE FROM commerce_price_seats WHERE order_id=$1 AND state='held'", [p.orderId]);
        return "cancel";
      }
      await c.query("UPDATE commerce_price_seats SET state='capturing', payment_id=$2 WHERE order_id=$1", [p.orderId, p.paymentId]);
    }
    return "capture";
  });
}

/** Verified succeeded: the seat becomes permanent. Repeated notifications change nothing. */
export function confirmPaid(pool: Pool, p: { orderId: string; paymentId: string; amountKopeks: number }): Promise<"paid" | "already_paid" | "rejected"> {
  return tx(pool, async (c) => {
    const r = await c.query("SELECT * FROM commerce_price_seats WHERE order_id=$1", [p.orderId]);
    const row = r.rows[0];
    if (!row || row.payment_id !== p.paymentId || row.price_kopeks !== p.amountKopeks) return "rejected";
    if (row.state === "paid") return "already_paid";
    await c.query("UPDATE commerce_price_seats SET state='paid', paid_at=now() WHERE order_id=$1", [p.orderId]);
    return "paid";
  });
}

/** Verified canceled (or capture abandoned): release a seat that was never paid. A paid seat is never released. */
export function releaseUnpaid(pool: Pool, orderId: string): Promise<boolean> {
  return tx(pool, async (c) =>
    ((await c.query("DELETE FROM commerce_price_seats WHERE order_id=$1 AND state IN ('held','capturing')", [orderId])).rowCount ?? 0) > 0);
}

/** Refund rule: the money is returned, the seat stays taken — prices never step back down. */
export function markRefunded(pool: Pool, orderId: string): Promise<boolean> {
  return tx(pool, async (c) =>
    ((await c.query("UPDATE commerce_price_seats SET refunded_at=coalesce(refunded_at, now()) WHERE order_id=$1 AND state='paid'", [orderId])).rowCount ?? 0) > 0);
}

/** Server data for the page counter. */
export function readAvailability(pool: Pool): Promise<ConfirmedAvailability> {
  return tx(pool, async (c) => {
    await reclaim(c);
    const r = await c.query(
      "SELECT count(*) FILTER (WHERE state='paid')::int AS paid, count(*) FILTER (WHERE state IN ('held','capturing'))::int AS holds FROM commerce_price_seats");
    return { confirmed: true, paidSeats: r.rows[0].paid, activeHolds: r.rows[0].holds };
  });
}

export const TIER_PRICES_KOPEKS = PRICE_TIERS.map((t) => t.priceRub * 100);
