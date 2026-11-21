// AI Career 3.0 stage 1.5 — the production topology on loopback: the PUBLIC SITE (no contour variables) proxies
// /career, /admin, /api/career/* and /career-app/_next/* to the separate LEARNING APP (profile commercial-staging, no
// public address) with an empty commercial PostgreSQL database mironovich_career_staging. Fictional data only; payments
// only through the Robokassa emulator.
//   CAREER_COMMERCIAL_PG=postgresql://user:pass@127.0.0.1:5432 node --experimental-strip-types tests/career-commercial-integration.mjs
// Builds both (app into .next-app, site into .next-site) unless COMMERCIAL_SKIP_BUILD=1.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";

const SITE_PORT = 3520, APP_PORT = 3521;
const SITE = `http://127.0.0.1:${SITE_PORT}`, APP = `http://127.0.0.1:${APP_PORT}`;
const DB = "mironovich_career_staging";
const PG = (process.env.CAREER_COMMERCIAL_PG ?? "").replace(/\/+$/, "");
assert.ok(/^postgres(ql)?:\/\/[^/]+@?(127\.0\.0\.1|localhost)(:\d+)?$/.test(PG), "CAREER_COMMERCIAL_PG must point to a LOCAL PostgreSQL server");
const secret = (n) => randomBytes(n).toString("base64url").slice(0, n);
const PROXY = secret(40), ADMIN = "admin-c@example.com";
const base = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
const appEnv = {
  ...base, CAREER_V3_DEMO: "1", CAREER_V3_DEMO_LOCAL: "1", CAREER_V3_DEMO_PROFILE: "commercial-staging",
  CAREER_V3_DEMO_ORIGIN: SITE, NEXT_PUBLIC_SITE_URL: SITE, CAREER_V3_DEMO_DATABASE_URL: `${PG}/${DB}`,
  CAREER_V3_DEMO_SESSION_SECRET: secret(64), CAREER_V3_OTP_SECRET: secret(48), CAREER_PROXY_SECRET: PROXY,
  CAREER_V3_MAIL: "preview-outbox", CAREER_V3_PREVIEW_OUTBOX_KEY: secret(32),
  CAREER_V3_ROBOKASSA: "emulator", CAREER_V3_ROBOKASSA_TEST_PASSWORD1: secret(20), CAREER_V3_ROBOKASSA_TEST_PASSWORD2: secret(20), CAREER_V3_ROBOKASSA_HASH: "md5",
  CAREER_V3_ADMIN_EMAILS: ADMIN,
};
const siteEnv = { ...base, NEXT_PUBLIC_SITE_URL: SITE, SITE_NOINDEX: "1", CAREER_APP_UPSTREAM: APP, CAREER_PROXY_SECRET: PROXY };

// ——— empty commercial database + migrations 001–012 and the commercial 013 ———
const root = new pg.Client({ connectionString: `${PG}/postgres` });
await root.connect();
await root.query(`DROP DATABASE IF EXISTS ${DB}`);
await root.query(`CREATE DATABASE ${DB}`);
await root.query("DROP DATABASE IF EXISTS mironovich_career_test_commercial_guard");
await root.query("CREATE DATABASE mironovich_career_test_commercial_guard");
await root.end();
const admin = (...a) => execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/career/demo-admin.mjs", ...a], { env: appEnv }).toString().trim();
const migrated = admin("migrate");
const db = new pg.Pool({ connectionString: appEnv.CAREER_V3_DEMO_DATABASE_URL, max: 4 });

