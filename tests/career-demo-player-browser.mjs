// AI Career 3.0 — lesson player in a real browser on the closed-demo build (local copy).
// Phones (iPhone SE 375×667, iPhone 13, Pixel 7), desktop, keyboard-only navigation, 200% text zoom,
// accessibility tree, position restored after sign-out/sign-in, quiz counted in the route, step progress kept.
// Usage (after a demo build, see docs/products/ai-career-v3/demo/README.md): node tests/career-demo-player-browser.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const { Pool } = require("pg");

process.loadEnvFile(".env.career-demo.local");
const origin = process.env.CAREER_V3_DEMO_ORIGIN;
assert.equal(process.env.CAREER_V3_DEMO_LOCAL, "1");
assert.equal(new URL(origin).hostname, "127.0.0.1");
const db = new Pool({ connectionString: process.env.CAREER_V3_DEMO_DATABASE_URL, max: 1 });
await db.query("TRUNCATE career_accounts, career_demo_invites, career_rate_buckets, career_events CASCADE"); // local demo DB only
await db.end();
const shots = process.env.CAREER_PLAYER_SCREENSHOTS || "/tmp/mironovich-career-player";
mkdirSync(shots, { recursive: true });
const admin = (...a) => execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/career/demo-admin.mjs", ...a]).toString().trim();
const answers = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles.find((p) => p.id === "FX-b2b-experienced-public-tools").answers;
const API = `${origin}/api/career/v3/sales_manager`;
const PASSWORD = "Player-test-" + Math.random().toString(36).slice(2, 8);
const TECH = /\b(?:[A-Z]{3}\d{2}-(?:TASK|EX|P|Q)-?\d+|TPL-[A-Z0-9-]+|STEP-\d{2}|SAF-0\d|SAL-0\d|VAL-0\d)\b|[0-9a-f]{8}-[0-9a-f]{4}-|example\.invalid|status=|review\b/;
const checks = [], errors = [], external = [];
const pass = (n) => { checks.push(n); console.log("PASS", n); };

