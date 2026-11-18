#!/usr/bin/env node
// Cookie consent gate, checked through real browser network events.
// Run against a local build made with a FAKE counter id, e.g.
//   NEXT_PUBLIC_YANDEX_METRICA_ID=10000001 npm run build:local && npx next start -p 3101
//   node scripts/audit/consent-network.mjs --base http://localhost:3101
// Expectation: no request to Yandex Metrica (or any analytics host) and no _ym cookies
// before a choice and after «Не согласен»; the counter may load only after «Согласен».
import { createRequire } from "node:module";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3101");
const { chromium } = createRequire(import.meta.url)("playwright");
const ANALYTICS = /mc\.yandex\.(ru|com)|yandex\.ru\/metrika|google-analytics|googletagmanager|doubleclick|facebook\.net|vk\.com\/rtrg/;
const results = [];
const check = (n, ok, d = "") => { results.push({ n, ok }); console.log((ok ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); };

async function visit(browser, choice) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const hits = [];
  page.on("request", r => { if (ANALYTICS.test(r.url())) hits.push(r.url().slice(0, 80)); });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const before = hits.length;
  if (choice) {
    await page.getByRole("button", { name: choice === "accept" ? /^согласен$/i : /^не согласен$/i }).click();
    await page.waitForTimeout(500);
    await page.goto(BASE + "/services", { waitUntil: "networkidle" }); // a second page view after the choice
    await page.waitForTimeout(1500);
  }
  const cookies = (await ctx.cookies()).map(c => c.name).filter(n => /^_ym|^_ga|^yandexuid/.test(n));
  const html = await page.content();
  await ctx.close();
  return { before, after: hits.length, hits, cookies, counterInPage: /mc\.yandex\.ru\/metrika\/tag\.js/.test(html) };
}

const browser = await chromium.launch();
const none = await visit(browser, null);
check("no analytics request before a choice", none.before === 0, none.hits.join(", "));
check("no analytics cookies before a choice", none.cookies.length === 0, none.cookies.join(","));
const declined = await visit(browser, "decline");
check("no analytics request after «Не согласен» (two page views)", declined.after === 0, declined.hits.join(", "));
check("no analytics cookies after «Не согласен»", declined.cookies.length === 0, declined.cookies.join(","));
const accepted = await visit(browser, "accept");
check("before «Согласен» nothing was requested", accepted.before === 0);
check("after «Согласен» the counter is requested (fake id, request blocked by the sandbox)", accepted.after > 0, accepted.hits.slice(0, 2).join(", "));
await browser.close();
console.log(`${results.filter(r => r.ok).length}/${results.length} consent checks passed`);
