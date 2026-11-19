// Closed cloud demo — browser E2E through the real UI, on phone and desktop emulation (Chromium:
// iPhone 13 and Pixel 7 device profiles = viewport, touch, DPR and user agent; not real Safari/WebKit).
// Registration with an invite → recovery code → diagnostic (18 questions) → task map → route of 30 steps →
// steps through the UI → sign-out → sign-in → resume → remaining steps → measurements → «Мои результаты» →
// three reports, copy, PDF download → repeated diagnostic → rebuild with history → account → deletion.
// Notice on every screen; no technical IDs, no horizontal scroll, no external requests, no console errors.
// Usage (after a demo build, see docs/products/ai-career-v3/demo/README.md): node tests/career-demo-browser.mjs
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
const shots = process.env.CAREER_DEMO_SCREENSHOTS || "/tmp/mironovich-career-demo";
mkdirSync(shots, { recursive: true });
const db = new Pool({ connectionString: process.env.CAREER_V3_DEMO_DATABASE_URL, max: 1 });
await db.query("TRUNCATE career_accounts, career_demo_invites, career_rate_buckets, career_events CASCADE");
const admin = (...a) => execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/career/demo-admin.mjs", ...a]).toString().trim();
const BANNER = "Демонстрационная версия. Учебные материалы находятся на проверке. Используйте только вымышленные данные";
const TECH_ID = /\b(T\d{2}|SAFE-\d{2}|TPL-[A-Z0-9-]+|[A-Z]{3}\d{2}-TASK-\d+|STEP-\d{2}|(SAF|SAL|MAP|TRD|VAL)-\d{2}(-EX)?)\b|[0-9a-f]{8}-[0-9a-f]{4}-|example\.invalid|approved|canBePublished|status=/;
const profiles = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles;
const answers = profiles.find((p) => p.id === "FX-b2b-experienced-public-tools").answers;
const PASSWORD = "Demo-browser-" + Math.random().toString(36).slice(2, 8);
const API = `${origin}/api/career/v3/sales_manager`;
const checks = [], errors = [], external = [];
const pass = (n) => { checks.push(n); console.log("PASS", n); };