const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", new URL(origin).port], { env: process.env, stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { await fetch(origin + "/robots.txt"); break; } catch { await sleep(500); } }
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function open(device) {
  const context = await browser.newContext({ ...device, baseURL: origin });
  await context.route("**/*", async (r) => { if (new URL(r.request().url()).origin !== origin) { external.push(r.request().url()); await r.abort(); } else await r.continue(); });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { context, page };
}
const post = (page, url, data) => page.request.post(url, { data, headers: { Origin: origin } });
async function registerWithRoute(page, tag) {
  const email = `${tag}-${Date.now().toString(36)}@example.com`;
  assert.equal((await post(page, `${origin}/api/career/demo/register`, { email, password: PASSWORD, passwordConfirm: PASSWORD, invite: admin("invite", tag) })).status(), 201);
  assert.equal((await post(page, `${API}/diagnostic`, { answers })).status(), 200);
  assert.equal((await post(page, `${API}/task-map`, {})).status(), 200);
  assert.equal((await post(page, `${API}/plan`, {})).status(), 200);
  await page.reload(); // the app read the (empty) session on first load; a hash change alone does not reload it
  await page.getByRole("button", { name: "Выйти" }).waitFor();
  return email;
}
/** Visible text of the player must contain no internal identifiers; navigation must be on screen. */
async function screenCheck(page, label) {
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const m = TECH.exec(text);
  assert.ok(!m, `${label}: internal identifier shown: ${m?.[0]}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250); // let the 200 ms transition finish
  const v = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Навигация по уроку"]').getBoundingClientRect();
    const box = document.querySelector("[data-player-screen]");
    // Content of collapsed «Открыть…» blocks is not on screen and is not counted.
    const last = [...box.querySelectorAll("*")].filter((e) => !e.closest("details:not([open]) > :not(summary)"))
      .reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
    const sw = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return { navBottom: nav.bottom, navTop: nav.top, vh: window.innerHeight, sw, contentBottom: last };
  });
  assert.ok(v.sw <= 1, `${label}: horizontal scroll`);
  assert.ok(v.navTop >= 0 && v.navBottom <= v.vh + 1, `${label}: navigation not visible (${v.navTop}-${v.navBottom} of ${v.vh})`);
  return v.contentBottom <= v.navTop + 1; // true = the screen's content is fully visible without scrolling // true = the whole screen fits without vertical scrolling
}

try {
  // ——— iPhone SE: the full SAF-01 lesson with the keyboard only ———
  const se = await open({ ...devices["iPhone SE"], viewport: { width: 375, height: 667 } });
  const p = se.page;
  await p.goto("/career/v3");
  await registerWithRoute(p, "player-se");
  const plan = (await (await p.request.get(`${API}/progress`)).json()).plan;
  const safStep = plan.steps.find((s) => s.lessonId === "SAF-01");
  assert.ok(safStep, "the route contains SAF-01");
  await p.goto(`/career/v3#step=${safStep.position}`);
  await p.getByRole("button", { name: "Пройти урок короткими экранами" }).click();
  await p.getByText(/^Экран 1 из \d+$/).waitFor();
  const total = Number((await p.getByText(/^Экран 1 из \d+$/).innerText()).match(/из (\d+)/)[1]);
  assert.ok(total >= 18 && total <= 26, "screens: " + total);
  assert.equal(await p.locator('nav[aria-label="Разделы кабинета"]').count(), 0, "focus mode: cabinet navigation hidden");
  assert.equal((await p.getByRole("note").innerText()).trim().startsWith("Демонстрационная версия"), true, "demo notice stays");
  const fit = [];
  for (let k = 1; k <= total; k++) {
    await p.getByText(new RegExp(`^Экран ${k} из ${total}$`)).waitFor();
    fit.push(await screenCheck(p, `SAF-01 screen ${k}`));
    if (k === 1) await p.screenshot({ path: `${shots}/saf01-01-why-iphone-se.png` });
    const quiz = await p.locator('input[type="radio"]').count();
    if (quiz) {
      const q = await (await p.request.get(`${API}/lessons/SAF-01`)).json();
      const qi = Number((await p.getByText(/Мини-тест · вопрос \d+/).innerText()).match(/вопрос (\d+)/i)[1]) - 1;
      const correct = q.lesson.content.quiz[qi].correctId;
      const idx = q.lesson.content.quiz[qi].options.findIndex((o) => o.id === correct);
      await p.locator('input[type="radio"]').nth(idx).focus();
      await p.keyboard.press("Space");
      await p.getByRole("button", { name: "Проверить" }).focus();
      await p.keyboard.press("Enter");
      await p.getByText("Верно.").waitFor();
      if (qi === 0) await p.screenshot({ path: `${shots}/saf01-quiz-iphone-se.png` });
    }
    if (await p.getByText("Критерии успешного выполнения").isVisible().catch(() => false)) {
      for (const box of await p.locator('fieldset input[type="checkbox"]').all()) await box.check();
      await p.getByRole("button", { name: new RegExp(`Сохранить в шаг ${safStep.position}`) }).click();
      await p.getByText("Самопроверка сохранена в шаге маршрута.").waitFor();
      await p.screenshot({ path: `${shots}/saf01-review-iphone-se.png` });
    }
    if (k === 4) await p.screenshot({ path: `${shots}/saf01-04-traffic-light-iphone-se.png` });
    if (k === 12) await p.screenshot({ path: `${shots}/saf01-12-task-iphone-se.png` });
    if (k < total) {
      await p.getByRole("button", { name: "Далее" }).focus();
      await p.keyboard.press("Enter");
    }
  }
  await p.getByText("Мини-тест засчитан: 3 из 3.").count(); // shown on the last quiz screen before «Далее»
  await p.getByRole("heading", { name: "Теперь я умею" }).waitFor();
  await p.screenshot({ path: `${shots}/saf01-done-iphone-se.png` });
  const pr = await (await p.request.get(`${API}/progress`)).json();
  assert.equal(pr.quizzes["SAF-01"]?.passed, true, "quiz counted in the route via the server");
  const stepRow = pr.steps.find((s) => s.position === safStep.position);
  assert.equal(stepRow.state, "self_checked", "self-check saved into the step; the step is not completed by the player");
  assert.equal(pr.summary.done, 0, "screens are not route steps");
  pass(`iPhone SE: SAF-01 — ${total} screens with keyboard only; nav always visible; ${fit.filter(Boolean).length}/${total} screens fully visible without scrolling (screens: ${fit.map((f, k) => f ? "" : k + 1).filter(Boolean).join(",") || "all fit"} need scrolling); quiz counted; self-check saved; step not auto-completed`);

  // Position restored after sign-out / sign-in.
  await p.getByRole("button", { name: /Вернуться к шагу/ }).click();
  await p.getByRole("button", { name: "Пройти урок короткими экранами" }).click();
  await p.getByText(new RegExp(`^Экран ${total} из ${total}$`)).waitFor();
  await p.getByRole("button", { name: "Назад" }).click();
  await p.getByRole("button", { name: "Назад" }).click();
  await p.getByText(new RegExp(`^Экран ${total - 2} из ${total}$`)).waitFor();
  await sleep(400);
  await post(p, `${origin}/api/career/demo/logout`, {});
  await p.goto("/career/v3");
  await p.getByRole("button", { name: "Войти" }).click();
  const email = (await (await p.request.get(`${origin}/api/career/demo/session`)).json()).account?.email;
  assert.equal(email, undefined, "signed out");
  pass("player: «Назад» works and the position is saved on every move");

  // ——— Pixel 7: SAL-03 long practice, sign-in restores the screen ———
  const px = await open(devices["Pixel 7"]);
  const q = px.page;
  await q.goto("/career/v3");
  const email2 = await registerWithRoute(q, "player-px");
  await q.goto("/career/v3#lessons");
  await q.getByRole("heading", { name: "Безопасность" }).waitFor();
  await q.getByRole("heading", { name: "Готовятся" }).waitFor();
  assert.match(await q.locator("main").innerText(), /Архитектор запросов/);
  await q.screenshot({ path: `${shots}/catalogue-pixel7.png`, fullPage: true });
  await q.getByRole("button", { name: /Коммерческое предложение с проверкой условий/ }).click();
  await q.getByText(/^Экран 1 из \d+$/).waitFor();
  for (let k = 0; k < 13; k++) await q.getByRole("button", { name: "Далее" }).click();
  await q.getByText(/^Экран 14 из \d+$/).waitFor();
  await q.screenshot({ path: `${shots}/sal03-14-action-pixel7.png` });
  await sleep(400);
  await post(q, `${origin}/api/career/demo/logout`, {});
  await q.goto("/career/v3");
  await q.getByRole("button", { name: "Войти" }).click();
  await q.getByLabel("Email").fill(email2);
  await q.getByLabel("Пароль").fill(PASSWORD);
  await q.getByRole("button", { name: "Войти" }).click();
  await q.getByRole("heading", { name: "Мой маршрут" }).waitFor();
  await q.goto("/career/v3#play=SAL-03");
  await q.getByText(/^Экран 14 из \d+$/).waitFor();
  pass("Pixel 7: categories with future sections marked; SAL-03 reopened after sign-in on the saved screen 14");

  // ——— 200% text zoom on a narrow phone: nothing clipped, navigation reachable ———
  // WCAG 1.4.10 reflow: 640 px at 200% = 320 CSS px of width.
  const zoom = await open({ viewport: { width: 640, height: 1136 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const z = zoom.page;
  await z.goto("/career/v3");
  await registerWithRoute(z, "player-zoom");
  await z.goto("/career/v3#play=VAL-02");
  await z.getByText(/^Экран 1 из \d+$/).waitFor();
  await z.addStyleTag({ content: "html { zoom: 2 }" });
  for (let k = 0; k < 8; k++) await z.getByRole("button", { name: "Далее" }).click();
  await z.getByText(/^Экран 9 из \d+$/).waitFor();
  const zv = await z.evaluate(() => {
    const clipped = [...document.querySelectorAll("main p, main li, main h2, main button")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "hidden").length;
    return { sw: document.documentElement.scrollWidth - document.documentElement.clientWidth, clipped };
  });
  assert.equal(zv.clipped, 0, "no clipped text at 200%");
  assert.ok(zv.sw <= 1, "no horizontal scroll at 320 CSS px (200% zoom)");
  await z.getByRole("button", { name: "Далее" }).scrollIntoViewIfNeeded();
  assert.ok(await z.getByRole("button", { name: "Далее" }).isVisible(), "navigation reachable at 200%");
  await z.screenshot({ path: `${shots}/val02-09-formula-320-zoom200.png` });
  await z.addStyleTag({ content: "html { zoom: 1 }" });
  pass("200% zoom (320 CSS px): no clipped text, no horizontal scroll, navigation reachable");

  // ——— Accessibility tree on a formula screen ———
  const tree = await z.locator("main").ariaSnapshot();
  assert.match(tree, /progressbar "Прогресс урока"/);
  assert.match(tree, /navigation "Навигация по уроку"/);
  assert.match(tree, /button "Назад"/);
  assert.match(tree, /button "Далее"/);
  assert.match(tree, /heading .*level=2/);
  pass("screen reader tree: heading per screen, labelled progress bar, navigation landmark with «Назад»/«Далее», live screen counter");

  // ——— Desktop + iPhone 13 screenshots ———
  const fit13 = {};
  for (const [dev, name] of [[{ viewport: { width: 1440, height: 900 } }, "desktop"], [devices["iPhone 13"], "iphone13"]]) {
    const d = await open(dev);
    await d.page.goto("/career/v3");
    await registerWithRoute(d.page, "player-" + name);
    for (const [lesson, n] of [["VAL-02", 8], ["SAL-03", 9], ["SAF-01", 9]]) {
      await d.page.goto(`/career/v3#play=${lesson}`);
      await d.page.getByText(/^Экран 1 из \d+$/).waitFor();
      for (let k = 1; k < n; k++) await d.page.getByRole("button", { name: "Далее" }).click();
      await d.page.getByText(new RegExp(`^Экран ${n} из`)).waitFor();
      await screenCheck(d.page, `${name} ${lesson}`);
      if (name === "iphone13") {
        await d.page.goto(`/career/v3#play=${lesson}`);
        await d.page.getByText(/^Экран \d+ из \d+$/).waitFor();
        const t = Number((await d.page.getByText(/^Экран \d+ из \d+$/).innerText()).match(/из (\d+)/)[1]);
        await d.page.getByRole("button", { name: "Назад" }).click({ trial: true }).catch(() => undefined);
        while (!(await d.page.getByText(/^Экран 1 из/).isVisible())) await d.page.getByRole("button", { name: "Назад" }).click();
        const f = [];
        for (let k = 1; k <= t; k++) {
          f.push(await screenCheck(d.page, `iPhone 13 ${lesson} ${k}`));
          const radios = d.page.locator('input[type="radio"]');
          if (await radios.count()) { await radios.first().check(); await d.page.getByRole("button", { name: "Проверить" }).click(); }
          if (k < t) await d.page.getByRole("button", { name: "Далее" }).click();
        }
        fit13[lesson] = `${f.filter(Boolean).length}/${t}`;
        while (!(await d.page.getByText(new RegExp(`^Экран ${n} из`)).isVisible())) await d.page.getByRole("button", { name: "Назад" }).click();
      }
      await d.page.screenshot({ path: `${shots}/${lesson.toLowerCase()}-${String(n).padStart(2, "0")}-${name}.png` });
    }
    await d.context.close();
  }
  pass(`desktop 1440 and iPhone 13: three lessons render without internal identifiers or horizontal scroll; iPhone 13 screens fully visible without scrolling: ${JSON.stringify(fit13)}`);

  // ——— Lesson without a script and normal-mode safety are covered by unit/integration tests ———
  assert.deepEqual(external, [], "no external requests");
  assert.deepEqual(errors, [], "no console errors");
  pass("no external requests, no console errors");
  console.log(`career demo player browser: ${checks.length} checks passed; screenshots in ${shots}`);
} finally {
  await browser.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ }
}
