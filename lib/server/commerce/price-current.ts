// The price the catalogue and the product page show — the same source the order, the Robokassa request and the
// reports use (lib/server/commerce/shop.ts quote()). Without a commerce database (the public site today) the
// launch price applies. If the price source cannot be read, the page does not guess.
import { Pool } from "pg";
import { DEFAULT_PRICE_RUB, type CurrentPrice } from "../../../config/ai-career-pricing.ts";
import { demoConfig } from "../career-demo/config.ts";
import { quote } from "./shop.ts";

let pool: Pool | undefined;
const LAUNCH: CurrentPrice = { known: true, priceRub: DEFAULT_PRICE_RUB, mode: "default" };

export async function readCurrentPrice(env: NodeJS.ProcessEnv = process.env): Promise<CurrentPrice> {
  const stage1 = demoConfig(env);
  if (stage1?.commerce) {
    // Stage-1 preview: render at request time (outside the try: Next.js signals this by throwing), so the page always
    // shows the same price the next order gets.
    const { connection } = await import("next/server");
    await connection();
  }
  try {
    if (stage1?.commerce) {
      const { careerPool } = await import("../career/db.ts");
      const q = await quote(careerPool());
      return { known: true, priceRub: q.priceRub, mode: q.mode };
    }
    const url = env.COMMERCE_DATABASE_URL;
    if (!url) return LAUNCH;
    pool ??= new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 2000, idleTimeoutMillis: 10000, statement_timeout: 2000 });
    const q = await quote(pool);
    return { known: true, priceRub: q.priceRub, mode: q.mode };
  } catch {
    console.error("commerce price lookup failed"); // no connection details
    return { known: false };
  }
}