const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", new URL(origin).port], { env: process.env, stdio: "ignore", detached: true });
for (let i = 0; i < 60; i++) { try { await fetch(origin + "/robots.txt"); break; } catch { await sleep(500); } }

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
async function open(device) {
  const context = await browser.newContext({ ...device, baseURL: origin });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await context.route("**/*", async (r) => { if (new URL(r.request().url()).origin !== origin) { external.push(r.request().url()); await r.abort(); } else await r.continue(); });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { context, page };
}
const screen = async (page, name, label = name) => {
  await page.waitForTimeout(150);
  const note = await page.getByRole("note").innerText();
  assert.equal(note.trim(), BANNER, `${label}: demo notice`);
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const m = TECH_ID.exec(text);
  assert.ok(!m, `${label}: technical value shown: ${m?.[0]}`);
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(o.sw <= o.cw + 1, `${label}: horizontal scroll`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
};
const post = (page, path, data) => page.request.post(`${API}/${path}`, { data, headers: { Origin: origin } });
const json = async (page, path) => (await page.request.get(`${API}/${path}`)).json();

async function diagnosticUI(page) {
  await page.getByText(/Вопрос 1 из 18/).waitFor();
  let guard = 0;
  while (guard++ < 30) {
    if (await page.getByRole("heading", { name: "Проверьте ответы" }).isVisible()) break;
    const name = await page.locator("main fieldset input").first().getAttribute("name");
    for (const v of [answers[name]].flat()) await page.locator(`input[name="${name}"][value="${v}"]`).check();
    await page.getByRole("button", { name: /Продолжить|К проверке ответов/ }).click();
  }
  await page.getByRole("button", { name: "Сохранить и открыть карту" }).click();
  await page.getByRole("heading", { level: 1, name: "Моя карта задач" }).waitFor();
}
async function stepUI(page, n) {
  await page.waitForFunction(() => document.querySelector("[data-testid=step-state]"));
  const pr = await json(page, "progress");
  const step = pr.plan.steps.find((s) => s.position === n);
  const lesson = (await json(page, "lessons/" + step.lessonId)).lesson;
  const boxes = page.locator("#exercise-h").locator("xpath=..").locator('input[type="checkbox"]');
  for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
  await page.getByRole("button", { name: "Сохранить самопроверку" }).click();
  await page.getByText("Самопроверка сохранена.").waitFor();
  if (!pr.quizzes[step.lessonId]?.passed) {
    for (const q of lesson.content.quiz) await page.locator(`input[name="step-${q.id}"]`).nth(q.options.findIndex((o) => o.id === q.correctId)).check();
    await page.getByRole("button", { name: "Отправить ответы" }).click();
    await page.getByText("Мини-тест пройден.").first().waitFor();
  }
  await page.waitForFunction(() => document.querySelector("[data-testid=step-state]")?.textContent === "Проверка пройдена");
  const done = page.locator("#complete-h").locator("xpath=..").locator('input[type="checkbox"]');
  for (let i = 0; i < await done.count(); i++) await done.nth(i).check();
  await page.getByRole("button", { name: "Завершить шаг" }).click();
  await page.getByText("Шаг завершён и сохранён.").waitFor();
}
async function stepAPI(page, step) {
  const lesson = (await json(page, "lessons/" + step.lessonId)).lesson;
  const ex = lesson.content.exercises.find((e) => e.id === step.exerciseId);
  assert.equal((await post(page, `progress/steps/${step.position}/start`, { stableId: step.stableId })).status(), 200);
  assert.equal((await post(page, `progress/steps/${step.position}/self-check`, { stableId: step.stableId, criteriaMet: ex.successCriteria.map(() => true) })).status(), 200);
  const pr = await json(page, "progress");
  if (!pr.quizzes[step.lessonId]?.passed)
    assert.equal((await post(page, `progress/lessons/${step.lessonId}/quiz`, { answers: Object.fromEntries(lesson.content.quiz.map((q) => [q.id, q.correctId])) })).status(), 200);
  assert.equal((await post(page, `progress/steps/${step.position}/complete`, { stableId: step.stableId, completionMet: step.completionCriteria.map(() => true) })).status(), 200);
}

try {
  // ——— iPhone 13 profile: the complete learner scenario ———
  const { context, page } = await open(devices["iPhone 13"]);
  const email = `iphone-tester-${Date.now().toString(36)}@example.com`;
  await page.goto("/");
  await page.getByRole("heading", { name: "Карьерный маршрут менеджера по продажам" }).waitFor();
  await screen(page, "01-welcome-iphone");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Повторите пароль").fill(PASSWORD);
  await page.getByLabel("Пригласительный код").fill("WRNG-CODE-AAAA-BBBB");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await page.getByText("Пригласительный код недействителен или уже использован").waitFor();
  await page.getByLabel("Пригласительный код").fill(admin("invite", "iphone"));
  await screen(page, "02-register-iphone");
  const fontSize = await page.getByLabel("Email").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  assert.ok(fontSize >= 16, "inputs ≥16px: iOS Safari does not zoom");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await page.getByRole("heading", { name: "Код восстановления" }).waitFor();
  const recovery = (await page.locator("[data-recovery-code]").innerText()).trim();
  assert.match(recovery, /^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/);
  assert.ok(await page.getByRole("button", { name: "Перейти в кабинет" }).isDisabled());
  await screen(page, "03-recovery-code-iphone");
  await page.getByLabel("Я сохранил(а) код восстановления").check();
  await page.getByRole("button", { name: "Перейти в кабинет" }).click();
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "career_demo_session");
  assert.ok(session?.httpOnly && session.sameSite === "Lax", "HttpOnly SameSite=Lax session cookie");
  assert.equal(cookies.length, 1, "no other cookies (no analytics)");
  pass("iPhone: invite registration (wrong invite refused), one-time recovery code, HttpOnly session, no analytics cookies");

  await screen(page, "04-diagnostic-iphone");
  await diagnosticUI(page);
  await screen(page, "05-task-map-iphone");
  await page.getByRole("button", { name: "Открыть «Мой маршрут»" }).click();
  await page.getByText("Завершено 0 из 30 шагов · 0%").waitFor();
  assert.equal(await page.locator("main ol > li").count(), 30);
  await screen(page, "06-route-iphone");
  pass("iPhone: diagnostic of 18 questions → task map → route of 30 steps");

  await page.getByRole("button", { name: "Начать: шаг 1" }).click();
  await stepUI(page, 1);
  await screen(page, "07-step-iphone");
  await page.getByRole("button", { name: /К маршруту|Мой маршрут/ }).first().click();
  await page.getByRole("button", { name: "Продолжить: шаг 2" }).click();
  await stepUI(page, 2);
  const first = (await json(page, "progress")).plan.steps[0];
  await page.goto("/career/v3#lesson=" + first.lessonId);
  await page.getByText("Материал на проверке.").waitFor();
  await screen(page, "08-lesson-iphone");
  pass("iPhone: steps 1–2 through the UI (exercise, self-check, mini-test, completion); lesson marked as in review");

  await page.goto("/career/v3#route");
  await page.getByRole("button", { name: "Выйти" }).click();
  await page.getByRole("heading", { name: "Вход" }).waitFor();
  await page.getByText(/Прогресс сохранён/).waitFor();
  assert.equal((await page.request.get(`${API}/progress`)).status(), 401, "signed out on the server");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(PASSWORD + "x");
  await page.getByRole("button", { name: "Войти" }).click();
  await page.getByText("Неверный email или пароль").waitFor();
  await screen(page, "09-login-iphone");
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.getByText("Завершено 2 из 30 шагов · ≈7%").waitFor();
  await page.getByRole("button", { name: "Продолжить: шаг 3" }).waitFor();
  pass("iPhone: sign-out → wrong password refused → sign-in → route resumes at step 3 with 2 of 30 ≈7%");

  const plan = (await json(page, "progress")).plan;
  for (const step of plan.steps.slice(2)) await stepAPI(page, step);
  await page.reload();
  await page.getByText("Завершено 30 из 30 шагов · 100%").waitFor();
  const res = await json(page, "results");
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  for (const m of res.measurements.filter((x) => x.eligible)) {
    const unit = m.units[0], minutes = unit === "minutes";
    const conditions = Object.fromEntries(["sameTaskType", "sameMethod", "samePerformer", "trainingDataOnly", ...(minutes ? ["reviewIncluded"] : [])].map((k) => [k, true]));
    assert.equal((await post(page, `results/measurements/${m.position}`, { stableId: m.stableId, metricId: m.metric.id, measurement: {
      unit, baseline: { value: minutes ? 19 : 50, sampleSize: 4, measuredOn: daysAgo(9) }, after: { value: minutes ? 2.5 : 75, sampleSize: 4, measuredOn: daysAgo(2) },
      reviewMinutes: minutes ? 7 : null, fixMinutes: minutes ? 3.5 : null, errorsFound: 2, conditions, limitations: [] } })).status(), 200);
  }
  await page.getByRole("link", { name: "Мои результаты" }).click();
  await page.getByRole("heading", { level: 1, name: "Мои результаты" }).waitFor();
  await screen(page, "10-results-iphone");
  for (const label of ["Для руководителя: результаты", "Для руководителя: пилот", "Для руководителя: развитие"]) {
    const radio = page.getByLabel(label, { exact: false });
    if (await radio.count()) await radio.first().check();
  }
  await page.locator("[data-report]").waitFor();
  assert.match(await page.locator("[data-report]").innerText(), /Демонстрационная версия: учебные материалы находятся на проверке/);
  await page.getByRole("button", { name: "Скопировать текст" }).click();
  await page.getByText("Текст скопирован").waitFor();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Скачать PDF" }).click()]);
  const pdf = readFileSync(await download.path());
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  await page.locator("#report-h").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/11-report-iphone.png` });
  const kinds = await page.locator('input[name="report-kind"]').count();
  assert.equal(kinds, 3, "three report kinds");
  pass("iPhone: 30/30, measurements, «Мои результаты», report copy and PDF download, 3 report kinds");

  await page.getByRole("link", { name: "Диагностика" }).click();
  await diagnosticUI(page);
  await page.getByRole("link", { name: "Мой маршрут" }).click();
  await page.getByText(/устарел|изменил/i).first().waitFor();
  await screen(page, "12-route-stale-iphone");
  assert.equal((await post(page, "plan", { rebuild: true })).status(), 200);
  const after = await json(page, "results");
  assert.deepEqual([after.history[0].done, after.summary.done], [30, 0], "previous route kept in history");
  pass("iPhone: repeated diagnostic → old route read-only and kept in history → rebuilt");

  await page.goto("/career/v3#account");
  await page.getByRole("heading", { level: 1, name: "Аккаунт" }).waitFor();
  assert.match(await page.locator("main").innerText(), /не подтверждён/);
  await screen(page, "13-account-iphone");
  pass("iPhone: account screen — email shown as not verified, stored data and retention explained");

  // ——— Pixel 7 (Android Chrome profile): second account, isolation, recovery, deletion ———
  const android = await open(devices["Pixel 7"]);
  const p2 = android.page;
  const email2 = `android-tester-${Date.now().toString(36)}@example.com`;
  await p2.goto("/career/v3");
  await p2.getByRole("button", { name: "Зарегистрироваться" }).click();
  await p2.getByLabel("Email").fill(email);
  await p2.getByLabel("Пароль", { exact: true }).fill(PASSWORD);
  await p2.getByLabel("Повторите пароль").fill(PASSWORD);
  await p2.getByLabel("Пригласительный код").fill(admin("invite", "android"));
  await p2.getByRole("button", { name: "Создать аккаунт" }).click();
  await p2.getByText("Этот email уже зарегистрирован").waitFor();
  await p2.getByLabel("Email").fill(email2);
  await p2.getByRole("button", { name: "Создать аккаунт" }).click();
  await p2.getByLabel("Я сохранил(а) код восстановления").check();
  const recovery2 = (await p2.locator("[data-recovery-code]").innerText()).trim();
  await p2.getByRole("button", { name: "Перейти в кабинет" }).click();
  await p2.getByText(/Вопрос 1 из 18/).waitFor();
  assert.equal((await json(p2, "progress")).plan, null, "a new account does not see another account's route");
  await screen(p2, "14-diagnostic-android");
  pass("Android: repeat registration refused, new account starts empty (isolation)");

  await p2.getByRole("button", { name: "Выйти" }).click();
  await p2.getByRole("button", { name: "Забыли пароль?" }).click();
  await p2.getByLabel("Email").fill(email2);
  await p2.getByLabel("Код восстановления или сброса").fill(recovery2);
  await p2.getByLabel("Новый пароль", { exact: true }).fill(PASSWORD + "-2");
  await p2.getByLabel("Повторите новый пароль").fill(PASSWORD + "-2");
  await screen(p2, "15-recover-android");
  await p2.getByRole("button", { name: "Сменить пароль" }).click();
  await p2.getByRole("heading", { name: "Код восстановления" }).waitFor();
  await p2.getByLabel("Я сохранил(а) код восстановления").check();
  await p2.getByRole("button", { name: "Перейти ко входу" }).click();
  await p2.getByLabel("Email").fill(email2);
  await p2.getByLabel("Пароль").fill(PASSWORD + "-2");
  await p2.getByRole("button", { name: "Войти" }).click();
  await p2.getByText(/Вопрос 1 из 18/).waitFor();
  await p2.goto("/career/v3#account");
  await p2.getByLabel("Пароль для подтверждения").fill(PASSWORD + "-2");
  await p2.getByLabel(/Я понимаю/).check();
  await p2.getByRole("button", { name: "Удалить аккаунт и данные" }).click();
  await p2.getByText("Аккаунт и все его данные удалены.").waitFor();
  assert.equal((await db.query("SELECT count(*)::int n FROM career_demo_users WHERE email=$1", [email2])).rows[0].n, 0);
  pass("Android: password recovery with the recovery code, sign-in with the new password, account deletion");

  // ——— Desktop ———
  const desk = await open({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await desk.page.goto("/career/v3");
  await desk.page.getByRole("button", { name: "Войти" }).click();
  await desk.page.getByLabel("Email").fill(email);
  await desk.page.getByLabel("Пароль").fill(PASSWORD);
  await desk.page.getByRole("button", { name: "Войти" }).click();
  await desk.page.getByText("Завершено 0 из 30 шагов · 0%").waitFor();
  await screen(desk.page, "16-route-desktop");
  await desk.page.goto("/career/v3#results");
  await desk.page.getByRole("heading", { level: 1, name: "Мои результаты" }).waitFor();
  await screen(desk.page, "17-results-desktop");
  for (const w of [320, 375, 768]) {
    await desk.page.setViewportSize({ width: w, height: 800 });
    const o = await desk.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(o <= 1, `no horizontal scroll at ${w}px`);
  }
  pass("desktop: same account on another device sees its rebuilt route and results; no horizontal scroll 320–1440px");

  assert.deepEqual(external, [], "no external requests");
  assert.deepEqual(errors, [], "no console errors");
  pass("no external requests, no console errors");
  console.log(`career demo browser: ${checks.length} checks passed; screenshots in ${shots}`);
} finally {
  await browser.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ }
  await db.end();
}
