// AI Career 3.0 shop: the single price source and the order lifecycle. PREPARED FOR TEST PAYMENTS ONLY at stage 1
// (Robokassa IsTest=1 or the preview emulator); salesEnabled / legalApproved stay false.
//
// Price (config/ai-career-pricing.ts):
//   AUTO   — next sale number = confirmed paid sales + orders reserved right now + 1 → its tier price;
//   MANUAL — the administrator's price.
// Reservation: creating an order takes the next sale number and fixes its amount for RESERVATION_MINUTES. Every order
// creation and every payment confirmation runs under one advisory lock, so two buyers at a tier boundary get two
// different sale numbers (e.g. №10 → 1 993 ₽ and №11 → 3 990 ₽), never the same one. An unpaid reservation expires and
// frees its number for the next order; a buyer keeps the amount shown to them. Statistics count only confirmed payments.
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  autoPriceFor, isAllowedPrice, AUTO_PLAN_LAST_SALE, type AllowedPriceRub, type PriceMode,
} from "../../../config/ai-career-pricing.ts";

export const SHOP_LOCK = "SELECT pg_advisory_xact_lock(hashtext('career-shop-price'))";
export const OFFER_VERSION = "draft-2026-11-17";
type Q = Pick<PoolClient, "query">;

export class ShopError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const rub = (kopeks: number) => (kopeks / 100) as AllowedPriceRub;

/** Unpaid reservations past their time become `expired` (their sale numbers are free again). */
export async function expireStale(db: Q) {
  await db.query("UPDATE career_shop_orders SET status='expired' WHERE status='pending' AND reserved_until < now()");
}

export interface Quote {
  priceRub: AllowedPriceRub;
  mode: PriceMode;
  /** AUTO: the sale number a new order would take. */
  nextSale: number | null;
  paidSales: number;
  reserved: number;
  /** AUTO beyond sale №40: still the last price, flagged for the administrator's decision. */
  beyondPlan: boolean;
}

export async function quote(db: Q): Promise<Quote> {
  const s = (await db.query("SELECT mode, manual_price_kopeks FROM commerce_price_settings WHERE id=1")).rows[0];
  if (!s) throw new ShopError(500, "Настройки цены не найдены");
  const c = (await db.query(
    `SELECT count(*) FILTER (WHERE status='paid')::int AS paid,
            count(*) FILTER (WHERE status='pending' AND reserved_until >= now())::int AS reserved
       FROM career_shop_orders`)).rows[0];
  if (s.mode === "manual") {
    if (!isAllowedPrice(rub(s.manual_price_kopeks))) throw new ShopError(500, "Недопустимая ручная цена");
    return { priceRub: rub(s.manual_price_kopeks), mode: "manual", nextSale: null, paidSales: c.paid, reserved: c.reserved, beyondPlan: false };
  }
  const nextSale = c.paid + c.reserved + 1;
  return { priceRub: autoPriceFor(nextSale), mode: "auto", nextSale, paidSales: c.paid, reserved: c.reserved, beyondPlan: nextSale > AUTO_PLAN_LAST_SALE };
}

export interface Order {
  id: string; invId: number; priceRub: AllowedPriceRub; priceMode: PriceMode; salePosition: number | null; status: string;
  reservedUntil: string; createdAt: string; paidAt: string | null;
}
const toOrder = (r: Record<string, unknown>): Order => ({
  id: r.id as string, invId: Number(r.inv_id), priceRub: rub(r.price_kopeks as number), priceMode: r.price_mode as PriceMode,
  salePosition: (r.sale_position as number | null) ?? null, status: r.status as string,
  reservedUntil: new Date(r.reserved_until as string).toISOString(), createdAt: new Date(r.created_at as string).toISOString(),
  paidAt: r.paid_at ? new Date(r.paid_at as string).toISOString() : null,
});

/**
 * One order per buyer at a time. Re-uses the buyer's live reservation (same amount) instead of taking a second sale
 * number. `tx` must be a transaction; the lock serialises concurrent buyers.
 */