// ——— builds: default .next each time, then moved aside (no tsconfig rewrite for custom distDirs) ———
function build(env, dir) {
  if (process.env.COMMERCIAL_SKIP_BUILD === "1" && existsSync(dir)) return;
  rmSync(".next", { recursive: true, force: true });
  execFileSync("npx", ["next", "build"], { env, stdio: "inherit" });
  rmSync(dir, { recursive: true, force: true });
  renameSync(".next", dir);
}
build(appEnv, ".next-app");
build(siteEnv, ".next-site");
const procs = {};
async function start(name, env, port, dir) {
  const p = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(port)], { env: { ...env, NEXT_DIST_DIR: dir }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = ""; p.stdout.on("data", (d) => (log += d)); p.stderr.on("data", (d) => (log += d));
  procs[name] = { p, log: () => log };
  for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${port}/healthz`); return; } catch { await sleep(500); } }
  throw new Error(name + " did not start\n" + log);
}
const stop = (name) => { try { process.kill(-procs[name].p.pid, "SIGTERM"); } catch { /* gone */ } };
await start("app", appEnv, APP_PORT, ".next-app");
await start("site", siteEnv, SITE_PORT, ".next-site");

let failures = 0, passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name + "\n  " + String(e.stack ?? e).split("\n").slice(0, 6).join("\n  ")); }
}
function client(ip) {
  const jar = new Map();
  const call = async (path, body, extra = {}) => {
    const form = extra.form;
    const r = await fetch((extra.base ?? SITE) + path, {
      method: body === undefined && !form ? "GET" : "POST", redirect: "manual",
      headers: { "x-real-ip": ip, ...(jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
        ...(form ? { "content-type": "application/x-www-form-urlencoded", origin: SITE } : body === undefined ? {} : { "content-type": "application/json", origin: SITE }), ...(extra.headers ?? {}) },
      body: form ? new URLSearchParams(form).toString() : body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookies = r.headers.getSetCookie();
    for (const sc of setCookies) { const m = /^([^=]+)=([^;]*)/.exec(sc); if (m) { if (m[2]) jar.set(m[1], m[2]); else jar.delete(m[1]); } }
    const type = r.headers.get("content-type") ?? "";
    return { status: r.status, body: type.includes("json") ? await r.json() : await r.text(), headers: r.headers, setCookies };
  };
  return { call, jar, demo: (a, b, x) => call("/api/career/demo/" + a, b, x), v3: (p, b) => call("/api/career/v3/sales_manager/" + p, b), shop: (a, b) => call("/api/career/shop/" + a, b), adm: (a, b) => call("/api/career/admin/" + a, b) };
}
const ok = (r) => { assert.ok(r.status >= 200 && r.status < 300, `HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`); return r.body; };
const lastCode = async (email) => /Код для входа: (\d{6})/.exec((await db.query("SELECT body FROM career_mail_preview WHERE to_email=$1 ORDER BY created_at DESC LIMIT 1", [email])).rows[0]?.body ?? "")?.[1];
let ipn = 20; const ip = () => `10.2.0.${ipn++}`;
async function signIn(c, email) {
  ok(await c.demo("otp-start", { email }));
  const r = ok(await c.demo("otp-verify", { code: await lastCode(email) }));
  assert.notEqual(r.needInvite, true, "open sign-up in the commercial app");
  return ok(await c.demo("session")).account;
}

await check("commercial schema: migration 013 dropped synthetic-only constraints here, defaults false, idempotent", async () => {
  assert.match(migrated, /Коммерческая схема готова/);
  assert.match(migrated, /CAREER_V3_ADMIN_EMAILS: 1/);
  const checks = (await db.query("SELECT count(*)::int AS n FROM pg_constraint WHERE contype='c' AND pg_get_constraintdef(oid) IN ('CHECK (synthetic)','CHECK ((synthetic))')")).rows[0].n;
  assert.equal(checks, 0);
  const defaults = (await db.query("SELECT DISTINCT column_default FROM information_schema.columns WHERE table_schema='public' AND column_name='synthetic'")).rows.map((r) => r.column_default);
  assert.deepEqual(defaults, ["false"]);
  assert.deepEqual((await db.query("SELECT profile FROM career_commercial_schema")).rows, [{ profile: "commercial-staging" }]);
  assert.match(admin("migrate"), /Коммерческая схема готова/, "re-running migrate is safe");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM career_migrations WHERE version IN (12,13)")).rows[0].n, 2);
});

await check("013 refuses every non-commercial database (test, demo, stage-1 stay synthetic-only)", async () => {
  const other = new pg.Client({ connectionString: `${PG}/mironovich_career_test_commercial_guard` });
  await other.connect();
  const sql = readFileSync("migrations/career-commercial/013_commercial_real_users.sql", "utf8");
  await assert.rejects(other.query(sql), /CAREER_COMMERCIAL_DATABASE_REQUIRED/);
  await assert.rejects(other.query("BEGIN; SELECT set_config('mironovich.career_demo','commercial',true); " + sql + " COMMIT;"), /CAREER_COMMERCIAL_DATABASE_REQUIRED/, "right setting, wrong database");
  await other.query("ROLLBACK").catch(() => {});
  await other.end();
  assert.ok(!readdirSync("migrations/career").some((f) => f.startsWith("013")), "013 lives outside migrations/career (closed contours never load it)");
});

await check("public site: pages work, sign-in button leads to /career on the same domain; robots keep cabinets out", async () => {
  const home = await client(ip()).call("/");
  assert.equal(home.status, 200);
  assert.match(home.body, /href="\/career\?login=1"/);
  assert.doesNotMatch(home.body, /ai-career-v3-demo-ai-career-v3-closed-demo|up\.railway\.app\/career/, "no link to the closed demo");
  for (const p of ["/products", "/products/ai-career", "/services", "/contact"]) assert.equal((await client(ip()).call(p)).status, 200, p);
});

await check("/career through the site: cabinet HTML, assets under /career-app/_next load through the proxy, noindex", async () => {
  const r = await client(ip()).call("/career");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("x-robots-tag") ?? "", /noindex/);
  const assets = [...r.body.matchAll(/(?:src|href)="(\/career-app\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(assets.length > 2, "app assets use the /career-app prefix");
  for (const a of assets.slice(0, 4)) assert.equal((await fetch(SITE + a)).status, 200, a);
  assert.doesNotMatch(r.body, /"\/_next\/static\//, "no unprefixed app assets that would hit the site");
  assert.equal((await client(ip()).call("/career/v3")).status, 200);
});

await check("the app is unreachable without the proxy: no secret → 404 on pages and APIs; forged header from a visitor is overwritten", async () => {
  for (const p of ["/career", "/career/v3", "/admin", "/api/career/demo/session", "/api/career/shop/public-quote"]) assert.equal((await fetch(APP + p)).status, 404, "direct " + p);
  assert.equal((await fetch(APP + "/api/career/demo/session", { headers: { "x-career-proxy": "x".repeat(40), "x-forwarded-host": "127.0.0.1:3520" } })).status, 404, "wrong secret");
  assert.equal((await fetch(APP + "/healthz")).status, 200, "health check for Railway");
  const viaSite = await client(ip()).demo("session", undefined, { headers: { "x-career-proxy": "forged", "x-forwarded-host": "evil.example" } });
  assert.equal(viaSite.status, 200, "the site replaces both headers");
});

const U = client(ip());
await check("open sign-up by email code through the site: account without access, HttpOnly session cookie, purchase screen", async () => {
  const r = await U.demo("otp-start", { email: "real-user@example.com" });
  ok(r);
  const login = r.setCookies.find((c) => c.startsWith("career_login="));
  assert.ok(login && /HttpOnly/i.test(login) && /SameSite=lax/i.test(login) && /Path=\//.test(login), "login challenge cookie flags");
  const v = await U.demo("otp-verify", { code: await lastCode("real-user@example.com") });
  ok(v);
  const sess = v.setCookies.find((c) => c.startsWith("career_demo_session="));
  assert.ok(sess && /HttpOnly/i.test(sess) && /SameSite=lax/i.test(sess), "session cookie flags");
  const acc = ok(await U.demo("session")).account;
  assert.deepEqual([acc.hasAccess, acc.isAdmin, acc.emailVerified], [false, false, true]);
  assert.equal((await U.v3("diagnostic/questions")).status, 402, "learning needs access");
  assert.equal((await db.query("SELECT synthetic FROM career_accounts a JOIN career_demo_users u ON u.account_id=a.id WHERE u.email='real-user@example.com'")).rows[0].synthetic, false, "real user row");
});

await check("CSRF and host: foreign origin and missing JSON are refused; session survives a reload", async () => {
  const foreign = await U.call("/api/career/demo/logout", {}, { headers: { origin: "https://evil.example" } });
  assert.equal(foreign.status, 403);
  const plain = await U.call("/api/career/demo/otp-start", undefined, { form: { email: "a@b.cd" } });
  assert.equal(plain.status, 415);
  assert.equal(ok(await U.demo("session")).authenticated, true);
});

await check("XSS-shaped emails are refused before reaching the database or the admin cabinet", async () => {
  for (const e of ["<svg/onload=alert(1)>@example.com", "a\"><script>@example.com", "x@exa<mple>.com", "a b@example.com"]) {
    const r = await client(ip()).demo("otp-start", { email: e });
    assert.equal(r.status, 400, e);
  }
  assert.equal((await db.query("SELECT count(*)::int AS n FROM career_mail_preview WHERE to_email ~ '[<>\"]'")).rows[0].n, 0);
});

const A = client(ip());
await check("admin damironovich-style bootstrap admin: /admin through the site works; regular user and anonymous get 404", async () => {
  const acc = await signIn(A, ADMIN);
  assert.equal(acc.isAdmin, true);
  for (const p of ["/admin", "/admin/users", "/admin/sales", "/admin/learning", "/admin/prices"]) {
    const r = await A.call(p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get("x-robots-tag") ?? "", /noindex/);
  }
  assert.equal((await U.call("/admin")).status, 404);
  assert.equal((await client(ip()).call("/admin/prices")).status, 404);
  assert.equal((await U.adm("price", { mode: "manual", priceRub: 5900, reason: "попытка", confirm: true })).status, 404);
});

await check("one price source: the site's product page reads the app's price; MANUAL 3 990 ₽ reaches the site within the 60 s revalidation", async () => {
  const price = async () => /Купить за (?:<!-- -->)?(\d \d{3}) ₽/.exec((await client(ip()).call("/products/ai-career")).body)?.[1];
  assert.equal(await price(), "1 993");
  assert.deepEqual(ok(await client(ip()).call("/api/career/shop/public-quote")), { priceRub: 1993, mode: "auto", salesOpen: false });
  ok(await A.adm("price", { mode: "manual", priceRub: 3990, reason: "staging: проверка синхронизации", confirm: true }));
  assert.equal(ok(await client(ip()).call("/api/career/shop/public-quote")).priceRub, 3990, "the app switches at once");
  await sleep(62_000);
  await price(); // the first request after the window regenerates the page
  await sleep(1500);
  assert.equal(await price(), "3 990");
  const o = ok(await U.shop("order", { adultConfirmed: true, offerAccepted: true }));
  assert.equal(o.order.priceRub, 3990);
  assert.equal(new URL(o.payUrl).searchParams.get("OutSum"), "3990.00");
  assert.equal(new URL(o.payUrl).origin, SITE, "the emulator is reached through the site");
  ok(await A.adm("price", { mode: "auto", reason: "staging: возврат в AUTO", confirm: true }));
});

await check("test payment through the site: emulator → ResultURL via the proxy → access; wrong signature refused", async () => {
  const o = ok(await U.shop("order", { adultConfirmed: true, offerAccepted: true }));
  const u = new URL(o.payUrl);
  const bad = await fetch(SITE + "/api/career/pay/robokassa/result", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ OutSum: u.searchParams.get("OutSum"), InvId: u.searchParams.get("InvId"), SignatureValue: "0".repeat(32), Shp_order: o.order.id }) });
  assert.equal(bad.status, 400);
  const form = Object.fromEntries(u.searchParams); form.decision = "pay";
  const r = await U.call("/api/career/pay/emulator", undefined, { form });
  assert.equal(r.status, 303);
  assert.match(r.headers.get("location"), /\/api\/career\/pay\/robokassa\/success\?/);
  assert.equal(ok(await U.demo("session")).account.hasAccess, true);
  assert.equal(ok(await U.v3("diagnostic/questions")).questions.length, 18);
  void createHash;
});

await check("sign-out ends the session on the server", async () => {
  const saved = new Map(U.jar);
  ok(await U.demo("logout", {}));
  const thief = client(ip()); for (const [k, v] of saved) thief.jar.set(k, v);
  assert.equal(ok(await thief.demo("session")).authenticated, false);
});

await check("the public site keeps working while the learning app is down; /career fails fast", async () => {
  stop("app");
  await sleep(1500);
  for (const p of ["/", "/products", "/services", "/contact"]) assert.equal((await client(ip()).call(p)).status, 200, p + " with the app down");
  const t0 = Date.now();
  const r = await client(ip()).call("/career");
  assert.ok(r.status >= 500, "/career reports an error instead of a site page");
  assert.ok(Date.now() - t0 < 16_000, "no long hang (proxy timeout 15 s)");
  await start("app", appEnv, APP_PORT, ".next-app");
  assert.equal((await client(ip()).call("/career")).status, 200, "back after restart");
});

stop("site"); stop("app");
await db.end();
console.log(`career commercial integration: ${passed} passed, ${failures} failed`);
if (failures) { console.log("APP LOG\n" + procs.app.log().slice(-2500) + "\nSITE LOG\n" + procs.site.log().slice(-2500)); process.exit(1); }
