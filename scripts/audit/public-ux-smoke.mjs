#!/usr/bin/env node
// Public-site mobile consent geometry + SEO crawler smoke (Playwright).
// CI uses synthetic analytics ID; never accepts production payments or real user data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:3101";
const browser = await chromium.launch({ headless: true });
const viewports = [
  { width: 320, height: 700 },
  { width: 375, height: 667 },
  { width: 390, height: 800 },
];
const paths = ["/", "/products/ai-career", "/solutions", "/services"];
let checks = 0;

const rectanglesOverlap = (a, b) => a.x < b.x + b.width &&
  a.x + a.width > b.x && a.y < b.y + b.height &&
  a.y + a.height > b.y;

try {
  for (const viewport of viewports) {
    for (const path of paths) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const tracked = [];
      page.on("request", req => {
        if (/mc\\.yandex\\.(ru|com)|google-analytics|googletagmanager/i.test(req.url())) tracked.push(req.url());
      });
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      const banner = page.locator("[data-consent-banner]");
      await banner.waitFor({ state: "visible" });
      assert.equal(await banner.evaluate(el => getComputedStyle(el).position), "relative",
        path + " / " + viewport.width + ": consent must not overlay content");
      const bannerBox = await banner.boundingBox();
      const headerBox = await page.locator("header").first().boundingBox();
      const mainBox = await page.locator("main").first().boundingBox();
      assert.ok(bannerBox && headerBox && mainBox &&
        headerBox.y + headerBox.height <= bannerBox.y + 1 &&
        bannerBox.y + bannerBox.height <= mainBox.y + 1,
        path + " / " + viewport.width + ": banner must be inline between header and content");

      const controls = page.locator("main a, main button, main [role='status']");
      const positions = await controls.evaluateAll(els => els.map(el => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height };
      }).filter(r => r.width > 0 && r.height > 0));
      for (const box of positions) {
        assert.equal(rectanglesOverlap(bannerBox, box), false,
          path + " / " + viewport.width + ": consent intersects a primary control/status");
      }
      assert.equal(tracked.length, 0, "analytics must not load before opt-in");
      await page.getByRole("button", { name: /^Не согласен$/i }).click();
      assert.equal(await banner.count(), 0, "banner closes after explicit rejection");
      assert.equal(tracked.length, 0, "analytics must not load after rejection");
      await page.getByRole("button", { name: /Настройки cookies/i }).click();
      await page.locator("[data-consent-banner][data-reopened]").waitFor({ state: "visible" });
      assert.equal(await banner.evaluate(el => getComputedStyle(el).position), "relative",
        "reopened consent must remain non-overlay on mobile");
      assert.equal(tracked.length, 0, "opening settings may not load analytics");
      await context.close();
      console.log("PASS mobile consent: " + viewport.width + "x" + viewport.height + " " + path);
      checks++;
    }
  }

  const agents = [
    ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
    ["Lighthouse", "Mozilla/5.0 Chrome-Lighthouse"],
    ["YandexBot", "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)"],
  ];
  for (const [name, userAgent] of agents) {
    const ctx = await browser.newContext({ userAgent });
    const page = await ctx.newPage();
    const response = await page.goto(BASE + "/tools/labor-cost", { waitUntil: "load" });
    assert.equal(response?.status(), 200, name + " calculator response");
    const html = await response.text();
    const head = html.slice(html.indexOf("<head"), html.indexOf("</head>") + 7);
    assert.match(head, /<title>/i, name + " title in head");
    assert.match(head, /name="description"/i, name + " description in head");
    assert.match(head, /rel="canonical"/i, name + " canonical in head");
    console.log("PASS head metadata: " + name);
    checks++;
    await ctx.close();
  }

  const regular = await browser.newPage();
  await regular.goto(BASE + "/tools/labor-cost", { waitUntil: "networkidle" });
  assert.ok((await regular.title()).length > 10, "regular browser gets title");
  await regular.close();
  checks++;
  console.log("PASS: " + checks + " browser checks");
} finally {
  await browser.close();
}
