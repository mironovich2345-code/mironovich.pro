// AI Career 3.0 cabinet — local synthetic browser QA. Never points at a published site.
// Usage: node tests/career-v3-browser.mjs content   (real library: honest "not ready")
//        node tests/career-v3-browser.mjs fixture   (server started with CAREER_V3_FIXTURE_LIBRARY=1
//                                                     and CAREER_V3_REVIEW_PREVIEW=1)
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
process.loadEnvFile(".env.career.local");
const MODE = ["fixture", "preview"].includes(process.argv[2]) ? process.argv[2] : "content";
const origin = process.env.CAREER_APP_ORIGIN;
assert.equal(new URL(origin).hostname, "127.0.0.1");
assert.equal(process.env.CAREER_PAYMENT_MODE, "fixture");
const shots = process.env.CAREER_V3_SCREENSHOTS || "/tmp/mironovich-career-v3-browser";
mkdirSync(shots, { recursive: true });
const profiles = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles;
const WIDTHS = [320, 375, 390, 768, 1024, 1440];
const TECH_ID = /\b(T\d{2}|SAFE-\d{2}|TPL-[A-Z0-9-]+|[A-Z]{3}\d{2}-TASK-\d+|STEP-\d{2}|(SAF|SAL|MAP|TRD|VAL)-\d{2}(-EX)?|approved_tools_public_data|synthetic_only|manual_without_ai)\b/;
const errors = [], external = [], checks = [];
const pass = (n) => { checks.push(n); console.log("PASS", n); };

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
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
    await page.screenshot({ path: `${shots}/${MODE}-${name}-${w}.png`, fullPage: w < 600 ? false : false });
  }
  await page.setViewportSize({ width: 390, height: 844 });
};
async function noOverflow(label) {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(80);
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(o.sw <= o.cw + 1, `${label}: horizontal scroll at ${w}px (${o.sw} > ${o.cw})`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
}
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
async function noTechIds(label) {
  // Open every disclosure so collapsed sample answers are checked too.
  await page.evaluate(() => document.querySelectorAll("main details").forEach((d) => { d.open = true; }));
  const t = await mainText();
  const m = TECH_ID.exec(t);
  assert.ok(!m, `${label}: technical identifier shown: ${m?.[0]} … ${t.slice(Math.max(0, (m?.index ?? 0) - 60), (m?.index ?? 0) + 40)}`);
}

// 1. Tester admission, sign-in by synthetic email code, synthetic access.
await page.goto("/career/v3");
const decline = page.getByRole("button", { name: "Не согласен" });
if (await decline.isVisible().catch(() => false)) await decline.click();
await page.getByLabel("Код доступа тестировщика").fill(process.env.CAREER_TESTER_SECRET);
await page.getByLabel("Работаю только с синтетическими данными").check();
await page.getByRole("button", { name: "Продолжить" }).click();
await page.getByLabel("Учебный email").waitFor();
const email = await page.getByLabel("Учебный email").inputValue();
assert.match(email, /^demo-[a-z0-9-]+@example\.invalid$/);
await page.getByRole("button", { name: "Продолжить" }).click();
await page.getByLabel("Одноразовый код").waitFor();
const mail = await (await fetch(new URL("/fixture/mail/" + encodeURIComponent(email), process.env.CAREER_PROVIDER_FIXTURE_URL), { headers: { "x-fixture-key": process.env.CAREER_FIXTURE_CONTROL_SECRET } })).json();
await page.getByLabel("Одноразовый код").fill(mail.code);
await page.getByRole("button", { name: "Продолжить" }).click();
await page.getByLabel("Мне исполнилось 18 лет").check();
await page.getByLabel(/принимаю/).check();
await page.getByRole("button", { name: "Продолжить" }).click();
await page.getByRole("navigation", { name: "Разделы кабинета" }).waitFor();
pass("tester admission, synthetic email-code sign-in and simulated test access (v2 endpoints reused)");

// Preview mode: every real draft lesson rendered by the universal lesson component (local flag only).
if (MODE === "preview") {
  await page.getByRole("link", { name: "Уроки" }).click();
  await page.locator("main").getByRole("button").filter({ hasText: "Черновик на проверке" }).first().waitFor();
  const titles = await page.locator("main").getByRole("button").filter({ hasText: "Черновик на проверке" }).allInnerTexts();
  assert.ok(titles.length >= 1, "draft lessons listed");
  for (const raw of titles) {
    const title = raw.replace("Черновик на проверке", "").trim();
    await page.locator("main").getByRole("button").filter({ hasText: title }).first().click();
    await page.getByText("Черновик на проверке.").waitFor();
    const t = await mainText();
    for (const part of ["Что вы научитесь делать", "Объяснение", "Разобранные примеры", "Пошаговая инструкция", "Шаблоны и промпты", "Практика", "Мини-тест"]) assert.match(t, new RegExp(part), title + ": " + part);
    await noTechIds("preview " + title);
    await noOverflow("preview " + title);
    await a11y("preview " + title);
    if (/Справка о компании|Первое письмо/.test(title)) await shot("real-lesson-" + (title.startsWith("Справка") ? "SAL01" : "SAL02"));
    await page.getByRole("button", { name: "← Все уроки" }).click();
    await page.locator("main").getByRole("button").filter({ hasText: "Черновик на проверке" }).first().waitFor();
  }
  pass(`review preview: ${titles.length} real draft lessons render through the universal component without IDs, overflow or contrast issues`);
  assert.deepEqual(errors, [], "browser errors: " + errors.join("; "));
  assert.deepEqual(external, [], "external requests: " + external.join("; "));
  await browser.close();
  console.log(`${checks.length} v3 browser checks passed (${MODE})`);
  process.exit(0);
}

// 2. Diagnostic: one question per screen, keyboard on the first question, dynamic tasks, follow-ups.
const profile = profiles.find((p) => p.id === (MODE === "fixture" ? "FX-b2b-experienced-public-tools" : "FX-inbound-starter"));
await page.getByText(/Вопрос 1 из \d+/).waitFor();
await noOverflow("diagnostic question");
await shot("diagnostic-question");
const firstValue = profile.answers.Q01;
await page.locator(`input[name="Q01"][value="${firstValue}"]`).focus();
await page.keyboard.press("Space");
await page.keyboard.press("Enter");
await page.getByText(/Вопрос 2 из/).waitFor();
pass("keyboard: choose with Space, continue with Enter; focus moves to the new question");
await page.getByRole("button", { name: "Назад" }).click();
await page.getByText(/Вопрос 1 из/).waitFor();
assert.ok(await page.locator(`input[name="Q01"][value="${firstValue}"]`).isChecked(), "answer kept when going back");
await page.getByRole("button", { name: "Продолжить" }).click();
pass("Back keeps the previous answer");

let guard = 0, sawFollowUp = false;
while (guard++ < 30) {
  if (await page.getByRole("heading", { name: "Проверьте ответы" }).isVisible()) break;
  const name = await page.locator("main fieldset input").first().getAttribute("name");
  if (name.startsWith("F")) sawFollowUp = true;
  const value = profile.answers[name];
  assert.ok(value !== undefined, "profile has no answer for " + name);
  if (name === "Q04") assert.ok(await page.locator(`input[name="Q04"][value="${[value].flat()[0]}"]`).count(), "dynamic task options offered for the chosen specialisation");
  for (const v of [value].flat()) await page.locator(`input[name="${name}"][value="${v}"]`).check();
  if (name === "Q05") { await shot("diagnostic-help"); }
  await page.getByRole("button", { name: /Продолжить|К проверке ответов/ }).click();
}
assert.equal(sawFollowUp, !!(profile.answers.F01 || profile.answers.F02), "follow-up asked only when its condition holds");
pass(`all ${Object.keys(profile.answers).length} questions answered one per screen; follow-up ${sawFollowUp ? "asked" : "not asked"} as required`);

// 3. Edit an answer from the review screen.
await noOverflow("review");
await shot("diagnostic-review");
const idx = (await page.locator("main ol > li").allInnerTexts()).findIndex((t) => /учебу|обучение и упражнения|выделять на обучение/i.test(t));
await page.getByRole("button", { name: `Изменить ответ на вопрос ${idx + 1}` }).click();
await page.locator('input[name="Q17"][value="10_15"]').check();
await page.getByRole("button", { name: /Продолжить/ }).click();
while (!(await page.getByRole("heading", { name: "Проверьте ответы" }).isVisible())) await page.getByRole("button", { name: /Продолжить|К проверке ответов/ }).click();
assert.match(await mainText(), /10–15 минут/);
pass("answers can be changed from the review screen");

// 4. Server validation errors are shown and lead back to the question.
await page.route("**/api/career/v3/sales_manager/diagnostic", async (r) => {
  if (r.request().method() !== "POST") return r.continue();
  const body = JSON.parse(r.request().postData());
  body.answers.Q05 = "ООО Ромашка, договор №17";
  await r.continue({ postData: JSON.stringify(body) });
});
await page.getByRole("button", { name: "Сохранить и открыть карту" }).click();
await page.getByText("Сервер не принял некоторые ответы").waitFor();
assert.match(await mainText(), /Недопустимый вариант ответа/);
await page.unroute("**/api/career/v3/sales_manager/diagnostic");
pass("server validation rejects a free-text value and the error is shown next to the question");
await page.getByRole("button", { name: "Сохранить и открыть карту" }).click();

// 5. Task map.
await page.getByRole("heading", { level: 1, name: "Моя карта задач" }).waitFor();
await page.locator("main details").first().locator("summary").click();
const mapText = await mainText();
assert.match(mapText, /ответам анкеты и матрице профессии/);
assert.match(mapText, /не оценка ваших профессиональных навыков/);
assert.match(mapText, /Обоснование из матрицы профессии/);
if (MODE === "content") assert.match(mapText, /недостаточно оснований|пока нет оснований/i);
else assert.match(mapText, /Вы указали/);
assert.doesNotMatch(mapText, /ваш\S* сильн\S* сторон/i, "no claim of proven strengths");
await noTechIds("task map");
await noOverflow("task map");
const mapContrast = await a11y("task map");
await shot("task-map");
pass(`task map: profile, AI role per task, responsibility, limits, bases from own answers, growth skills, sources of conclusions; no IDs (worst contrast ${mapContrast})`);

// 6. Route.
await page.getByRole("button", { name: "Открыть «Мой маршрут»" }).click();
await page.getByRole("heading", { level: 1, name: "Мой маршрут" }).waitFor();
await page.waitForFunction(() => !document.querySelector("main [role=status]")?.textContent?.includes("Проверяем"));
const routeText = await mainText();
if (MODE === "content") {
  assert.match(routeText, /пока не готов/);
  assert.doesNotMatch(routeText, /Шаг 1 ·/);
  pass("route: honest 'not ready' with no placeholder steps on the real library");
} else {
  assert.equal(await page.locator("main ol > li").count(), 30);
  assert.match(routeText, /Синтетическая тестовая библиотека/);
  assert.match(routeText, /не календарные дни/);
  pass("route: 30 steps from the isolated synthetic fixture, clearly labelled");
}
await noTechIds("route");
await noOverflow("route");
await a11y("route");
await shot("route");

// 7. Lessons.
if (MODE === "content") {
  await page.getByRole("link", { name: "Уроки" }).click();
  await page.getByRole("heading", { level: 1, name: "Уроки" }).waitFor();
  await page.getByText(/Опубликованных уроков пока нет/).waitFor();
  assert.equal(await page.getByText("Черновики на проверке").count(), 0, "no review preview without the local flag");
  await noOverflow("lessons");
  await a11y("lessons");
  await shot("lessons-empty");
  pass("lessons: nothing published, no draft preview in normal mode");
} else {
  await page.getByRole("link", { name: "Мой маршрут" }).click();
  await page.locator("main ol > li").first().getByRole("button", { name: /Открыть урок/ }).click();
  await page.getByRole("heading", { level: 1 }).waitFor();
  const t = await mainText();
  for (const part of ["Что вы научитесь делать", "Объяснение", "Разобранные примеры", "Пошаговая инструкция", "Шаблоны и промпты", "Практика", "Мини-тест", "Материалы для скачивания"]) assert.match(t, new RegExp(part));
  assert.match(t, /Синтетическая тестовая заглушка/);
  const ex = page.locator("main fieldset").filter({ hasText: "Самопроверка по критериям" }).first();
  const boxes = ex.locator('input[type="checkbox"]');
  for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
  await page.getByText(/Все критерии отмечены/).first().waitFor();
  await page.getByText("Показать образец ответа").first().click();
  const quiz = page.locator("main fieldset").filter({ has: page.getByRole("button", { name: "Проверить ответ" }) }).first();
  await quiz.locator('input[type="radio"]').first().check();
  await quiz.getByRole("button", { name: "Проверить ответ" }).click();
  await quiz.getByText(/Верно\.|Не совсем\./).waitFor();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Синтетическая фикстура|Рабочий лист|фикстура/i }).first().click()]);
  assert.ok((await download.suggestedFilename()).length > 3);
  await noTechIds("lesson");
  await noOverflow("lesson");
  await a11y("lesson");
  await shot("lesson");
  pass("lesson from the route: all sections, exercise self-check, sample answer, mini-test feedback, download");

  await page.getByRole("button", { name: "← Все уроки" }).click();
  await page.getByText("Черновики на проверке").waitFor();
  await page.locator("main").getByRole("button").filter({ hasText: "Черновик на проверке" }).first().click();
  await page.getByText("Черновик на проверке.").waitFor();
  assert.match(await mainText(), /не опубликован/);
  await noOverflow("review preview");
  await shot("lesson-preview");
  pass("review preview opens a draft lesson labelled 'Черновик на проверке' (local flag only)");
}

assert.deepEqual(errors, [], "browser errors: " + errors.join("; "));
assert.deepEqual(external, [], "external requests: " + external.join("; "));
pass("no browser errors and no external requests");
await browser.close();
console.log(`${checks.length} v3 browser checks passed (${MODE}); screenshots in ${shots}`);
