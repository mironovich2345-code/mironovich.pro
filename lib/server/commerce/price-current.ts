// The price the catalogue and the product page show — the same source the order, the Robokassa request and the
// reports use (lib/server/commerce/shop.ts quote()).
//  - Public site with the learning app connected (CAREER_APP_UPSTREAM): asks the app over the private network
//    (GET /api/career/shop/public-quote, 2 s timeout). The site never holds database credentials.
//  - Stage-1 preview / commercial app itself: reads its own database.
//  - Otherwise (today's public site): the launch price.
// If the price source cannot be read, the page does not guess ({ known: false }).
import { Pool } from "pg";
import { DEFAULT_PRICE_RUB, isAllowedPrice, type CurrentPrice } from "../../../config/ai-career-pricing.ts";
import { careerAppEnabled } from "../../../config/career-access.ts";
import { demoConfig } from "../career-demo/config.ts";
import { quote } from "./shop.ts";

let pool: Pool | undefined;
const LAUNCH: CurrentPrice = { known: true, priceRub: DEFAULT_PRICE_RUB, mode: "default" };

async function fromApp(env: NodeJS.ProcessEnv): Promise<CurrentPrice> {
  const site = new URL(env.NEXT_PUBLIC_SITE_URL ?? "https://mironovich.pro");
  const r = await fetch(new URL("/api/career/shop/public-quote", env.CAREER_APP_UPSTREAM), {
    headers: { "x-career-proxy": env.CAREER_PROXY_SECRET ?? "", "x-forwarded-host": site.host, accept: "application/json" },
    signal: AbortSignal.timeout(2000), cache: "no-store",
  });
  if (!r.ok) throw new Error("price " + r.status);
  const v = (await r.json()) as { priceRub?: unknown; mode?: unknown };
  if (!isAllowedPrice(v.priceRub) || (v.mode !== "auto" && v.mode !== "manual")) throw new Error("bad price");
  return { known: true, priceRub: v.priceRub, mode: v.mode };
}

export async function readCurrentPrice(env: NodeJS.ProcessEnv = process.env): Promise<CurrentPrice> {
  const contour = demoConfig(env);
  if (contour?.commerce) {
    // Inside a contour: render at request time (outside the try: Next.js signals this by throwing), so the page always
    // shows the same price the next order gets.
    const { connection } = await import("next/server");
    await connection();
  }
  try {
    if (contour?.commerce) {
      const { careerPool } = await import("../career/db.ts");
      const q = await quote(careerPool());
      return { known: true, priceRub: q.priceRub, mode: q.mode };
    }
    if (env === process.env ? careerAppEnabled() : /^https?:\/\//.test(env.CAREER_APP_UPSTREAM ?? "")) return await fromApp(env);
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
