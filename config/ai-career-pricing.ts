/**
 * AI Career 3.0 — price of the employee digital product. The ONLY source of the price rules:
 * the product page, checkout and the payment order all read them from here.
 *
 * Model (see docs/products/ai-career-pricing.md):
 *  - the seller sets the current price at run time (no code change, no deploy) by recording a price period
 *    in the commerce database: a base price from a date, or a promotion with a start and an end;
 *  - only the three allowed prices can be set; every change is kept as history for comparing periods;
 *  - an order records its price and period when it is created; a later price change never alters it.
 * No seat limits, counters or invented discounts. Nothing here enables sales: salesEnabled / legalApproved
 * stay in ai-career-commerce.ts.
 */
export const ALLOWED_PRICES_RUB = [1993, 3990, 5900] as const;
export type AllowedPriceRub = (typeof ALLOWED_PRICES_RUB)[number];
/** Launch price used while no period is recorded (and in the synthetic sandbox). */
export const DEFAULT_PRICE_RUB: AllowedPriceRub = 1993;
export const PRICE_TIME_ZONE = "Europe/Moscow";

export const isAllowedPrice = (n: unknown): n is AllowedPriceRub =>
  typeof n === "number" && (ALLOWED_PRICES_RUB as readonly number[]).includes(n);

export const rubles = (n: number) => n.toLocaleString("ru-RU").replace(/\s/g, " ") + " ₽";

/** What the page may say about the price right now. */
export type CurrentPrice =
  | {
      known: true;
      priceRub: AllowedPriceRub;
      /** "default" = no period recorded yet (launch price); "base" = price set from a date; "promo" = limited period. */
      kind: "default" | "base" | "promo";
      startsAt: string | null;
      endsAt: string | null;
      /** Base price that applies after a promotion ends, if one is recorded. */
      afterPriceRub: AllowedPriceRub | null;
    }
  | { known: false };

const dateFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: PRICE_TIME_ZONE, day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: PRICE_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
/** «30 ноября 2026 года, 23:59 МСК» */
export const moscowDateTime = (iso: string) => `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))} МСК`;

/** Plain sentence about the period of a promotion; null when the price has no end date. */
export function periodText(p: CurrentPrice): string | null {
  if (!p.known || p.kind !== "promo" || !p.endsAt) return null;
  // ends_at is exclusive: the last moment of the price is one minute earlier.
  const last = new Date(new Date(p.endsAt).getTime() - 60_000).toISOString();
  return `Цена действует до ${moscowDateTime(last)} включительно.`;
}
