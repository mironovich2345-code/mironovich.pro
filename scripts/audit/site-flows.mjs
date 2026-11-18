#!/usr/bin/env node
// Functional browser flows for the UX audit. Dev-only (Playwright with Chromium, local build).
// Never sends a real lead: POST /api/lead is answered by a route mock inside the browser.
//
//   node scripts/audit/site-flows.mjs --base http://localhost:3100 --out /tmp/audit-flows
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3100");
const OUT = arg("--out", "audit-flows");
mkdirSync(OUT, { recursive: true });
const { chromium } = createRequire(import.meta.url)("playwright");
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };

async function ctx(browser, width, { consent = "denied" } = {}) {
  const c = await browser.newContext({ viewport: { width, height: width < 768 ? 800 : 900 } });
  // pre-answer the cookie banner so it does not cover what the flow inspects
  if (consent) await c.addInitScript(v => { try { localStorage.setItem("mrnv_analytics_consent_v3_notice", v); } catch {} }, consent);
  return c;
}

async function main() {
  const browser = await chromium.launch();

  // 1. Mobile menu opens, lists the three audiences and closes with Escape
  {
    const c = await ctx(browser, 375); const p = await c.newPage();
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    const btn = p.getByRole("button", { name: /меню/i });
    await btn.click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: join(OUT, "mobile-menu-open.png") });
    const nav = await p.getByRole("link", { name: /^бизнесу/i }).last().isVisible() && await p.getByRole("link", { name: /^сотрудникам/i }).last().isVisible();
    check("mobile menu shows Бизнесу / Сотрудникам / Кто я", nav);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(200);
    check("mobile menu closes with Escape", (await btn.getAttribute("aria-expanded")) !== "true");
    await c.close();
  }

  // 2. Keyboard: skip link is the first focus stop and becomes visible
  {
    const c = await ctx(browser, 1440); const p = await c.newPage();
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await p.keyboard.press("Tab");
    const f = await p.evaluate(() => { const e = document.activeElement; const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), w: r.width, h: r.height }; });
    check("first Tab focuses visible skip link", /перейти к содержанию/i.test(f.text) && f.w > 20, JSON.stringify(f));
    await c.close();
  }

  // 3. Lead form: empty submit shows errors, valid submit with mocked API shows confirmation
  for (const width of [390, 1440]) {
    const c = await ctx(browser, width); const p = await c.newPage();
    let posted = null;
    await p.route("**/api/lead", async r => { posted = r.request().postDataJSON(); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, delivered: true }) }); });
    await p.goto(BASE + "/contact", { waitUntil: "networkidle" });
    const form = p.locator("form").filter({ has: p.locator("textarea") }).first();
    await form.locator('button[type="submit"]').click();
    await p.waitForTimeout(300);
    const invalid = await form.locator("[aria-invalid=true], :invalid").count();
    check(`lead form @${width}: empty submit is blocked with field errors`, invalid > 0 && posted === null, "invalid fields: " + invalid);
    await p.screenshot({ path: join(OUT, `contact-errors-${width}.png`), fullPage: false });
    await form.locator('input[name="name"], input[autocomplete="name"]').first().fill("Тест Аудита");
    await form.locator('input[name="phone"]').first().fill("@audit_test_user");
    await form.locator("textarea").first().fill("Тестовая заявка аудита: каждую неделю вручную собираем отчёт из таблиц.");
    const consent = form.locator('input[type="checkbox"]').first();
    if (await consent.count()) await consent.check();
    await form.locator('button[type="submit"]').click();
    await p.waitForTimeout(800);
    const done = await p.getByText(/спасибо|заявка отправлена|получил|отправлено/i).first().isVisible().catch(() => false);
    check(`lead form @${width}: mocked delivery shows confirmation`, posted !== null && done, posted ? "payload keys: " + Object.keys(posted).join(",") : "no POST");
    await p.screenshot({ path: join(OUT, `contact-success-${width}.png`) });
    await c.close();
  }

  // 4. Lead API failure is reported honestly (not as success)
  {
    const c = await ctx(browser, 1440); const p = await c.newPage();
    await p.route("**/api/lead", r => r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, delivered: false, error: "telegram" }) }));
    await p.goto(BASE + "/contact", { waitUntil: "networkidle" });
    const form = p.locator("form").filter({ has: p.locator("textarea") }).first();
    await form.locator('input[name="name"], input[autocomplete="name"]').first().fill("Тест");
    await form.locator('input[name="phone"]').first().fill("@audit_test_user");
    await form.locator("textarea").first().fill("Проверка сообщения об ошибке доставки.");
    const consent = form.locator('input[type="checkbox"]').first(); if (await consent.count()) await consent.check();
    await form.locator('button[type="submit"]').click();
    await p.waitForTimeout(800);
    const txt = await form.innerText();
    check("lead form: delivery failure shows an error with a fallback contact", /не удалось|ошибк|telegram|напишите/i.test(txt) && !/спасибо/i.test(txt));
    await p.screenshot({ path: join(OUT, "contact-failure-1440.png") });
    await c.close();
  }

  // 5. Labor calculator: go through the wizard on a phone and get a result
  {
    const c = await ctx(browser, 390); const p = await c.newPage();
    const errors = []; p.on("pageerror", e => errors.push(e.message));
    await p.goto(BASE + "/tools/labor-cost", { waitUntil: "networkidle" });
    await p.screenshot({ path: join(OUT, "labor-mobile-step1.png") });
    // the h1 counts only if neither it nor an ancestor is visually hidden (sr-only: 1px box)
    const visibleH1 = await p.locator("h1").first().evaluate(e => { for (let n = e; n && n !== document.body; n = n.parentElement) { const r = n.getBoundingClientRect(); if (r.width <= 2 || r.height <= 2) return false; } return true; });
    check("labor calculator @390: visible page title explains the tool", visibleH1);
    for (let i = 0; i < 9; i++) {
      // fill whatever numeric input is on the current step, then continue
      for (const inp of await p.locator('main input[type="number"]:visible, main input[inputmode="numeric"]:visible, main input[inputmode="decimal"]:visible').all()) {
        if (await inp.inputValue()) continue;
        const label = await inp.evaluate(e => (e.labels?.[0]?.textContent || e.getAttribute("aria-label") || e.closest("label,div")?.textContent || "").toLowerCase());
        await inp.fill(/зарплат|стоимост|₽/.test(label) ? "60000" : /час/.test(label) ? "8" : /минут/.test(label) ? "5" : "3").catch(() => {});
      }
      const range = p.locator('main input[type="range"]:visible').first();
      if (await range.count()) await range.evaluate(e => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(e, "5"); e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
      const chip = p.locator("main button:visible", { hasText: /^5 мин$|^5\/2$/ }).first();
      if (await chip.count()) await chip.click().catch(() => {});
      const next = p.getByRole("button", { name: /^(продолжить|показать результат|далее|рассчитать|посчитать)/i }).last();
      if (!(await next.count()) || !(await next.isVisible())) break;
      await next.click(); await p.waitForTimeout(250);
    }
    await p.screenshot({ path: join(OUT, "labor-mobile-result.png"), fullPage: true });
    const body = await p.locator("main").innerText();
    const rub = body.match(/[\d\s ]{3,}\s?₽\s?\/\s?мес/);
    check("labor calculator @390: wizard reaches a rouble result without errors", !!rub && errors.length === 0, (rub?.[0] ?? "no result") + (errors.length ? " errors: " + errors.join("; ") : ""));
    await c.close();
  }

  // 6. Product page: sales are visibly closed near the title and checkout is not reachable
  {
    const c = await ctx(browser, 390); const p = await c.newPage();
    await p.goto(BASE + "/products/ai-career", { waitUntil: "networkidle" });
    const top = await p.evaluate(() => document.body.innerText.slice(0, 900));
    check("product @390: closed sales are stated in the first screen", /продажи (пока )?(закрыты|не открыты)|пока не продаётся|оплата пока (выключена|недоступн)|заказы и оплата пока недоступны/i.test(top));
    const buy = p.getByRole("button", { name: /купить/i });
    check("product: buy button is disabled", (await buy.count()) > 0 && await buy.first().isDisabled());
    for (const path of ["/career/sandbox", "/payment/result"]) {
      const r = await p.goto(BASE + path); check(`checkout route ${path} is closed`, r.status() === 404, String(r.status()));
    }
    await c.close();
  }

  writeFileSync(join(OUT, "flows.json"), JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} flows passed`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