export async function createOrder(tx: Q, accountId: string, opts: { adultConfirmed: boolean; offerAccepted: boolean; providerMode: "test" | "emulator"; reservationMinutes: number }): Promise<Order> {
  if (opts.adultConfirmed !== true) throw new ShopError(400, "Подтвердите, что вам исполнилось 18 лет");
  if (opts.offerAccepted !== true) throw new ShopError(400, "Примите условия оферты");
  await tx.query(SHOP_LOCK);
  await expireStale(tx);
  const live = (await tx.query("SELECT * FROM career_shop_orders WHERE account_id=$1 AND status='pending'", [accountId])).rows[0];
  if (live) return toOrder(live);
  const q = await quote(tx);
  const r = await tx.query(
    `INSERT INTO career_shop_orders(id,account_id,price_kopeks,price_mode,sale_position,provider_mode,offer_version,adult_confirmed,reserved_until)
     VALUES($1,$2,$3,$4,$5,$6,$7,true,now()+make_interval(mins=>$8)) RETURNING *`,
    [randomUUID(), accountId, q.priceRub * 100, q.mode, q.mode === "auto" ? q.nextSale : null, opts.providerMode, OFFER_VERSION, opts.reservationMinutes]);
  return toOrder(r.rows[0]);
}

export async function cancelOrder(tx: Q, accountId: string, orderId: string) {
  const r = await tx.query("UPDATE career_shop_orders SET status='canceled', canceled_at=now() WHERE id=$1 AND account_id=$2 AND status='pending' RETURNING id", [orderId, accountId]);
  if (!r.rowCount) throw new ShopError(409, "Заказ уже нельзя отменить");
}

export async function orderForAccount(db: Q, accountId: string): Promise<Order | null> {
  await expireStale(db);
  const r = await db.query("SELECT * FROM career_shop_orders WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1", [accountId]);
  return r.rows[0] ? toOrder(r.rows[0]) : null;
}
export async function orderById(db: Q, id: string): Promise<(Order & { accountId: string | null }) | null> {
  const r = await db.query("SELECT * FROM career_shop_orders WHERE id=$1", [id]);
  return r.rows[0] ? { ...toOrder(r.rows[0]), accountId: r.rows[0].account_id } : null;
}

/** "1993", "1993.00", "1993.000000" → kopeks; anything else → null. */
export function outSumKopeks(value: string): number | null {
  const m = /^([0-9]{1,9})(?:[.]([0-9]{1,6}))?$/.exec(value);
  if (!m) return null;
  const frac = (m[2] ?? "").padEnd(6, "0");
  if (!/^[0-9]{2}0000$/.test(frac)) return null; // fractions of a kopek are never a valid amount
  return Number(m[1]) * 100 + Number(frac.slice(0, 2));
}

export type PaymentOutcome = "paid" | "duplicate" | "amount_mismatch" | "unknown_order" | "refund_required" | "not_payable";

/**
 * A payment confirmed by a verified server notification. Idempotent: a repeated notification changes nothing.
 * The amount must equal the order's fixed amount. A payment for a cancelled order is recorded as
 * `refund_required` (money must go back) and grants nothing.
 */
