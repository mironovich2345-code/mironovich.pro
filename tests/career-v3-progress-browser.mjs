// AI Career 3.0 — end-to-end progress in a real browser against the local synthetic sandbox started with
// CAREER_V3_FIXTURE_LIBRARY=1 (synthetic fixture lessons, never real or review lessons).
// Path: sign-in → diagnostic → task map → 30 steps → step → exercise → mini-test → completion →
// sign-out → sign-in → resume; then API tampering and a stale plan after a lesson version change.
// Usage: node tests/career-v3-progress-browser.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { Pool } = require("pg");
process.loadEnvFile(".env.career.local");
const origin = process.env.CAREER_APP_ORIGIN;
assert.equal(new URL(origin).hostname, "127.0.0.1");
assert.equal(process.env.CAREER_PAYMENT_MODE, "fixture");
const shots = process.env.CAREER_V3_SCREENSHOTS || "/tmp/mironovich-career-v3-progress";
mkdirSync(shots, { recursive: true });
const FIXTURE = ".career-v3-fixture/library.json";
copyFileSync(FIXTURE, FIXTURE + ".orig");
const db = new Pool({ connectionString: process.env.CAREER_DATABASE_URL, max: 1 });
const profile = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles.find((p) => p.id === "FX-b2b-experienced-public-tools").answers;
const TECH_ID = /\b(T\d{2}|SAFE-\d{2}|TPL-[A-Z0-9-]+|[A-Z]{3}\d{2}-TASK-\d+|STEP-\d{2}|(SAF|SAL|MAP|TRD|VAL)-\d{2}(-EX)?)\b/;
const errors = [], external = [], checks = [];
const pass = (n) => { checks.push(n); console.log("PASS", n); };
const API = `${origin}/api/career/v3/sales_manager`;

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await context.route("**/*", async (r) => { if (new URL(r.request().url()).origin !== origin) { external.push(r.request().url()); await r.abort(); } else await r.continue(); });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const main = () => page.locator("main#main");
const mainText = async () => (await main().innerText()).replace(/\s+/g, " ");
const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const w of [390, 1440]) {
    await page.setViewportSize({ width: w, height: w < 600 ? 844 : 900 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${shots}/progress-${name}-${w}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
};
const noOverflow = async (label) => {
  for (const w of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(60);
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(o.sw <= o.cw + 1, `${label}: horizontal scroll at ${w}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
};
const noTechIds = async (label) => {
  await page.evaluate(() => document.querySelectorAll("main details").forEach((d) => { d.open = true; }));
  const t = await mainText();
  const m = TECH_ID.exec(t);
  assert.ok(!m, `${label}: technical identifier shown: ${m?.[0]}`);
};
async function a11y(label) {
  const r = await page.evaluate(() => {
    const out = [];
    const main = document.querySelector("main#main");
    if (!main) out.push("no main landmark");
    for (const el of main.querySelectorAll("input,select,textarea")) {
      const named = el.closest("label") || el.getAttribute("aria-label") || (el.id && document.querySelector(`label[for="${el.id}"]`));
      if (!named) out.push("unlabelled control " + el.outerHTML.slice(0, 80));
    }
    for (const b of main.querySelectorAll("button,a")) if (!(b.textContent || "").trim() && !b.getAttribute("aria-label")) out.push("unnamed control");
    if (main.querySelectorAll("h1").length > 1) out.push("more than one h1");
    const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c.slice(0, 3); } return [242, 239, 232]; };
    let worst = 99, worstText = "";
    for (const el of main.querySelectorAll("p,li,h1,h2,h3,span,a,button,label,dt,dd,summary,legend")) {
      if (!el.childNodes.length || !(el.textContent || "").trim() || el.closest("[aria-hidden=true]")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 1) continue;
      const fg = parse(cs.color).slice(0, 3), bg = bgOf(el);
      const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < worst) { worst = ratio; worstText = (el.textContent || "").trim().slice(0, 40); }
      if (ratio < need) out.push(`contrast ${ratio.toFixed(2)} < ${need}: "${(el.textContent || "").trim().slice(0, 40)}"`);
    }
    return { out, worst: worst.toFixed(2), worstText };
  });
  assert.deepEqual(r.out, [], label + ": " + r.out.join("; "));
  return r.worst;
}
const post = (path, data) => page.request.post(`${API}/${path}`, { data, headers: { Origin: origin } });

async function admitAndSignIn(email) {
  const decline = page.getByRole("button", { name: "Не согласен" });
  if (await decline.isVisible().catch(() => false)) await decline.click();
  await page.getByLabel("Код доступа тестировщика").fill(process.env.CAREER_TESTER_SECRET);
  await page.getByLabel("Работаю только с синтетическими данными").check();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByLabel("Учебный email").waitFor();
  if (email) await page.getByLabel("Учебный email").fill(email);
  const used = await page.getByLabel("Учебный email").inputValue();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByLabel("Одноразовый код").waitFor();
  const mail = await (await fetch(new URL("/fixture/mail/" + encodeURIComponent(used), process.env.CAREER_PROVIDER_FIXTURE_URL), { headers: { "x-fixture-key": process.env.CAREER_FIXTURE_CONTROL_SECRET } })).json();
  await page.getByLabel("Одноразовый код").fill(mail.code);
  await page.getByRole("button", { name: "Продолжить" }).click();
  return used;
}
const lessonJson = async (id) => (await (await page.request.get(`${API}/lessons/${id}`)).json()).lesson;
const progressJson = async () => (await page.request.get(`${API}/progress`)).json();
const stateBadge = () => page.getByTestId("step-state").innerText();

async function doStep(n, { wrongFirst = false } = {}) {
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.waitForFunction(() => document.querySelector("[data-testid=step-state]"));
  const pr = await progressJson();
  const step = pr.plan.steps.find((s) => s.position === n);
  const lesson = await lessonJson(step.lessonId);
  assert.equal(await stateBadge(), "Изучается");
  assert.ok(await page.getByRole("button", { name: "Завершить шаг" }).isDisabled(), "completion is locked before the checks");
  const boxes = page.locator("#exercise-h").locator("xpath=..").locator('input[type="checkbox"]');
  for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
  await page.getByRole("button", { name: "Сохранить самопроверку" }).click();
  await page.getByText("Самопроверка сохранена.").waitFor();
  const quizPassed = pr.quizzes[step.lessonId]?.passed;
  if (!quizPassed) {
    for (const q of lesson.content.quiz) {
      const pick = wrongFirst ? q.options.find((o) => o.id !== q.correctId).id : q.correctId;
      await page.locator(`input[name="step-${q.id}"]`).nth(q.options.findIndex((o) => o.id === pick)).check();
    }
    await page.getByRole("button", { name: "Отправить ответы" }).click();
    if (wrongFirst) {
      await page.getByText(/Попробуйте ещё раз/).first().waitFor();
      assert.equal(await stateBadge(), "Изучается", "a failed mini-test keeps the step open");
      for (const q of lesson.content.quiz) await page.locator(`input[name="step-${q.id}"]`).nth(q.options.findIndex((o) => o.id === q.correctId)).check();
      await page.getByRole("button", { name: "Отправить ответы" }).click();
    }
    await page.getByText("Мини-тест пройден.").first().waitFor();
  }
  await page.waitForFunction(() => document.querySelector("[data-testid=step-state]")?.textContent === "Проверка пройдена");
  const done = page.locator("#complete-h").locator("xpath=..").locator('input[type="checkbox"]');
  for (let i = 0; i < await done.count(); i++) await done.nth(i).check();
  await page.getByRole("button", { name: "Завершить шаг" }).click();
  await page.getByText("Шаг завершён и сохранён.").waitFor();
  assert.equal(await stateBadge(), "Завершён");
  return step;
}

try {
  // 1. Sign-in, diagnostic, task map.
  await page.goto("/career/v3");
  const email = await admitAndSignIn();
  await page.getByLabel("Мне исполнилось 18 лет").check();
  await page.getByLabel(/принимаю/).check();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByText(/Вопрос 1 из \d+/).waitFor();
  let guard = 0;
  while (guard++ < 30) {
    if (await page.getByRole("heading", { name: "Проверьте ответы" }).isVisible()) break;
    const name = await page.locator("main fieldset input").first().getAttribute("name");
    for (const v of [profile[name]].flat()) await page.locator(`input[name="${name}"][value="${v}"]`).check();
    await page.getByRole("button", { name: /Продолжить|К проверке ответов/ }).click();
  }
  await page.getByRole("button", { name: "Сохранить и открыть карту" }).click();
  await page.getByRole("heading", { level: 1, name: "Моя карта задач" }).waitFor();
  pass("sign-in by synthetic email code, diagnostic saved, task map shown");

  // 2. Route with progress 0/30.
  await page.getByRole("button", { name: "Открыть «Мой маршрут»" }).click();
  await page.getByText("Завершено 0 из 30 шагов · 0%").waitFor();
  assert.equal(await page.locator("main ol > li").count(), 30);
  assert.equal(await page.getByRole("progressbar").getAttribute("aria-valuenow"), "0");
  await noTechIds("route");
  await noOverflow("route");
  await a11y("route");
  await shot("route-start");
  pass("route: 30 saved steps, progress 0 of 30, start button");

  // 3. Step 1: exercise self-check, failed then passed mini-test, completion.
  await page.getByRole("button", { name: "Начать: шаг 1" }).click();
  const s1 = await doStep(1, { wrongFirst: true });
  await noTechIds("step");
  await noOverflow("step");
  await a11y("step");
  await shot("step-done");
  pass("step 1: in progress → self-check saved → wrong mini-test keeps it open → passed → step criteria → completed");

  // 4. API guards from the signed-in browser session.
  const before = (await progressJson()).summary.done;
  const again = await post("progress/steps/1/complete", { stableId: s1.stableId, completionMet: s1.completionCriteria.map(() => true) });
  assert.equal(again.status(), 200);
  assert.equal((await again.json()).alreadyDone, true);
  assert.equal((await progressJson()).summary.done, before, "a repeated completion is not counted");
  const pr = await progressJson();
  const s2 = pr.plan.steps[1];
  assert.equal((await post("progress/steps/2/complete", { stableId: s2.stableId, completionMet: s2.completionCriteria.map(() => true) })).status(), 409, "no completion without the checks");
  assert.equal((await post("progress/steps/2/start", { stableId: pr.plan.steps[2].stableId })).status(), 409, "position and step ID must match");
  assert.equal((await post("progress/steps/31/start", { stableId: s2.stableId })).status(), 404);
  assert.equal((await post("progress/steps/2/start", { stableId: s2.stableId, state: "done" })).status(), 400, "the client cannot send a state");
  assert.equal((await post("progress/steps/2/self-check", { stableId: s2.stableId, criteriaMet: ["ООО Ромашка, +7 900 000 00 00"] })).status(), 400, "free text is refused");
  assert.equal((await page.request.post(`${API}/progress/steps/2/start`, { data: { stableId: s2.stableId }, headers: { Origin: "https://evil.example" } })).status(), 403);
  pass("API: repeated completion idempotent; fake completion, mismatched IDs, client-sent state, free text and foreign origin refused");

  // 5. Step 2, then open step 3 and leave.
  await page.getByRole("button", { name: /Следующий шаг: 2/ }).click();
  await doStep(2);
  await page.getByRole("button", { name: /Следующий шаг: 3/ }).click();
  await page.waitForFunction(() => document.querySelector("[data-testid=step-state]")?.textContent === "Изучается");
  await page.getByRole("button", { name: "← Мой маршрут" }).click();
  await page.getByText("Завершено 2 из 30 шагов · 6%").waitFor();
  await page.getByRole("button", { name: "Продолжить: шаг 3" }).waitFor();
  await shot("route-progress");
  pass("route: 2 of 30 completed (6%), resume button points to step 3");

  // 6. Sign out, sign in again with the same synthetic email, resume.
  await page.getByRole("button", { name: "Выйти" }).click();
  await page.getByLabel("Код доступа тестировщика").waitFor();
  assert.equal((await page.request.get(`${API}/progress`)).status() >= 400, true, "no access after sign-out");
  await db.query("UPDATE career_otp SET created_at=created_at-interval '2 minutes' WHERE email=$1", [email]); // keeps the v2 1-per-minute guard
  await page.goto("/career/v3");
  await admitAndSignIn(email);
  await page.getByRole("heading", { level: 1, name: "Мой маршрут" }).waitFor();
  await page.getByText("Завершено 2 из 30 шагов · 6%").waitFor();
  await page.getByRole("button", { name: "Продолжить: шаг 3" }).click();
  await page.waitForFunction(() => document.querySelector("[data-testid=step-state]")?.textContent === "Изучается");
  assert.match(await mainText(), /Шаг 3 из 30/);
  await shot("resume");
  pass("sign-out → sign-in with the same email: the cabinet opens the saved route at 2/30 and resumes step 3");

  // 7. Lesson version changes: route becomes history, explicit rebuild, nothing transferred.
  const current = await progressJson();
  const target = current.plan.steps.find((s, i) => i >= 3 && !s.lessonId.startsWith("SAF-")).lessonId;
  const fx = JSON.parse(readFileSync(FIXTURE, "utf8"));
  fx.lessons.find((l) => l.document.id === target).document.version = "1.1.0";
  writeFileSync(FIXTURE, JSON.stringify(fx));
  await page.getByRole("button", { name: "← Мой маршрут" }).click();
  await page.getByText("Маршрут устарел — продолжить его нельзя.").waitFor();
  assert.match(await mainText(), /обновилась версия урока/);
  assert.match(await mainText(), /Завершено 2 из 30/);
  await a11y("stale route");
  await shot("route-stale");
  await page.getByRole("button", { name: "Собрать новый маршрут" }).click();
  await page.getByText("Завершено 0 из 30 шагов · 0%").waitFor();
  await page.getByText("История прежних маршрутов").waitFor();
  assert.match(await mainText(), /завершено 2 из 30 шагов/);
  await noOverflow("route after rebuild");
  await shot("route-rebuilt");
  pass("lesson version change: route marked stale and read-only, rebuilt on request, 2 old steps kept in history, not transferred");

  assert.deepEqual(errors, [], "browser errors: " + errors.join("; "));
  assert.deepEqual(external, [], "external requests: " + external.join("; "));
  pass("no browser errors and no external requests");
  console.log(`${checks.length} v3 progress browser checks passed; screenshots in ${shots}`);
} finally {
  copyFileSync(FIXTURE + ".orig", FIXTURE);
  rmSync(FIXTURE + ".orig");
  await db.end();
  await browser.close();
}
