// AI Career 3.0 — "Мои результаты" (#47) end to end in a real browser against the local synthetic sandbox
// started with CAREER_V3_FIXTURE_LIBRARY=1 (synthetic fixture lessons only).
// Path: sign-in → diagnostic → route → two steps → results → measurement forms (ok, invalid, insufficient)
// → three report variants → copy → PDF; keyboard, mobile widths and contrast.
// Usage: node tests/career-v3-results-browser.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, copyFileSync, rmSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { Pool } = require("pg");
process.loadEnvFile(".env.career.local");
const origin = process.env.CAREER_APP_ORIGIN;
assert.equal(new URL(origin).hostname, "127.0.0.1");
assert.equal(process.env.CAREER_PAYMENT_MODE, "fixture");
const shots = process.env.CAREER_V3_SCREENSHOTS || "/tmp/mironovich-career-v3-results";
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
const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
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
    await page.screenshot({ path: `${shots}/results-${name}-${w}.png` });
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


async function finishStepViaApi(n) {
  const pr = await progressJson();
  const s = pr.plan.steps.find((x) => x.position === n);
  const lesson = await lessonJson(s.lessonId);
  const ex = lesson.content.exercises.find((e) => e.id === s.exerciseId);
  assert.equal((await post(`progress/steps/${n}/start`, { stableId: s.stableId })).status(), 200);
  assert.equal((await post(`progress/steps/${n}/self-check`, { stableId: s.stableId, criteriaMet: ex.successCriteria.map(() => true) })).status(), 200);
  if (!pr.quizzes[s.lessonId]?.passed) assert.equal((await post(`progress/lessons/${s.lessonId}/quiz`, { answers: Object.fromEntries(lesson.content.quiz.map((q) => [q.id, q.correctId])) })).status(), 200);
  assert.equal((await post(`progress/steps/${n}/complete`, { stableId: s.stableId, completionMet: s.completionCriteria.map(() => true) })).status(), 200);
}
const daysAgo = (k) => new Date(Date.now() - k * 864e5).toISOString().slice(0, 10);
async function fillPoint(card, legend, value, sample, date) {
  const fs = card.locator("fieldset").filter({ has: page.locator("legend", { hasText: legend }) });
  await fs.getByLabel(/Значение/).fill(String(value));
  await fs.getByLabel("Число задач").fill(String(sample));
  await fs.getByLabel("Дата замера").fill(date);
}

