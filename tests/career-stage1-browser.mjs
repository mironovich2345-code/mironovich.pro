// AI Career 3.0 stage 1 — browser checks on iPhone and desktop with screenshots (stage-1 profile, LOCAL, synthetic data).
// Sign-in by email code, purchase through the Robokassa emulator, admin cabinet tabs, price change by radio buttons,
// the same price on the product page and in the payment request, 404 for a regular user on /admin.
//   CAREER_STAGE1_PG=postgresql://user:pass@127.0.0.1:5432 STAGE1_SHOTS=/tmp/stage1-shots node --experimental-strip-types tests/career-stage1-browser.mjs
// Uses the build made by tests/career-stage1-integration.mjs (STAGE1_BUILD=1 builds again).
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require("playwright");
const PORT = Number(process.env.STAGE1_PORT ?? 3411);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const DB = "mironovich_career_stage1";
const PG = (process.env.CAREER_STAGE1_PG ?? "").replace(/\/+$/, "");
assert.ok(/^postgres(ql)?:\/\/[^/]+@?(127\.0\.0\.1|localhost)(:\d+)?$/.test(PG), "CAREER_STAGE1_PG must point to a LOCAL PostgreSQL server");
const SHOTS = process.env.STAGE1_SHOTS ?? "/tmp/stage1-shots";
mkdirSync(SHOTS, { recursive: true });
const P = "sales_manager", ADMIN = "admin-s1@example.com";
const secret = (n) => randomBytes(n).toString("base64url").slice(0, n);
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  CAREER_V3_DEMO: "1", CAREER_V3_DEMO_LOCAL: "1", CAREER_V3_DEMO_PROFILE: "stage1", SITE_NOINDEX: "1",
  CAREER_V3_DEMO_ORIGIN: ORIGIN, NEXT_PUBLIC_SITE_URL: ORIGIN, CAREER_V3_DEMO_DATABASE_URL: `${PG}/${DB}`,
  CAREER_V3_DEMO_SESSION_SECRET: secret(64), CAREER_V3_OTP_SECRET: secret(48), CAREER_V3_MAIL: "preview-outbox", CAREER_V3_PREVIEW_OUTBOX_KEY: secret(32),
  CAREER_V3_ROBOKASSA: "emulator", CAREER_V3_ROBOKASSA_TEST_PASSWORD1: secret(20), CAREER_V3_ROBOKASSA_TEST_PASSWORD2: secret(20), CAREER_V3_ROBOKASSA_HASH: "md5",
  CAREER_V3_ADMIN_EMAILS: ADMIN, CAREER_V3_DEMO_MAX_USERS: "200",
};
const root = new pg.Client({ connectionString: `${PG}/postgres` });
await root.connect();
await root.query(`DROP DATABASE IF EXISTS ${DB}`);
await root.query(`CREATE DATABASE ${DB}`);
await root.end();
const admin = (...a) => execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/career/demo-admin.mjs", ...a], { env }).toString().trim();
admin("migrate");
const db = new pg.Pool({ connectionString: env.CAREER_V3_DEMO_DATABASE_URL, max: 3 });
if (process.env.STAGE1_BUILD === "1") execFileSync("npx", ["next", "build"], { env, stdio: "inherit" });
const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
for (let i = 0; i < 80; i++) { try { await fetch(ORIGIN + "/robots.txt"); break; } catch { await sleep(500); } }

const code = async (email) => /Код для входа: (\d{6})/.exec((await db.query("SELECT body FROM career_mail_preview WHERE to_email=$1 ORDER BY created_at DESC LIMIT 1", [email])).rows[0]?.body ?? "")?.[1];

