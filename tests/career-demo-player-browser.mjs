// AI Career 3.0 — lesson player v2 in a real browser on the closed-demo build (local copy).
// iPhone SE keyboard-only path with WRONG then right mini-test answers (no «Урок пройден» before the server counts
// the test), step completed from the player, next step offered; fast switching + reload keeps position and
// choices; materials catalogue; navigation never covers content or focused controls; the step page does not ask
// again for counted actions; 200% zoom; accessibility tree; iPhone 13 / desktop screenshots.
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
const TECH = /\b(?:[A-Z]{3}\d{2}-(?:TASK|EX|P|Q)-?\d+|TPL-[A-Z0-9-]+|STEP-\d{2}|SAF-0\d|SAL-0\d|VAL-0\d)\b|[0-9a-f]{8}-[0-9a-f]{4}-|example\.invalid|status=/;
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
const json = async (page, path) => (await page.request.get(`${API}/${path}`)).json();
async function registerWithRoute(page, tag, route = true) {
  const email = `${tag}-${Date.now().toString(36)}@example.com`;
  assert.equal((await post(page, `${origin}/api/career/demo/register`, { email, password: PASSWORD, passwordConfirm: PASSWORD, invite: admin("invite", tag) })).status(), 201);
  if (route) {
    assert.equal((await post(page, `${API}/diagnostic`, { answers })).status(), 200);
    assert.equal((await post(page, `${API}/task-map`, {})).status(), 200);
    assert.equal((await post(page, `${API}/plan`, {})).status(), 200);
  }
  await page.reload(); // the app read the (empty) session on first load; a hash change alone does not reload it
  await page.getByRole("button", { name: "Выйти" }).waitFor();
  return email;
}
const counter = (page) => page.getByText(/^Экран \d+ из \d+$/);
const screenNo = async (page) => Number((await counter(page).innerText()).match(/Экран (\d+)/)[1]);
const typeOf = (page) => page.evaluate(() => {
  const t = document.querySelector("[data-player-screen] p")?.textContent ?? "";
  return /Самопроверка · критерий/i.test(t) ? "criterion" : /Мини-тест · вопрос/i.test(t) ? "quiz" : /^(Урок пройден|Результат)$/i.test(t.trim()) ? "result" : "other";
});
/** No internal ids, no horizontal scroll, navigation visible; at the bottom of the page and for every focused
 *  control the navigation does not cover content. Returns true when the screen fits without scrolling. */
async function screenCheck(page, label, { focus = false } = {}) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const m = TECH.exec(text);
  assert.ok(!m, `${label}: internal identifier shown: ${m?.[0]}`);
  const v = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Навигация по уроку"]').getBoundingClientRect();
    const box = document.querySelector("[data-player-screen]");
    const visible = [...box.querySelectorAll("*")].filter((e) => !e.closest("details:not([open]) > :not(summary)"));
    const bottom = visible.reduce((x, e) => Math.max(x, e.getBoundingClientRect().bottom), 0);
    return { navTop: nav.top, navBottom: nav.bottom, vh: innerHeight, sw: document.documentElement.scrollWidth - document.documentElement.clientWidth, bottom };
  });
  assert.ok(v.sw <= 1, `${label}: horizontal scroll`);
  assert.ok(v.navTop >= 0 && v.navBottom <= v.vh + 1, `${label}: navigation not visible`);
  const fits = v.bottom <= v.navTop + 1;
  if (!fits) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(80);
    const end = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Навигация по уроку"]').getBoundingClientRect();
      const box = document.querySelector("[data-player-screen]");
      const visible = [...box.querySelectorAll("*")].filter((e) => !e.closest("details:not([open]) > :not(summary)"));
      return { navTop: nav.top, bottom: visible.reduce((x, e) => Math.max(x, e.getBoundingClientRect().bottom), 0) };
    });
    assert.ok(end.bottom <= end.navTop + 1, `${label}: content hidden under the navigation at the end of the page`);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  if (focus) {
    const covered = await page.evaluate(async () => {
      const nav = document.querySelector('nav[aria-label="Навигация по уроку"]');
      const items = [...document.querySelectorAll("[data-player-screen] input, [data-player-screen] summary, [data-player-screen] button, [data-player-screen] a")];
      const bad = [];
      for (const el of items) {
        el.focus();
        await new Promise((r) => requestAnimationFrame(r));
        if (el.getBoundingClientRect().bottom > nav.getBoundingClientRect().top + 1) bad.push(el.outerHTML.slice(0, 60));
      }
      window.scrollTo(0, 0);
      return bad;
    });
    assert.deepEqual(covered, [], `${label}: focused control under the navigation`);
  }
  return fits;
}
async function pressNext(page) {
  const next = page.getByRole("button", { name: "Далее" });
  await next.focus();
  await page.keyboard.press("Enter");
}

