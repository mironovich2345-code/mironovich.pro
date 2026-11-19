/**
 * AI Career 3.0 — price tiers for the employee digital product. The ONLY source of the tier terms:
 * the product page, checkout and the payment order all read them from here, so the conditions cannot drift.
 *
 * Model (see docs/products/ai-career-pricing.md):
 *  - a buyer's tier is decided by the ordinal number of their SEAT, not by the moment they open the page;
 *  - a seat is taken by a short checkout hold and becomes permanent only when ЮKassa confirms a succeeded
 *    payment (verified by GET /payments/{id}); repeated notifications never take a second seat;
 *  - a seat of a succeeded payment is never returned, even after a refund, so the price never goes back down;
 *    a hold whose payment is canceled or expires is released;
 *  - the price is fixed in the order when the hold is created and shown before the buyer confirms payment.
 * Nothing here enables sales: salesEnabled / legalApproved stay in ai-career-commerce.ts.
 */
export interface PriceTier {
  id: "first" | "second" | "standard";
  /** Seats 1-based, inclusive; `to: null` = no upper limit. */
  from: number;
  to: number | null;
  priceRub: number;
  label: string;
  /** Short condition shown on the card. */
  condition: string;
}

export const PRICE_TIERS: readonly PriceTier[] = [
  { id: "first", from: 1, to: 10, priceRub: 1993, label: "Этап 1", condition: "Первые 10 покупателей" },
  { id: "second", from: 11, to: 20, priceRub: 3990, label: "Этап 2", condition: "Покупатели с 11-го по 20-го" },
  { id: "standard", from: 21, to: null, priceRub: 5900, label: "Этап 3", condition: "Начиная с 21-го покупателя" },
] as const;

export const capacity = (t: PriceTier) => (t.to === null ? null : t.to - t.from + 1);
export const rubles = (n: number) => n.toLocaleString("ru-RU").replace(/\s/g, " ") + " ₽";

/** Tier of a seat with the given 1-based ordinal number. */
export function tierForSeat(seat: number): PriceTier {
  if (!Number.isInteger(seat) || seat < 1) throw new RangeError("seat must be a positive integer");
  return PRICE_TIERS.find((t) => seat >= t.from && (t.to === null || seat <= t.to))!;
}

/** Availability confirmed by the server ledger (succeeded payments + active checkout holds). */
export interface ConfirmedAvailability {
  confirmed: true;
  /** Seats permanently taken by succeeded payments (refunded ones included — seats are not returned). */
  paidSeats: number;
  /** Seats temporarily held by open checkouts that have not expired. */
  activeHolds: number;
}
export type PriceAvailability = ConfirmedAvailability | { confirmed: false };

export interface PriceView {
  current: PriceTier;
  /** Only with confirmed server data and a limited tier; otherwise the exact number is hidden. */
  remaining: { left: number; of: number } | null;
}

/** What the page shows. Without confirmed data: the first tier is the launch price, no seat count. */
export function priceView(a: PriceAvailability): PriceView {
  if (!a.confirmed) return { current: PRICE_TIERS[0], remaining: null };
  const taken = a.paidSeats + a.activeHolds;
  const current = tierForSeat(taken + 1);
  const of = capacity(current);
  return { current, remaining: of === null ? null : { left: Math.max(0, current.to! - taken), of } };
}

/** Russian plural for «место». */
export const seatsWord = (n: number) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? "мест" : b === 1 ? "место" : b >= 2 && b <= 4 ? "места" : "мест";
};
