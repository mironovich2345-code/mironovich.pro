// AI Career 3.0 stage 1.5 — browser checks of the production topology on loopback (public site → proxy → learning app,
// empty commercial database), iPhone (WebKit where installed: STAGE1_WEBKIT=1) and desktop Chrome, with screenshots.
// Uses the builds made by tests/career-commercial-integration.mjs (.next-app, .next-site).
//   CAREER_COMMERCIAL_PG=postgresql://user:pass@127.0.0.1:5432 COMMERCIAL_SHOTS=/tmp/commercial-shots node --experimental-strip-types tests/career-commercial-browser.mjs
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require("playwright");
const SITE_PORT = 3520, APP_PORT = 3521; // same as the integration build (NEXT_PUBLIC_SITE_URL is baked into it)
const SITE = `http://127.0.0.1:${SITE_PORT}`, APP = `http://127.0.0.1:${APP_PORT}`;
const DB = "mironovich_career_staging";
const PG = (process.env.CAREER_COMMERCIAL_PG ?? "").replace(/\/+$/, "");
assert.ok(/^postgres(ql)?:\/\/[^/]+@?(127\.0\.0\.1|localhost)(:\d+)?$/.test(PG), "CAREER_COMMERCIAL_PG must point to a LOCAL PostgreSQL server");
assert.ok(existsSync(".next-app") && existsSync(".next-site"), "run tests/career-commercial-integration.mjs first (it builds .next-app and .next-site)");
const SHOTS = process.env.COMMERCIAL_SHOTS ?? "/tmp/commercial-shots";
mkdirSync(SHOTS, { recursive: true });
const secret = (n) => randomBytes(n).toString("base64url").slice(0, n);
const PROXY = secret(40), ADMIN = "admin-c@example.com";
const base = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
// Same build-time values as the integration build (origin baked into the app build), new runtime secrets.
const appEnv = {
  ...base, CAREER_V3_DEMO: "1", CAREER_V3_DEMO_LOCAL: "1", CAREER_V3_DEMO_PROFILE: "commercial-staging",
  CAREER_V3_DEMO_ORIGIN: SITE, NEXT_PUBLIC_SITE_URL: SITE, CAREER_V3_DEMO_DATABASE_URL: `${PG}/${DB}`,
  CAREER_V3_DEMO_SESSION_SECRET: secret(64), CAREER_V3_OTP_SECRET: secret(48), CAREER_PROXY_SECRET: PROXY,
  CAREER_V3_MAIL: "preview-outbox", CAREER_V3_PREVIEW_OUTBOX_KEY: secret(32),
  CAREER_V3_ROBOKASSA: "emulator", CAREER_V3_ROBOKASSA_TEST_PASSWORD1: secret(20), CAREER_V3_ROBOKASSA_TEST_PASSWORD2: secret(20), CAREER_V3_ROBOKASSA_HASH: "md5",
  CAREER_V3_ADMIN_EMAILS: ADMIN,
};
const siteEnv = { ...base, NEXT_PUBLIC_SITE_URL: SITE, SITE_NOINDEX: "1", CAREER_APP_UPSTREAM: APP, CAREER_PROXY_SECRET: PROXY };