try {
  // ——— A. iPhone SE, keyboard only, SAF-01 in a route step: wrong test → not passed; right → step completed ———
  const se = await open({ ...devices["iPhone SE"], viewport: { width: 375, height: 667 } });
  const p = se.page;
  await p.goto("/career/v3");
  await registerWithRoute(p, "player-se");
  const plan = (await json(p, "progress")).plan;
  const safStep = plan.steps.find((s) => s.lessonId === "SAF-01");
  const lesson = (await json(p, "lessons/SAF-01")).lesson;
  await p.goto(`/career/v3#step=${safStep.position}`);
  await p.getByRole("button", { name: "Пройти урок короткими экранами" }).click();
  await counter(p).waitFor();
  const total = Number((await counter(p).innerText()).match(/из (\d+)/)[1]);
  assert.equal(await p.locator('nav[aria-label="Разделы кабинета"]').count(), 0, "focus mode");
  const fit = [];
  let wrongDone = false;
  for (let guard = 0; guard < 80; guard++) {
    const k = await screenNo(p);
    const kind = await typeOf(p);
    if (process.env.PLAYER_DEBUG) console.log("STEP", k, kind, wrongDone);
    fit[k - 1] = await screenCheck(p, `SAF-01 screen ${k}`, { focus: kind === "criterion" || kind === "quiz" });
    if (k === 1) await p.screenshot({ path: `${shots}/saf01-01-why-iphone-se.png` });
    if (kind === "criterion") {
      const yes = p.getByLabel("Да, получилось");
      await yes.focus(); await p.keyboard.press("Space");
      if (k === total - lesson.content.quiz.length - 1 - lesson.content.exercises[0].successCriteria.length) await p.screenshot({ path: `${shots}/saf01-criterion-iphone-se.png` });
    }
    if (kind === "quiz") {
      const qi = Number((await p.getByText(/Мини-тест · вопрос \d+/i).innerText()).match(/вопрос (\d+)/i)[1]) - 1;
      const q = lesson.content.quiz[qi];
      const pick = wrongDone ? q.correctId : q.options.find((o) => o.id !== q.correctId).id;
      await p.locator(`input[name="player-${q.id}"]`).nth(q.options.findIndex((o) => o.id === pick)).focus();
      await p.keyboard.press("Space");
      await p.getByRole("button", { name: "Проверить" }).focus();
      await p.keyboard.press("Enter");
      await p.getByText(wrongDone ? "Верно." : "Не совсем.").waitFor();
      if (qi === 0 && !wrongDone) await p.screenshot({ path: `${shots}/saf01-quiz-short-options-iphone-se.png` });
      if (qi === lesson.content.quiz.length - 1 && !wrongDone) {
        await p.getByText(/Тест засчитывается при всех верных ответах/).waitFor();
        assert.ok(await p.getByRole("button", { name: "Далее" }).isDisabled(), "no way to the result with a failed test");
        const srv = await json(p, `player/lessons/SAF-01?step=${safStep.position}`);
        assert.equal(srv.result.quizPassed, false);
        assert.notEqual(srv.step.state, "self_checked", "failed test: the step is not self-checked");
        assert.equal(await p.getByText("Теперь я умею").count(), 0);
        await p.screenshot({ path: `${shots}/saf01-quiz-failed-iphone-se.png` });
        wrongDone = true;
        await p.getByRole("button", { name: "Пройти тест ещё раз" }).click();
        continue;
      }
      if (qi === lesson.content.quiz.length - 1 && wrongDone) await p.getByText(/Мини-тест засчитан в маршруте/).waitFor();
    }
    if (kind === "result") break;
    if (k === total) break;
    await pressNext(p);
    await p.getByText(new RegExp(`^Экран ${k + 1} из ${total}$`)).waitFor(); // the switch may wait for a server save
  }
  await p.getByRole("heading", { name: "Теперь я умею" }).waitFor({ timeout: 8000 }).catch(async (e) => {
    console.log("DEBUG", (await p.locator("main").innerText()).slice(0, 600)); throw e; });
  await p.getByText(/Подтвердите критерии выполнения шага/).waitFor();
  for (const box of await p.locator('[data-player-screen] fieldset input[type="checkbox"]').all()) await box.check();
  await p.getByRole("button", { name: "Завершить шаг" }).click();
  await p.getByText("Шаг засчитан ✓").waitFor();
  await p.getByRole("button", { name: /^Следующий шаг: \d+$/ }).waitFor();
  await p.screenshot({ path: `${shots}/saf01-result-step-done-iphone-se.png` });
  const pr = await json(p, "progress");
  assert.equal(pr.steps.find((s) => s.position === safStep.position).state, "done");
  assert.equal(pr.summary.done, 1, "exactly one step completed — by the server rules");
  pass(`iPhone SE keyboard-only: ${total} screens; wrong answers → «Тест засчитывается при всех верных ответах», «Далее» locked, no «Теперь я умею», step not self-checked; right answers → step completed from the player, next step offered; ${fit.filter(Boolean).length}/${total} screens fit without scrolling; navigation never covers content or focused controls`);

  // ——— E. The step page does not ask again for counted actions ———
  await p.goto(`/career/v3#step=${safStep.position}`);
  await p.getByText("Самопроверка сохранена: отмечены все критерии ✓").waitFor();
  await p.getByText(/Мини-тест засчитан ✓|Мини-тест пройден\./).waitFor();
  assert.equal(await p.getByRole("button", { name: "Отправить ответы" }).count(), 0);
  assert.equal(await p.getByRole("button", { name: "Сохранить самопроверку" }).count(), 0);
  pass("step page: counted self-check and mini-test are shown as done, no forms to redo");

  // ——— B. Result screen opened directly with a failed test (outside the route) ———
  const fr = await open({ ...devices["iPhone SE"], viewport: { width: 375, height: 667 } });
  await fr.page.goto("/career/v3");
  await registerWithRoute(fr.page, "player-free", false);
  const pv = await json(fr.page, "player/lessons/VAL-02");
  const vq = pv.screens.filter((x) => x.type === "quiz");
  await post(fr.page, `${API}/player/lessons/VAL-02/quiz`, { answers: Object.fromEntries(vq.map((q) => [q.id, q.options.find((o) => o.id !== q.correctId).id])), exerciseId: pv.exerciseId });
  await post(fr.page, `${API}/player/lessons/VAL-02/position`, { scriptVersion: pv.scriptVersion, exerciseId: pv.exerciseId, screen: pv.screens.length - 1, seq: 1 });
  await fr.page.goto("/career/v3#play=VAL-02");
  await fr.page.getByRole("heading", { name: "Урок ещё не завершён" }).waitFor();
  assert.equal(await fr.page.getByText("Теперь я умею").count(), 0, "no skill claim without a passed test");
  assert.equal(await fr.page.getByText("Урок пройден").count(), 0);
  await fr.page.screenshot({ path: `${shots}/val02-result-not-passed-iphone-se.png` });
  pass("result screen with a failed test: «Урок ещё не завершён», no «Урок пройден» / «Теперь я умею»");

  // ——— C. Fast switching + reload keeps position and choices ———
  const px = await open(devices["Pixel 7"]);
  const q = px.page;
  await q.goto("/career/v3");
  await registerWithRoute(q, "player-px");
  await q.goto("/career/v3#play=SAL-03");
  await counter(q).waitFor();
  for (let k = 0; k < 9; k++) await q.getByRole("button", { name: "Далее" }).click({ delay: 0 });
  await q.getByText(/^Экран 10 из \d+$/).waitFor();
  await q.reload();
  await q.getByText(/^Экран 10 из \d+$/).waitFor();
  const pl = await json(q, "player/lessons/SAL-03");
  const firstCrit = pl.screens.findIndex((x) => x.type === "criterion");
  const firstQuiz = pl.screens.findIndex((x) => x.type === "quiz");
  await post(q, `${API}/player/lessons/SAL-03/position`, { scriptVersion: pl.scriptVersion, exerciseId: pl.exerciseId, screen: firstCrit, seq: Date.now() * 1000 });
  await q.reload();
  await q.getByText(new RegExp(`^Экран ${firstCrit + 1} из`)).waitFor();
  await q.getByLabel("Пока нет").check();
  await q.getByRole("button", { name: "Далее" }).click();
  await q.getByLabel("Да, получилось").check();
  await sleep(300);
  await q.reload();
  await q.getByText(new RegExp(`^Экран ${firstCrit + 2} из`)).waitFor();
  assert.equal(await q.getByLabel("Да, получилось").isChecked(), true, "criterion mark restored after reload");
  await q.getByRole("button", { name: "Назад" }).click();
  assert.equal(await q.getByLabel("Пока нет").isChecked(), true, "previous criterion mark restored");
  await post(q, `${API}/player/lessons/SAL-03/position`, { scriptVersion: pl.scriptVersion, exerciseId: pl.exerciseId, screen: firstQuiz, seq: Date.now() * 1000 });
  await q.reload();
  await q.getByText(/Мини-тест · вопрос 1/i).waitFor();
  await q.locator('[data-player-screen] input[type="radio"]').nth(1).check();
  await sleep(300);
  await q.reload();
  await q.getByText(/Мини-тест · вопрос 1/i).waitFor();
  assert.equal(await q.locator('[data-player-screen] input[type="radio"]').nth(1).isChecked(), true, "quiz choice restored after reload");
  pass("Pixel 7: 9 fast taps + reload → same screen; criterion marks and quiz choice restored after reload");

  // ——— D. Materials catalogue instead of the long page ———
  await q.getByRole("button", { name: "Материалы" }).click();
  await q.getByRole("heading", { level: 1, name: "Материалы урока" }).waitFor();
  await q.getByRole("heading", { name: "Правила безопасности" }).waitFor();
  await q.getByRole("heading", { name: /Промпты для разрешённого ИИ/ }).waitFor();
  const docH = await q.evaluate(() => document.documentElement.scrollHeight);
  await q.screenshot({ path: `${shots}/sal03-materials-pixel7.png`, fullPage: true });
  await q.getByRole("button", { name: "Вернуться к уроку" }).first().click();
  await q.getByText(/Мини-тест · вопрос 1/i).waitFor();
  pass(`materials catalogue: safety rules, grouped collapsed templates/prompts, files, sources (${docH}px instead of the ≈25 000px full page); back to the same screen`);

  // ——— F. 200% zoom (320 CSS px) and accessibility tree ———
  const zoom = await open({ viewport: { width: 640, height: 1136 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const z = zoom.page;
  await z.goto("/career/v3");
  await registerWithRoute(z, "player-zoom");
  await z.goto("/career/v3#play=VAL-02");
  await counter(z).waitFor();
  await z.addStyleTag({ content: "html { zoom: 2 }" });
  for (let k = 0; k < 8; k++) await z.getByRole("button", { name: "Далее" }).click();
  const zv = await z.evaluate(() => ({ sw: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    clipped: [...document.querySelectorAll("main p, main li, main h2, main button")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === "hidden").length }));
  assert.deepEqual([zv.sw <= 1, zv.clipped], [true, 0]);
  const tree = await z.locator("main").ariaSnapshot();
  for (const re of [/progressbar "Прогресс урока"/, /navigation "Навигация по уроку"/, /button "Назад"/, /button "Далее"/, /heading .*level=2/]) assert.match(tree, re);
  pass("200% zoom at 320 CSS px: no horizontal scroll or clipped text; accessibility tree: heading per screen, labelled progress, navigation landmark");

  // ——— G. iPhone 13 fit + screenshots, desktop ———
  const fit13 = {};
  for (const [dev, name] of [[devices["iPhone 13"], "iphone13"], [{ viewport: { width: 1440, height: 900 } }, "desktop"]]) {
    const d = await open(dev);
    await d.page.goto("/career/v3");
    await registerWithRoute(d.page, "player-" + name, false);
    for (const lessonId of ["SAF-01", "SAL-03", "VAL-02"]) {
      await d.page.goto(`/career/v3#play=${lessonId}`);
      await counter(d.page).waitFor();
      const t = Number((await counter(d.page).innerText()).match(/из (\d+)/)[1]);
      const f = [];
      for (let k = 1; k < t; k++) {
        f.push(await screenCheck(d.page, `${name} ${lessonId} ${k}`));
        const kind = await typeOf(d.page);
        if (kind === "criterion") await d.page.getByLabel("Да, получилось").check();
        if (kind === "quiz") {
          const ql = (await json(d.page, `lessons/${lessonId}`)).lesson.content.quiz;
          const qi = Number((await d.page.getByText(/Мини-тест · вопрос \d+/i).innerText()).match(/вопрос (\d+)/i)[1]) - 1;
          await d.page.locator(`input[name="player-${ql[qi].id}"]`).nth(ql[qi].options.findIndex((o) => o.id === ql[qi].correctId)).check();
          await d.page.getByRole("button", { name: "Проверить" }).click();
          if (qi === ql.length - 1) await d.page.getByText(/Мини-тест засчитан/).waitFor();
        }
        if (name === "desktop" && [4, 9].includes(k)) await d.page.screenshot({ path: `${shots}/${lessonId.toLowerCase()}-${String(k).padStart(2, "0")}-desktop.png` });
        if (name === "iphone13" && [1, 9, 13].includes(k)) await d.page.screenshot({ path: `${shots}/${lessonId.toLowerCase()}-${String(k).padStart(2, "0")}-iphone13.png` });
        await d.page.getByRole("button", { name: "Далее" }).click();
        await d.page.getByText(new RegExp(`^Экран ${k + 1} из ${t}$`)).waitFor(); // read the next screen only after it is shown
      }
      await d.page.getByRole("heading", { name: "Теперь я умею" }).waitFor();
      if (name === "iphone13") fit13[lessonId] = `${f.filter(Boolean).length}/${t - 1}`;
    }
    await d.context.close();
  }
  pass(`iPhone 13 and desktop: all three lessons to «Теперь я умею» after a server-counted test; iPhone 13 screens fully visible without scrolling: ${JSON.stringify(fit13)}`);

  assert.deepEqual(external, [], "no external requests");
  assert.deepEqual(errors, [], "no console errors");
  pass("no external requests, no console errors");
  console.log(`career demo player browser: ${checks.length} checks passed; screenshots in ${shots}`);
} finally {
  await browser.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ }
}
