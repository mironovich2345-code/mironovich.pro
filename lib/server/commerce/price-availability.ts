// What the product page may claim about the remaining seats. While real sales are off there is no
// production ledger, so nothing is confirmed and the page shows only the tier conditions — never an invented
// count. After launch this reads lib/server/commerce/price-seats.ts readAvailability() from the live database.
import { aiCareerCommerce } from "../../../config/ai-career-commerce.ts";
import type { PriceAvailability } from "../../../config/ai-career-pricing.ts";

export async function readPriceAvailability(): Promise<PriceAvailability> {
  const live: boolean = aiCareerCommerce.salesEnabled && aiCareerCommerce.legalApproved;
  if (!live) return { confirmed: false };
  // The live ledger is connected together with real payments (see docs/products/ai-career-pricing.md).
  // Until then, even with both flags on, the count stays hidden rather than guessed.
  return { confirmed: false };
}
