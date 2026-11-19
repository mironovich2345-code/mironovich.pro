// AI Career 3.0 price periods. PREPARED, NOT CONNECTED to live sales: real payments are off.
// The seller changes the current price with scripts/commerce/price-admin.mjs (validated, logged as history);
// the page reads it at request time; an order records its price once, at creation.
import type { Pool, PoolClient } from "pg";
import { DEFAULT_PRICE_RUB, isAllowedPrice, type AllowedPriceRub, type CurrentPrice } from "../../../config/ai-career-pricing.ts";

type Db = Pick<Pool, "query">;
const LOCK = "SELECT pg_advisory_xact_lock(hashtext('ai-career-price-periods'))";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A period may start at most this far in the past (clock skew), so recorded history is never rewritten. */
const PAST_TOLERANCE_MS = 5 * 60_000;

export class PriceInputError extends Error {}

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
const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);
const rub = (kopeks: number) => (kopeks / 100) as AllowedPriceRub;

function checkPrice(priceRub: unknown): AllowedPriceRub {
  if (!isAllowedPrice(priceRub)) throw new PriceInputError("Допустимые цены: 1993, 3990 или 5900 ₽");
  return priceRub;
}
function checkDate(value: Date, name: string, now: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new PriceInputError(`Неверная дата: ${name}`);
  if (value.getTime() < now.getTime() - PAST_TOLERANCE_MS) throw new PriceInputError(`${name} не может быть в прошлом: история цен не переписывается`);
}

export interface ResolvedPrice { price: Extract<CurrentPrice, { known: true }>; periodId: number | null }

/** The price in force at `at`: an active promotion, otherwise the latest started base price, otherwise the launch default. */
export async function resolvePrice(db: Db, at: Date = new Date()): Promise<ResolvedPrice> {
  const base = async (t: Date) => (await db.query(
    "SELECT * FROM commerce_price_periods WHERE kind='base' AND canceled_at IS NULL AND starts_at<=$1 ORDER BY starts_at DESC, id DESC LIMIT 1", [t])).rows[0];
  const promo = (await db.query(
    "SELECT * FROM commerce_price_periods WHERE kind='promo' AND canceled_at IS NULL AND starts_at<=$1 AND ends_at>$1 ORDER BY id DESC LIMIT 1", [at])).rows[0];
  if (promo) {
    const after = await base(new Date(promo.ends_at));
    return {
      periodId: Number(promo.id),
      price: { known: true, kind: "promo", priceRub: rub(promo.price_kopeks), startsAt: iso(promo.starts_at), endsAt: iso(promo.ends_at), afterPriceRub: after ? rub(after.price_kopeks) : DEFAULT_PRICE_RUB },
    };
  }
  const b = await base(at);
  if (b) return { periodId: Number(b.id), price: { known: true, kind: "base", priceRub: rub(b.price_kopeks), startsAt: iso(b.starts_at), endsAt: null, afterPriceRub: null } };
  return { periodId: null, price: { known: true, kind: "default", priceRub: DEFAULT_PRICE_RUB, startsAt: null, endsAt: null, afterPriceRub: null } };
}

/** New base price from `startsAt` (default: now) until another base price replaces it. */
export async function setBasePrice(pool: Pool, priceRub: unknown, startsAt = new Date(), note = "", now = new Date()) {
  const price = checkPrice(priceRub);
  checkDate(startsAt, "Дата начала", now);
  return tx(pool, async (c) => (await c.query(
    "INSERT INTO commerce_price_periods(kind,price_kopeks,starts_at,note) VALUES('base',$1,$2,$3) RETURNING id", [price * 100, startsAt, note.slice(0, 120)])).rows[0].id as string);
}

/** Promotion price within [startsAt, endsAt). Promotions may not overlap, so every moment has one clear price. */
export async function schedulePromo(pool: Pool, priceRub: unknown, startsAt: Date, endsAt: Date, note = "", now = new Date()) {
  const price = checkPrice(priceRub);
  checkDate(startsAt, "Дата начала", now);
  checkDate(endsAt, "Дата окончания", now);
  if (endsAt.getTime() <= startsAt.getTime()) throw new PriceInputError("Окончание должно быть позже начала");
  return tx(pool, async (c) => {
    const clash = await c.query(
      "SELECT id FROM commerce_price_periods WHERE kind='promo' AND canceled_at IS NULL AND starts_at<$2 AND ends_at>$1", [startsAt, endsAt]);
    if (clash.rowCount) throw new PriceInputError(`Пересекается с акцией №${clash.rows[0].id}: сначала отмените или завершите её`);
    return (await c.query(
      "INSERT INTO commerce_price_periods(kind,price_kopeks,starts_at,ends_at,note) VALUES('promo',$1,$2,$3,$4) RETURNING id",
      [price * 100, startsAt, endsAt, note.slice(0, 120)])).rows[0].id as string;
  });
}

/** Future period → cancelled (row kept). Running promotion → ended now (its real interval stays in history).
 *  A base price that has already started is replaced with a new base price, not cancelled. */
export async function stopPeriod(pool: Pool, id: number, now = new Date()) {
  return tx(pool, async (c) => {
    const p = (await c.query("SELECT * FROM commerce_price_periods WHERE id=$1 AND canceled_at IS NULL", [id])).rows[0];
    if (!p) throw new PriceInputError("Период не найден или уже отменён");
    if (new Date(p.starts_at) > now) {
      await c.query("UPDATE commerce_price_periods SET canceled_at=$2 WHERE id=$1", [id, now]);
      return "canceled" as const;
    }
    if (p.kind === "promo" && new Date(p.ends_at) > now) {
      await c.query("UPDATE commerce_price_periods SET ends_at=$2 WHERE id=$1", [id, now]);
      return "ended" as const;
    }
    throw new PriceInputError(p.kind === "base" ? "Начавшуюся базовую цену заменяют новой базовой ценой" : "Акция уже завершилась");
  });
}