export async function confirmPayment(tx: Q, invId: number, outSum: string, paidAccessDays: number, shpOrder: string | null): Promise<{ outcome: PaymentOutcome; orderId: string | null }> {
  await tx.query(SHOP_LOCK);
  const o = (await tx.query("SELECT * FROM career_shop_orders WHERE inv_id=$1 FOR UPDATE", [invId])).rows[0];
  if (!o || (shpOrder !== null && shpOrder !== o.id)) return { outcome: "unknown_order", orderId: null };
  const kopeks = outSumKopeks(outSum);
  if (kopeks === null || kopeks !== o.price_kopeks) return { outcome: "amount_mismatch", orderId: o.id };
  if (o.status === "paid" || o.status === "refund_required" || o.status === "refunded") return { outcome: "duplicate", orderId: o.id };
  if (o.status === "canceled") {
    await tx.query("UPDATE career_shop_orders SET status='refund_required', paid_at=now(), paid_out_sum=$2 WHERE id=$1", [o.id, outSum]);
    return { outcome: "refund_required", orderId: o.id };
  }
  if (o.status !== "pending" && o.status !== "expired") return { outcome: "not_payable", orderId: o.id };
  // An expired reservation that was still paid at Robokassa is honoured at its fixed amount.
  await tx.query("UPDATE career_shop_orders SET status='paid', paid_at=now(), paid_out_sum=$2 WHERE id=$1", [o.id, outSum]);
  if (o.account_id) {
    const until = (await tx.query(
      "SELECT greatest(now(), (SELECT max(expires_at) FROM career_access_grants WHERE account_id=$1 AND revoked_at IS NULL)) AS t", [o.account_id])).rows[0].t;
    await tx.query("INSERT INTO career_access_grants(order_id,account_id,starts_at,expires_at) VALUES($1,$2,now(),$3::timestamptz + make_interval(days=>$4)) ON CONFLICT DO NOTHING",
      [o.id, o.account_id, until, paidAccessDays]);
  }
  return { outcome: "paid", orderId: o.id };
}

/** Refund recorded by the administrator (the money itself goes back through Robokassa's refund API / cabinet). Revokes access. */
export async function recordRefund(tx: Q, orderId: string, reason: string) {
  if (typeof reason !== "string" || reason.trim().length < 3 || reason.length > 300) throw new ShopError(400, "Укажите причину возврата (3–300 символов)");
  await tx.query(SHOP_LOCK);
  const r = await tx.query(
    "UPDATE career_shop_orders SET status='refunded', refunded_at=now(), refund_kopeks=price_kopeks, refund_reason=$2 WHERE id=$1 AND status IN ('paid','refund_required') RETURNING id",
    [orderId, reason.trim()]);
  if (!r.rowCount) throw new ShopError(409, "Возврат возможен только по оплаченному заказу");
  await tx.query("UPDATE career_access_grants SET revoked_at=now() WHERE order_id=$1 AND revoked_at IS NULL", [orderId]);
}

/** Administrator's price decision. MANUAL needs one of the three prices; AUTO recomputes the tier from confirmed sales. */
export async function setPrice(tx: Q, by: string, input: { mode: unknown; priceRub?: unknown; reason: unknown; confirm: unknown }) {
  if (input.confirm !== true) throw new ShopError(400, "Подтвердите изменение цены");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 3 || reason.length > 300) throw new ShopError(400, "Укажите причину изменения (3–300 символов)");
  if (input.mode !== "auto" && input.mode !== "manual") throw new ShopError(400, "Режим: AUTO или MANUAL");
  if (input.mode === "manual" && !isAllowedPrice(input.priceRub)) throw new ShopError(400, "Допустимые цены: 1 993, 3 990 или 5 900 ₽");
  await tx.query(SHOP_LOCK);
  await expireStale(tx);
  const before = await quote(tx);
  await tx.query("UPDATE commerce_price_settings SET mode=$1, manual_price_kopeks=$2, updated_at=now(), updated_by=$3 WHERE id=1",
    [input.mode, input.mode === "manual" ? (input.priceRub as number) * 100 : null, by]);
  const after = await quote(tx);
  await tx.query(
    "INSERT INTO commerce_price_changes(changed_by,old_mode,old_price_kopeks,new_mode,new_price_kopeks,paid_sales,reason) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [by, before.mode, before.priceRub * 100, after.mode, after.priceRub * 100, after.paidSales, reason]);
  return { before, after };
}

export async function priceHistory(db: Q, limit = 50) {
  const r = await db.query("SELECT * FROM commerce_price_changes ORDER BY id DESC LIMIT $1", [limit]);
  return r.rows.map((x) => ({
    at: new Date(x.changed_at).toISOString(), by: x.changed_by as string, oldMode: x.old_mode as PriceMode, oldPriceRub: rub(x.old_price_kopeks),
    newMode: x.new_mode as PriceMode, newPriceRub: rub(x.new_price_kopeks), paidSales: x.paid_sales as number, reason: x.reason as string,
  }));
}
