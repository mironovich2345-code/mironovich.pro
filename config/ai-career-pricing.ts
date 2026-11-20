/**
 * AI Career 3.0 — price of the employee digital product. The ONLY source of the price rules: catalogue, product
 * page, checkout, the Robokassa request and the reports all read the price through lib/server/commerce/shop.ts,
 * which applies these rules (see docs/products/ai-career-pricing.md).
 *
 * Two modes, switched by the administrator (every change is kept in an append-only history):
 *  - AUTO:   the price follows the number of CONFIRMED sales plus orders currently reserved:
 *            sales № 1–10 → 1 993 ₽, № 11–20 → 3 990 ₽, № 21–40 → 5 900 ₽; after № 40 → 5 900 ₽ until a separate decision;
 *  - MANUAL: the administrator picks one of the three prices; it applies to every new order and to the public pages.
 * An order fixes its amount when it is created; nothing recalculates it later. The site shows one price, with no
 * struck-through "old" price, counters or timers. Nothing here enables sales: salesEnabled / legalApproved stay in
 * ai-career-commerce.ts.
 */
export const ALLOWED_PRICES_RUB = [1993, 3990, 5900] as const;
export type AllowedPriceRub = (typeof ALLOWED_PRICES_RUB)[number];
/** Price shown while no commerce database is connected (the public site today). */
export const DEFAULT_PRICE_RUB: AllowedPriceRub = 1993;
export type PriceMode = "auto" | "manual";

/** AUTO ladder by sale number. Sales after the last tier keep the last price until the administrator decides. */
export const AUTO_TIERS: ReadonlyArray<{ from: number; to: number; priceRub: AllowedPriceRub }> = [
  { from: 1, to: 10, priceRub: 1993 },
  { from: 11, to: 20, priceRub: 3990 },
  { from: 21, to: 40, priceRub: 5900 },
];
export const AFTER_PLAN_PRICE_RUB: AllowedPriceRub = 5900;
export const AUTO_PLAN_LAST_SALE = 40;

export function autoPriceFor(saleNumber: number): AllowedPriceRub {
  if (!Number.isInteger(saleNumber) || saleNumber < 1) throw new RangeError("sale number must be a positive integer");
  return AUTO_TIERS.find((t) => saleNumber >= t.from && saleNumber <= t.to)?.priceRub ?? AFTER_PLAN_PRICE_RUB;
}

export const isAllowedPrice = (n: unknown): n is AllowedPriceRub =>
  typeof n === "number" && (ALLOWED_PRICES_RUB as readonly number[]).includes(n);

export const rubles = (n: number) => n.toLocaleString("ru-RU").replace(/\s/g, " ") + " ₽";

/** What the page may say about the price right now: one price, or "unknown" when the price source cannot be read. */
export type CurrentPrice =
  | { known: true; priceRub: AllowedPriceRub; mode: PriceMode | "default" }
  | { known: false };
