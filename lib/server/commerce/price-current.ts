// The price the product page shows. Without a commerce database (today: sales are off) the launch price from
// config applies. With COMMERCE_DATABASE_URL the recorded price period is read at request time, so a price
// change needs no code change and no deploy. If the database cannot be read, the page does not guess.
import { Pool } from "pg";
import { DEFAULT_PRICE_RUB, type CurrentPrice } from "../../../config/ai-career-pricing.ts";
import { resolvePrice } from "./price-periods.ts";

let pool: Pool | undefined;
const LAUNCH: CurrentPrice = { known: true, kind: "default", priceRub: DEFAULT_PRICE_RUB, startsAt: null, endsAt: null, afterPriceRub: null };

export async function readCurrentPrice(env: NodeJS.ProcessEnv = process.env): Promise<CurrentPrice> {
  const url = env.COMMERCE_DATABASE_URL;
  if (!url) return LAUNCH;
  try {
    pool ??= new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 2000, idleTimeoutMillis: 10000, statement_timeout: 2000 });
    return (await resolvePrice(pool)).price;
  } catch {
    console.error("commerce price lookup failed"); // no connection details
    return { known: false };
  }
}