try {
  // 1. Sign-in, diagnostic, route.
  await page.goto("/career/v3");
  await admitAndSignIn();
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
  await page.getByRole("link", { name: "Мои результаты" }).click();
  await page.getByText(/Результаты появятся, когда будет собран маршрут/).waitFor();
  pass("results before a route: an honest empty state with a link to the route");

  await page.getByRole("button", { name: "Открыть «Мой маршрут»" }).click();
  await page.getByText("Завершено 0 из 30 шагов · 0%").waitFor();
  await finishStepViaApi(1);
  await finishStepViaApi(2);
  await page.reload();
  await page.getByText("Завершено 2 из 30 шагов · ≈7%").waitFor();
  pass("progress display: 2 of 30 completed shown as ≈7% with the exact count");

  // 2. Results page.
  await page.getByRole("link", { name: "Мои результаты" }).click();
  await page.getByRole("heading", { level: 1, name: "Мои результаты" }).waitFor();
  await page.waitForSelector("[data-measurement]");
  const t = await mainText();
  assert.match(t, /Завершено 2 из 30 шагов · ≈7%/);
  assert.match(t, /самопроверка по критериям уроков, а не объективное подтверждение профессионального навыка/);
  assert.match(t, /Мини-тест: пройден/);
  await noTechIds("results");
  await noOverflow("results");
  await a11y("results");
  await shot("overview");
  pass("results overview: completed steps, lessons with mini-tests, self-check disclaimer; no IDs, no overflow, contrast ok");

  // 3. Measurement: invalid value → clear error; valid → formulas; second slot without baseline → insufficient.
  const results = await (await page.request.get(`${API}/results`)).json();
  const slots = results.measurements.filter((m) => m.eligible);
  const first = slots.find((m) => m.units.includes("minutes")) ?? slots[0];
  const card = page.locator(`[data-measurement="${first.position}"]`);
  const minutes = first.units[0] === "minutes";
  await fillPoint(card, "Было", -5, 4, daysAgo(9));
  await fillPoint(card, "Стало", minutes ? 2.5 : 75, 4, daysAgo(2));
  if (minutes) { await card.getByLabel("Время проверки, мин").fill("7"); await card.getByLabel("Время исправления, мин").fill("3.5"); }
  for (const label of ["одного типа и объёма", "способ замера", "один и тот же человек", "Только вымышленные", "включает проверку"]) await card.getByLabel(new RegExp(label)).check();
  await card.getByRole("button", { name: "Сохранить замер" }).click();
  await card.getByRole("alert").getByText(/число от 0 до/).waitFor();
  pass("a negative value is refused by the server with a readable message next to the form");
  await fillPoint(card, "Было", minutes ? 19 : 50, 4, daysAgo(9));
  await card.getByRole("button", { name: "Сохранить замер" }).click();
  await card.locator('[data-comparison="ok"]').waitFor();
  const ct = (await card.innerText()).replace(/\s+/g, " ");
  if (minutes) {
    assert.match(ct, /2,5 \+ 7 \+ 3,5 = 13 мин/);
    assert.match(ct, /13 − 19 = −6 мин/);
    assert.match(ct, /−6 \/ 19 × 100 = −32% от «было»/);
  } else assert.match(ct, /25 п\. п\./);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/results-measurement-390.png` });
  pass("valid measurement: readable formulas — total time with review and fix, difference, percent of «было»");

  const second = slots.find((m) => m.position !== first.position);
  const card2 = page.locator(`[data-measurement="${second.position}"]`);
  await fillPoint(card2, "Стало", second.units[0] === "minutes" ? 10 : 60, 4, daysAgo(1));
  await card2.getByRole("button", { name: "Сохранить замер" }).click();
  await card2.locator('[data-comparison="insufficient"]').waitFor();
  assert.match(await card2.innerText(), /Недостаточно оснований для вывода[\s\S]*Нет исходного замера/);
  pass("no baseline and unchecked comparability → «Недостаточно оснований для вывода» with reasons");

  // 4. Report builder: three variants, keyboard copy, PDF.
  await page.locator('[data-report="results"]').waitFor();
  let rt = (await page.locator('[data-report="results"]').innerText()).replace(/\s+/g, " ");
  for (const h of ["1. Какую задачу я изучал", "2. Какой безопасный способ работы проверял", "3. Что измерил", "4. Что изменилось на учебных данных", "5. Ограничения результата", "6. Какой следующий эксперимент"]) assert.ok(rt.includes(h), h);
  assert.match(rt, /Учебные данные/);
  assert.match(rt, /не доказана и не утверждается/);
  await page.getByLabel("Предложение двухнедельного пилота").check();
  await page.locator('[data-report="pilot"]').waitFor();
  assert.match(await page.locator('[data-report="pilot"]').innerText(), /две недели/i);
  await page.keyboard.press("ArrowRight");
  await page.locator('[data-report="development"]').waitFor();
  rt = (await page.locator('[data-report="development"]').innerText()).replace(/\s+/g, " ");
  assert.match(rt, /а не запрос о должности или оплате/);
  pass("report builder: six sections; three variants switch with the mouse and arrow keys");
  await page.getByRole("button", { name: "Скопировать текст" }).focus();
  await page.keyboard.press("Enter");
  await page.getByText("Текст скопирован").waitFor();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clip, /^Просьба обсудить дальнейшее развитие/);
  assert.doesNotMatch(clip, /@example|demo-|[0-9a-f]{8}-[0-9a-f]{4}-|STEP-\d{2}|TPL-/);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Скачать PDF" }).click()]);
  assert.equal(download.suggestedFilename(), "uchebnyj-otchet-development.pdf");
  const buf = readFileSync(await download.path());
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  pass("copy by keyboard puts the report text (no email, IDs or tokens) on the clipboard; PDF downloads");
  await page.locator('[data-report]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/results-report-390.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('[data-report]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/results-report-1440.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow("results with forms and report");
  await a11y("results with forms and report");

  // 5. API guards from the browser session.
  const m = { unit: first.units[0], baseline: null, after: null, reviewMinutes: null, fixMinutes: null, errorsFound: null, conditions: Object.fromEntries(["sameTaskType", "sameMethod", "samePerformer", "trainingDataOnly", "reviewIncluded"].map((k) => [k, true])), limitations: [] };
  assert.equal((await post(`results/measurements/${first.position}`, { stableId: first.stableId + "x", metricId: first.metric.id, measurement: m })).status(), 409);
  assert.equal((await post(`results/measurements/${first.position}`, { stableId: first.stableId, metricId: "renewal_rate", measurement: m })).status(), 409);
  assert.equal((await post(`results/measurements/${first.position}`, { stableId: first.stableId, metricId: first.metric.id, measurement: { ...m, note: "клиент" } })).status(), 400);
  assert.equal((await post(`results/measurements/${first.position}`, { stableId: first.stableId, metricId: first.metric.id, measurement: m, accountId: "x" })).status(), 400);
  assert.equal((await page.request.get(`${API}/results/report?kind=promotion`)).status(), 400);
  pass("API: forged step, substituted metric, free text, extra account field and unknown report kind are refused");

  assert.deepEqual(errors, [], "browser errors: " + errors.join("; "));
  assert.deepEqual(external, [], "external requests: " + external.join("; "));
  pass("no browser errors and no external requests");
  console.log(`${checks.length} v3 results browser checks passed; screenshots in ${shots}`);
} finally {
  copyFileSync(FIXTURE + ".orig", FIXTURE);
  rmSync(FIXTURE + ".orig");
  await db.end();
  await browser.close();
}