const root = new pg.Client({ connectionString: `${PG}/postgres` });
await root.connect();
await root.query(`DROP DATABASE IF EXISTS ${DB}`);
await root.query(`CREATE DATABASE ${DB}`);
await root.end();
execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/career/demo-admin.mjs", "migrate"], { env: appEnv, stdio: "ignore" });
const db = new pg.Pool({ connectionString: appEnv.CAREER_V3_DEMO_DATABASE_URL, max: 3 });
const procs = [];
async function start(env, port, dir) {
  const p = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(port)], { env: { ...env, NEXT_DIST_DIR: dir }, stdio: "ignore", detached: true });
  procs.push(p);
  for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${port}/healthz`); return; } catch { await sleep(500); } }
  throw new Error("server did not start on " + port);
}
await start(appEnv, APP_PORT, ".next-app");
await start(siteEnv, SITE_PORT, ".next-site");

const chrome = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" });
const safari = process.env.STAGE1_WEBKIT === "1" ? await webkit.launch({ headless: true }) : null;
const SAFARI = safari ? "iPhone Safari (WebKit)" : "iPhone profile (Chromium; WebKit not installed here)";
console.log("mobile engine: " + SAFARI);
let failures = 0, passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log("PASS " + name); } catch (e) { failures++; console.log("FAIL " + name + "\n  " + String(e.stack ?? e).split("\n").slice(0, 5).join("\n  ")); }
}
// Full-page shots, except pages taller than WebKit's 32 767 px screenshot limit (the long public home page at DPR 3).
const shot = async (p, name) => {
  const tall = await p.evaluate(() => document.documentElement.scrollHeight * devicePixelRatio > 30000);
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: !tall });
};
const code = async (email) => /Код для входа: (\d{6})/.exec((await db.query("SELECT body FROM career_mail_preview WHERE to_email=$1 ORDER BY created_at DESC LIMIT 1", [email])).rows[0]?.body ?? "")?.[1];
const watch = (p) => { const bad = []; p.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/api/career/demo/session")) bad.push(`${r.status()} ${new URL(r.url()).pathname}`); }); p.on("pageerror", (e) => bad.push("pageerror " + e.message)); return bad; };
async function signIn(p, email, prefix) {
  await p.goto(SITE + "/");
  const link = p.getByRole("link", { name: "Войти в обучение AI Career 3.0" }).first();
  if (!(await link.isVisible())) await p.getByRole("button", { name: /меню/i }).first().click(); // phones: the entry is in the menu
  await p.getByRole("link", { name: "Войти в обучение AI Career 3.0" }).filter({ visible: true }).first().click();
  await p.waitForURL(/\/career\?login=1$/);
  await p.getByLabel("Email").fill(email);
  if (prefix) await shot(p, prefix + "-1-email");
  await p.getByRole("button", { name: "Получить код" }).click();
  await p.getByLabel("Шестизначный код").waitFor();
  if (prefix) await shot(p, prefix + "-2-code");
  await p.getByLabel("Шестизначный код").fill(await code(email));
  await p.getByRole("button", { name: "Войти" }).click();
  await p.getByLabel("Шестизначный код").waitFor({ state: "detached" });
}

await check(`${SAFARI}: «Войти» on the main site → /career on the same domain → code → new account → purchase screen (payment not connected for real money)`, async () => {
  const ctx = await (safari ?? chrome).newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage(); const bad = watch(p);
  await p.goto(SITE + "/"); await shot(p, "iphone-site-home");
  // the sign-in entry lives in the mobile menu on phones
  await p.getByRole("button", { name: /меню/i }).first().click();
  await p.getByRole("link", { name: "Войти в обучение AI Career 3.0" }).click();
  await p.waitForURL(/\/career\?login=1$/);
  const email = "user-iphone@example.com";
  await p.getByLabel("Email").fill(email);
  await shot(p, "iphone-career-login");
  await p.getByRole("button", { name: "Получить код" }).click();
  await p.getByLabel("Шестизначный код").waitFor();
  await p.getByLabel("Шестизначный код").fill(await code(email));
  await shot(p, "iphone-career-code");
  await p.getByRole("button", { name: "Войти" }).click();
  await p.getByTestId("shop-price").waitFor();
  assert.equal(new URL(p.url()).host, new URL(SITE).host, "still on the site's domain");
  await shot(p, "iphone-career-purchase");
  await p.reload(); await p.getByTestId("shop-price").waitFor();
  assert.deepEqual(bad, [], "no failed requests or page errors");
  await ctx.close();
});

await check("desktop: admin signs in through the site, opens /admin, switches price to 3 990 ₽ and back", async () => {
  const ctx = await chrome.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const bad = watch(p);
  await signIn(p, ADMIN, "desktop-admin-login");
  await p.getByRole("link", { name: "Админ-кабинет" }).click();
  await p.waitForURL(/\/admin$/);
  await shot(p, "desktop-admin-overview");
  for (const t of ["users", "sales", "learning"]) { await p.goto(`${SITE}/admin/${t}`); await shot(p, `desktop-admin-${t}`); }
  await p.goto(SITE + "/admin/prices");
  await p.getByRole("radio", { name: /MANUAL — 3 990 ₽/ }).check();
  await p.getByLabel("Причина изменения").fill("staging: проверка цены");
  await p.getByLabel("Подтверждаю изменение цены").check();
  await p.getByRole("button", { name: "Применить" }).click();
  await p.getByRole("status").filter({ hasText: "3 990" }).waitFor();
  await p.reload(); await shot(p, "desktop-admin-prices");
  await p.getByRole("radio", { name: /AUTO/ }).check();
  await p.getByLabel("Причина изменения").fill("staging: возврат в AUTO");
  await p.getByLabel("Подтверждаю изменение цены").check();
  await p.getByRole("button", { name: "Применить" }).click();
  await p.getByRole("status").filter({ hasText: "AUTO" }).waitFor();
  await p.goto(SITE + "/"); await shot(p, "desktop-site-home-signed-in");
  assert.deepEqual(bad, []);
  await ctx.close();
});

await check(`${SAFARI}: admin cabinet on iPhone through the site (tabs wrap, no sideways scroll)`, async () => {
  const ctx = await (safari ?? chrome).newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  await db.query("UPDATE career_login_challenges SET resend_available_at=now()-interval '1 second' WHERE email=$1", [ADMIN]);
  await signIn(p, ADMIN);
  for (const t of ["", "/prices"]) {
    await p.goto(SITE + "/admin" + t);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false);
    await shot(p, "iphone-admin" + (t ? t.replace("/", "-") : "-overview"));
  }
  await ctx.close();
});

await check("regular user on /admin: ordinary 404; product page on the site shows the app's price", async () => {
  const ctx = await chrome.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const r = await p.goto(SITE + "/admin");
  assert.equal(r.status(), 404);
  await p.goto(SITE + "/products/ai-career");
  await p.getByText(/Купить за (1 993|3 990) ₽/).waitFor();
  await shot(p, "desktop-product-page");
  await ctx.close();
});

await chrome.close(); await safari?.close();
for (const p of procs) { try { process.kill(-p.pid, "SIGTERM"); } catch { /* gone */ } }
await db.end();
console.log(`career commercial browser: ${passed} passed, ${failures} failed; screenshots in ${SHOTS}`);
if (failures) process.exit(1);