export async function listPeriods(db: Db) {
  return (await db.query("SELECT id,kind,price_kopeks,starts_at,ends_at,note,created_at,canceled_at FROM commerce_price_periods ORDER BY starts_at, id")).rows
    .map((r) => ({ id: Number(r.id), kind: r.kind as string, priceRub: rub(r.price_kopeks), startsAt: iso(r.starts_at), endsAt: iso(r.ends_at), note: r.note as string, createdAt: iso(r.created_at), canceledAt: iso(r.canceled_at) }));
}

// ——— orders: the price is fixed once, at creation ———
export interface OrderPrice { orderId: string; priceRub: AllowedPriceRub; periodId: number | null; createdAt: string; status: string }
const orderOf = (r: Record<string, unknown>): OrderPrice =>
  ({ orderId: r.order_id as string, priceRub: rub(r.price_kopeks as number), periodId: r.period_id === null ? null : Number(r.period_id), createdAt: iso(r.created_at as Date)!, status: r.status as string });

/** Checkout: record the price in force now for this order. Idempotent — repeating returns the original price. */
export async function quoteOrder(pool: Pool, orderId: string): Promise<OrderPrice> {
  if (!UUID.test(orderId)) throw new PriceInputError("order id must be a UUID");
  return tx(pool, async (c) => {
    const existing = (await c.query("SELECT * FROM commerce_order_prices WHERE order_id=$1", [orderId])).rows[0];
    if (existing) return orderOf(existing);
    const { price, periodId } = await resolvePrice(c);
    return orderOf((await c.query(
      "INSERT INTO commerce_order_prices(order_id,period_id,price_kopeks) VALUES($1,$2,$3) RETURNING *", [orderId, periodId, price.priceRub * 100])).rows[0]);
  });
}

/** Verified succeeded payment (GET /payments/{id}). The amount must equal the order's fixed price. Idempotent. */
export async function markOrderPaid(pool: Pool, p: { orderId: string; paymentId: string; amountKopeks: number }) {
  return tx(pool, async (c) => {
    const o = (await c.query("SELECT * FROM commerce_order_prices WHERE order_id=$1", [p.orderId])).rows[0];
    if (!o || o.price_kopeks !== p.amountKopeks) return "rejected" as const;
    if (o.status === "paid" || o.status === "refunded") return o.payment_id === p.paymentId ? ("already_paid" as const) : ("rejected" as const);
    if (o.status !== "created") return "rejected" as const;
    await c.query("UPDATE commerce_order_prices SET status='paid', payment_id=$2, paid_at=now() WHERE order_id=$1", [p.orderId, p.paymentId]);
    return "paid" as const;
  });
}
export async function markOrderCanceled(pool: Pool, orderId: string) {
  return tx(pool, async (c) => ((await c.query("UPDATE commerce_order_prices SET status='canceled' WHERE order_id=$1 AND status='created'", [orderId])).rowCount ?? 0) > 0);
}
export async function markOrderRefunded(pool: Pool, orderId: string) {
  return tx(pool, async (c) => ((await c.query("UPDATE commerce_order_prices SET status='refunded', refunded_at=now() WHERE order_id=$1 AND status='paid'", [orderId])).rowCount ?? 0) > 0);
}

/** Per price period: orders created, paid, refunded, paid share, revenue. Effective end of a base period =
 *  start of the next base period. Visits to the page per period come from web analytics (with consent). */
export async function periodReport(db: Db) {
  const r = await db.query(`
    WITH p AS (
      SELECT id, kind, price_kopeks, starts_at,
        CASE WHEN kind='promo' THEN ends_at
             ELSE lead(starts_at) OVER (PARTITION BY kind ORDER BY starts_at, id) END AS ends_at, note
      FROM commerce_price_periods WHERE canceled_at IS NULL
    ), all_periods AS (
      SELECT NULL::bigint AS id, 'default' AS kind, 199300 AS price_kopeks, NULL::timestamptz AS starts_at, NULL::timestamptz AS ends_at, 'стартовая цена' AS note
      UNION ALL SELECT * FROM p
    )
    SELECT ap.id, ap.kind, ap.price_kopeks, ap.starts_at, ap.ends_at, ap.note,
      count(o.order_id)::int AS orders_created,
      count(o.order_id) FILTER (WHERE o.status IN ('paid','refunded'))::int AS orders_paid,
      count(o.order_id) FILTER (WHERE o.status = 'refunded')::int AS orders_refunded,
      coalesce(sum(o.price_kopeks) FILTER (WHERE o.status = 'paid'), 0)::bigint AS revenue_kopeks
    FROM all_periods ap LEFT JOIN commerce_order_prices o ON o.period_id IS NOT DISTINCT FROM ap.id
    GROUP BY ap.id, ap.kind, ap.price_kopeks, ap.starts_at, ap.ends_at, ap.note
    HAVING ap.id IS NOT NULL OR count(o.order_id) > 0
    ORDER BY ap.starts_at NULLS FIRST, ap.id`);
  return r.rows.map((x) => ({
    periodId: x.id === null ? null : Number(x.id), kind: x.kind as string, priceRub: rub(x.price_kopeks), startsAt: iso(x.starts_at), endsAt: iso(x.ends_at), note: x.note as string,
    ordersCreated: x.orders_created as number, ordersPaid: x.orders_paid as number, ordersRefunded: x.orders_refunded as number,
    paidShare: x.orders_created ? Math.round((x.orders_paid / x.orders_created) * 1000) / 10 : null,
    revenueRub: Number(x.revenue_kopeks) / 100,
  }));
}