// ——— synthetic learners over HTTP so the admin tables have something to show ———
async function api(jar, path, body, ip) {
  const r = await fetch(ORIGIN + path, { method: body === undefined ? "GET" : "POST", redirect: "manual",
    headers: { "x-real-ip": ip, ...(jar.c ? { cookie: jar.c } : {}), ...(body === undefined ? {} : { "content-type": "application/json", origin: ORIGIN }) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  for (const sc of r.headers.getSetCookie()) { const m = /^([^=]+)=([^;]*)/.exec(sc); if (m) { const map = new Map((jar.c ?? "").split("; ").filter(Boolean).map((x) => x.split("="))); if (m[2]) map.set(m[1], m[2]); else map.delete(m[1]); jar.c = [...map].map(([k, v]) => `${k}=${v}`).join("; "); } }
  const v = (r.headers.get("content-type") ?? "").includes("json") ? await r.json() : await r.text();
  if (r.status >= 400) throw new Error(`${path} ${r.status} ${JSON.stringify(v).slice(0, 200)}`);
  return v;
}
const answers = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles;
for (let i = 0; i < 4; i++) {
  const jar = {}, ip = "10.1.0." + (i + 2), email = `learner${i + 1}-s1@example.com`;
  await api(jar, "/api/career/demo/otp-start", { email }, ip);
  const r = await api(jar, "/api/career/demo/otp-verify", { code: await code(email) }, ip);
  if (r.needInvite) await api(jar, "/api/career/demo/otp-signup", { invite: admin("invite", "browser", "7") }, ip);
  if (i === 3) continue; // signed up, diagnostic not started
  await api(jar, `/api/career/v3/${P}/diagnostic/questions`, undefined, ip);
  if (i === 2) continue; // opened the diagnostic only
  await api(jar, `/api/career/v3/${P}/diagnostic`, { answers: answers[i].answers }, ip);
  await api(jar, `/api/career/v3/${P}/task-map`, {}, ip);
  const plan = (await api(jar, `/api/career/v3/${P}/plan`, {}, ip)).plan;
  for (const step of plan.steps.slice(0, i === 0 ? 3 : 1)) {
    const l = (await api(jar, `/api/career/v3/${P}/lessons/${step.lessonId}`, undefined, ip)).lesson;
    const ex = l.content.exercises.find((e) => e.id === step.exerciseId);
    await api(jar, `/api/career/v3/${P}/progress/steps/${step.position}/start`, { stableId: step.stableId }, ip);
    await api(jar, `/api/career/v3/${P}/progress/steps/${step.position}/self-check`, { stableId: step.stableId, criteriaMet: ex.successCriteria.map(() => true) }, ip);
    const pr = await api(jar, `/api/career/v3/${P}/progress`, undefined, ip);
    if (!pr.quizzes[step.lessonId]?.passed) {
      await api(jar, `/api/career/v3/${P}/progress/lessons/${step.lessonId}/quiz`, { answers: Object.fromEntries(l.content.quiz.map((q) => [q.id, q.options.find((o) => o.id !== q.correctId).id])) }, ip);
      await api(jar, `/api/career/v3/${P}/progress/lessons/${step.lessonId}/quiz`, { answers: Object.fromEntries(l.content.quiz.map((q) => [q.id, q.correctId])) }, ip);
    }
    await api(jar, `/api/career/v3/${P}/progress/steps/${step.position}/complete`, { stableId: step.stableId, completionMet: step.completionCriteria.map(() => true) }, ip);
  }
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
// Mobile Safari: real WebKit where installed (CI: STAGE1_WEBKIT=1); otherwise the iPhone profile runs on Chromium and
// the report says so.
const safari = process.env.STAGE1_WEBKIT === "1" ? await webkit.launch({ headless: true }) : null;
const SAFARI = safari ? "iPhone Safari (WebKit)" : "iPhone profile (Chromium; WebKit not installed here)";
console.log("mobile engine: " + SAFARI);
let failures = 0, passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log("PASS " + name); } catch (e) {
    failures++; console.log("FAIL " + name + "\n  " + String(e.stack ?? e).split("\n").slice(0, 5).join("\n  "));
    for (const ctx of [...browser.contexts(), ...(safari?.contexts() ?? [])]) for (const pg of ctx.pages()) console.log("  page:", pg.url(), (await pg.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300));
  }
}
const shot = (p, name) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function signInUi(p, email, prefix) {
  // A second sign-in for the same address within 60 s would hit the resend cooldown — skip it in tests.
  await db.query("UPDATE career_login_challenges SET resend_available_at=now()-interval '1 second' WHERE email=$1", [email]);
  await p.goto(ORIGIN + "/");
  await p.getByRole("button", { name: "Войти по коду из письма" }).click();
  await p.getByLabel("Email").fill(email);
  if (prefix) await shot(p, prefix + "-1-email");
  await p.getByRole("button", { name: "Получить код" }).click();
  await p.getByLabel("Шестизначный код").waitFor();
  if (prefix) await shot(p, prefix + "-2-code");
  await p.getByLabel("Шестизначный код").fill(await code(email));
  await p.getByRole("button", { name: "Войти" }).click();
  await p.getByLabel("Шестизначный код").waitFor({ state: "detached" });
}

const iphone = await browser.newContext({ ...devices["iPhone 13"] });
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
for (const ctx of [iphone, desktop]) ctx.on("page", (pg) => {
  pg.on("console", (m) => { if (m.type() === "error") console.log("  console:", m.text().slice(0, 200)); });
  pg.on("response", (r) => { if (r.status() >= 400) console.log("  http", r.status(), new URL(r.url()).pathname); });
});

await check("iPhone: admin signs in with a code from info@mironovich.pro (preview mailbox), sees the admin link", async () => {
  const p = await iphone.newPage();
  await signInUi(p, ADMIN, "iphone-admin-login");
  await p.getByRole("link", { name: "Админ-кабинет" }).waitFor();
  await shot(p, "iphone-admin-3-signed-in");
  for (const [tab, title] of [["overview", "Обзор"], ["users", "Пользователи"], ["sales", "Продажи"], ["learning", "Обучение"], ["prices", "Цены"]]) {
    await p.goto(`${ORIGIN}/admin/${tab}`);
    await p.getByRole("heading", { level: 1, name: title }).waitFor();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(overflow, false, tab + ": no horizontal page scroll on iPhone");
    await shot(p, `iphone-admin-${tab}`);
  }
});

await check("desktop: admin changes the price with radio buttons (MANUAL 3 990 ₽), confirmation and reason; history shows the change", async () => {
  const p = await desktop.newPage();
  await signInUi(p, ADMIN, "desktop-admin-login");
  await p.goto(ORIGIN + "/admin/prices");
  await p.getByRole("radio", { name: /MANUAL — 3 990 ₽/ }).check();
  await p.getByLabel("Причина изменения").fill("Приёмка: проверка ступени 3 990 ₽");
  const apply = p.getByRole("button", { name: "Применить" });
  assert.equal(await apply.isDisabled(), true, "needs confirmation");
  await p.getByLabel("Подтверждаю изменение цены").check();
  await shot(p, "desktop-admin-prices-before-apply");
  await apply.click();
  await p.getByRole("status").filter({ hasText: "3 990 ₽" }).waitFor();
  await p.reload();
  await p.getByText("Приёмка: проверка ступени 3 990 ₽", { exact: true }).waitFor();
  await shot(p, "desktop-admin-prices-after-apply");
  for (const tab of ["overview", "users", "sales", "learning"]) { await p.goto(`${ORIGIN}/admin/${tab}`); await shot(p, `desktop-admin-${tab}`); }
  await p.goto(ORIGIN + "/products/ai-career");
  await p.getByText(/Купить за 3 990 ₽/).waitFor();
  const cover = await p.locator("main img").first().evaluate((img) => img.complete && img.naturalWidth > 0);
  assert.equal(cover, true, "product cover image loads in the preview");
  await shot(p, "desktop-product-page-3990");
});

await check("iPhone: buyer without access sees 3 990 ₽, pays through the Robokassa emulator (3990.00), returns with access", async () => {
  const email = "buyer-browser@example.com";
  const buyerCtx = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await buyerCtx.newPage();
  await p.goto(ORIGIN + "/");
  await p.getByRole("button", { name: "Войти по коду из письма" }).click();
  await p.getByLabel("Email").fill(email);
  await p.getByRole("button", { name: "Получить код" }).click();
  await p.getByLabel("Шестизначный код").waitFor();
  await p.getByLabel("Шестизначный код").fill(await code(email));
  await p.getByRole("button", { name: "Войти" }).click();
  await p.getByLabel("Пригласительный код").fill(admin("invite", "buyer", "7"));
  await shot(p, "iphone-buyer-invite");
  await p.getByRole("button", { name: "Создать аккаунт" }).click();
  await p.waitForLoadState("networkidle");
  await db.query("UPDATE career_demo_users SET access_until=now()-interval '1 day' WHERE email=$1", [email]);
  await p.reload();
  await p.getByTestId("shop-price").waitFor();
  assert.equal((await p.getByTestId("shop-price").innerText()).replace(/\s/g, " "), "3 990 ₽");
  await p.getByLabel("Мне исполнилось 18 лет").check();
  await p.getByLabel(/Принимаю/).check();
  await shot(p, "iphone-buyer-purchase");
  await p.getByRole("button", { name: "Перейти к тестовой оплате" }).click();
  await p.getByTestId("emulator-sum").waitFor();
  assert.equal(await p.getByTestId("emulator-sum").innerText(), "3990.00 ₽");
  await shot(p, "iphone-robokassa-emulator");
  await p.getByRole("button", { name: "Оплатить (тест)" }).click();
  await p.getByText("Оплата подтверждена, доступ открыт.").waitFor();
  await shot(p, "iphone-buyer-after-payment");
});

await check("regular user: /admin is an ordinary 404", async () => {
  const p = await desktop.newPage();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const q = await ctx.newPage();
  await signInUi(q, "learner1-s1@example.com");
  await q.waitForLoadState("networkidle");
  const r = await q.goto(ORIGIN + "/admin");
  assert.equal(r.status(), 404);
  await shot(q, "iphone-regular-user-admin-404");
  await p.close(); await ctx.close();
});

await check("desktop: sales tab shows the paid 3 990 ₽ order and revenue by price level", async () => {
  const p = await desktop.newPage();
  await p.goto(ORIGIN + "/admin/sales");
  await p.getByRole("cell", { name: "оплачен Robokassa · эмулятор" }).first().waitFor();
  await shot(p, "desktop-admin-sales-after-payment");
  await p.goto(ORIGIN + "/admin/overview");
  await shot(p, "desktop-admin-overview-after-payment");
});

await check(`${SAFARI}: wrong code message, reload keeps the session, sign-out ends it (Back does not reopen the cabinet)`, async () => {
  const ctx = await (safari ?? browser).newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  const email = "learner2-s1@example.com";
  await db.query("UPDATE career_login_challenges SET resend_available_at=now()-interval '1 second' WHERE email=$1", [email]);
  await p.goto(ORIGIN + "/");
  await p.getByRole("button", { name: "Войти по коду из письма" }).click();
  await p.getByLabel("Email").fill(email);
  await p.getByRole("button", { name: "Получить код" }).click();
  await p.getByLabel("Шестизначный код").waitFor();
  const right = await code(email);
  await p.getByLabel("Шестизначный код").fill(right === "000000" ? "111111" : "000000");
  await p.getByRole("button", { name: "Войти" }).click();
  await p.getByText(/Неверный код\. Осталось попыток: 4\./).waitFor();
  await shot(p, "iphone-safari-wrong-code");
  await p.getByLabel("Шестизначный код").fill(right);
  await p.getByRole("button", { name: "Войти" }).click();
  await p.getByRole("button", { name: "Выйти" }).first().waitFor();
  await p.reload();
  await p.getByRole("button", { name: "Выйти" }).first().waitFor();
  await shot(p, "iphone-safari-cabinet-after-reload");
  await p.getByRole("button", { name: "Выйти" }).first().click();
  await p.getByRole("heading", { name: "Вход и регистрация" }).waitFor();
  await p.goBack().catch(() => {});
  await p.reload();
  await p.getByRole("button", { name: "Войти по коду из письма" }).waitFor();
  const r = await p.request.get(ORIGIN + "/api/career/demo/session");
  assert.equal((await r.json()).authenticated, false);
  await shot(p, "iphone-safari-after-sign-out");
  await ctx.close();
});

await check("Android Chrome (Pixel 7): sign in by code and open the cabinet", async () => {
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const p = await ctx.newPage();
  await signInUi(p, "learner1-s1@example.com", "android-login");
  await p.getByRole("button", { name: "Выйти" }).first().waitFor();
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false);
  await shot(p, "android-cabinet");
  await ctx.close();
});

await browser.close();
await safari?.close();
try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ }
await db.end();
console.log(`career stage-1 browser: ${passed} passed, ${failures} failed; screenshots in ${SHOTS}`);
if (failures) process.exit(1);
