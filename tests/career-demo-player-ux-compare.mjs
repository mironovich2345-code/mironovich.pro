// Before/after comparison of the lesson player (v1 = demo commit 98cb6e3, v2 = this branch) on the same task:
// finish route step «SAF-01» on iPhone SE (375×667): wrong mini-test answers first, then the right ones.
// Counts taps, screen changes, page changes, scroll distance, forced returns and whether the UI claimed success
// with a failed test. Mechanical counts from an automated walk-through — NOT human time or errors.
// Usage: V1_URL=http://127.0.0.1:3401 V2_URL=http://127.0.0.1:3400 node tests/career-demo-player-ux-compare.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const admin = () => execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/career/demo-admin.mjs", "invite", "ux"]).toString().trim();
const answers = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles[0].answers;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });

async function run(variant, origin) {
  const ctx = await browser.newContext({ ...devices["iPhone SE"], viewport: { width: 375, height: 667 }, baseURL: origin });
  const p = await ctx.newPage();
  const API = `${origin}/api/career/v3/sales_manager`;
  const post = (u, d) => p.request.post(u, { data: d, headers: { Origin: origin } });
  await p.goto("/career/v3");
  const pw = "Ux-compare-" + Math.random().toString(36).slice(2, 8);
  assert.equal((await post(`${origin}/api/career/demo/register`, { email: `ux-${variant}-${Date.now()}@example.com`, password: pw, passwordConfirm: pw, invite: admin() })).status(), 201);
  await post(`${API}/diagnostic`, { answers }); await post(`${API}/task-map`, {}); await post(`${API}/plan`, {});
  const plan = (await (await p.request.get(`${API}/progress`)).json()).plan;
  const st = plan.steps.find((s) => s.lessonId === "SAF-01");
  const quiz = (await (await p.request.get(`${API}/lessons/SAF-01`)).json()).lesson.content.quiz;
  await p.addInitScript(() => { window.__scroll = 0; let y = 0; addEventListener("scroll", () => { window.__scroll += Math.abs(scrollY - y); y = scrollY; }, { passive: true }); });
  const m = { taps: 0, screens: 0, pages: 1, scrollPx: 0, forcedReturns: 0, claimedSuccessWithFailedTest: false, stepDone: false };
  const tap = async (loc) => { await loc.click(); m.taps++; await p.waitForTimeout(60); };
  const scrolled = async () => { m.scrollPx += await p.evaluate(() => window.__scroll || 0); };
  const next = async () => { await tap(p.getByRole("button", { name: "Далее" })); m.screens++; };
  const pickQuiz = async (right) => {
    const qi = Number((await p.getByText(/Мини-тест · вопрос \d+/i).innerText()).match(/вопрос (\d+)/i)[1]) - 1;
    const q = quiz[qi];
    const id = right ? q.correctId : q.options.find((o) => o.id !== q.correctId).id;
    const radio = p.locator(`[data-player-screen] input[type="radio"]`).nth(q.options.findIndex((o) => o.id === id));
    await radio.scrollIntoViewIfNeeded(); await radio.check(); m.taps++;
    await tap(p.getByRole("button", { name: "Проверить" }));
    return qi;
  };
  await p.goto(`/career/v3?ux#step=${st.position}`);
  await tap(p.getByRole("button", { name: "Пройти урок короткими экранами" }));
  await p.getByText(/^Экран 1 из/).waitFor();
  for (let guard = 0; guard < 80; guard++) {
    const head = (await p.locator("[data-player-screen] p").first().textContent()) ?? "";
    if (/Самопроверка · критерий/i.test(head)) { await p.getByLabel("Да, получилось").check(); m.taps++; await next(); continue; }
    if (/Разбор результата/i.test(head) && variant === "v1") { // v1: one long checklist + save button
      for (const box of await p.locator('[data-player-screen] fieldset input[type="checkbox"]').all()) { await box.scrollIntoViewIfNeeded(); await box.check(); m.taps++; }
      const save = p.getByRole("button", { name: /Сохранить в шаг/ });
      await save.scrollIntoViewIfNeeded(); await tap(save);
      await next(); continue;
    }
    if (/Мини-тест · вопрос/i.test(head)) {
      const qi = await pickQuiz(false);
      if (qi === quiz.length - 1) break;
      await next(); continue;
    }
    await next();
  }
  // After the failed test: can the learner reach a «done» screen that claims the skill?
  await p.waitForTimeout(400);
  const nextBtn = p.getByRole("button", { name: "Далее" });
  if (await nextBtn.isEnabled()) {
    await next();
    m.claimedSuccessWithFailedTest = (await p.getByRole("heading", { name: "Теперь я умею" }).count()) > 0;
    await tap(p.getByRole("button", { name: "Назад" })); m.screens++; m.forcedReturns++;
  }
  // Retry with the right answers.
  const retry = p.getByRole("button", { name: /Пройти тест ещё раз/ });
  await retry.scrollIntoViewIfNeeded(); await tap(retry); m.forcedReturns++;
  for (let k = 0; k < quiz.length; k++) {
    const qi = await pickQuiz(true);
    if (qi < quiz.length - 1) await next();
  }
  await p.waitForTimeout(400);
  await next(); // to the result / done screen
  await p.getByRole("heading", { name: "Теперь я умею" }).waitFor();
  if (variant === "v1") { // v1: back to the step page to confirm completion
    await tap(p.getByRole("button", { name: /Вернуться к шагу/ })); m.pages++; m.forcedReturns++;
    await p.locator("#complete-h").scrollIntoViewIfNeeded();
  }
  for (const box of await p.locator(variant === "v1" ? "#complete-h ~ div fieldset input[type=checkbox], #complete-h + div fieldset input[type=checkbox]" : '[data-player-screen] fieldset input[type="checkbox"]').all()) { await box.scrollIntoViewIfNeeded(); await box.check(); m.taps++; }
  const done = p.getByRole("button", { name: "Завершить шаг" });
  await done.scrollIntoViewIfNeeded(); await tap(done);
  await p.waitForTimeout(600);
  await scrolled();
  m.stepDone = (await (await p.request.get(`${API}/progress`)).json()).steps.find((s) => s.position === st.position).state === "done";
  await ctx.close();
  return m;
}

const out = {};
if (process.env.V1_URL) out.v1 = await run("v1", process.env.V1_URL);
out.v2 = await run("v2", process.env.V2_URL || "http://127.0.0.1:3400");
await browser.close();
console.table(out);
writeFileSync(process.env.UX_OUT || "/tmp/player-ux-compare.json", JSON.stringify(out, null, 2));
assert.equal(out.v2.claimedSuccessWithFailedTest, false, "v2 never claims success with a failed test");
assert.equal(out.v2.stepDone, true);
console.log("player ux compare: done");
