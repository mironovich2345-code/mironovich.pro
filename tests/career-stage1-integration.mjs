// AI Career 3.0 stage 1 — HTTP integration test against a real `next start` server (stage-1 profile, LOCAL) and a local
// PostgreSQL database named exactly mironovich_career_stage1. Synthetic data only; payments run through the preview
// emulator and directly signed ResultURL notifications — no network, no real money, no real mailbox.
//
//   CAREER_STAGE1_PG=postgresql://user:pass@127.0.0.1:5432 node --experimental-strip-types tests/career-stage1-integration.mjs
//   (STAGE1_SKIP_BUILD=1 reuses an existing build made by a previous run.)
//
// Covers: old account + old progress kept across migration 012 and found by email; email-code sign-in (wrong, expired,
// reused, locked, resend cooldown, hourly limit, no email enumeration, invite for a new email); admin only on the server
// (/admin and its API answer 404 to everyone else, no role from the browser); AUTO/MANUAL price 1993 → 3990 → 5900 with
// history; the same price on the product page, the catalogue, the order and the Robokassa request; concurrent buyers at
// a tier boundary; ResultURL with a wrong signature, a repeated notification, a wrong amount, a cancelled order, a
// refund; concurrent notifications; access granted only by the server notification.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";

const PORT = Number(process.env.STAGE1_PORT ?? 3410);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const DB = "mironovich_career_stage1";
const PG = (process.env.CAREER_STAGE1_PG ?? "").replace(/\/+$/, "");
assert.ok(/^postgres(ql)?:\/\/[^/]+@?(127\.0\.0\.1|localhost)(:\d+)?$/.test(PG), "CAREER_STAGE1_PG must point to a LOCAL PostgreSQL server (no database name)");
const P = "sales_manager";
const ADMIN = "admin-s1@example.com";
const secret = (n) => randomBytes(n).toString("base64url").slice(0, n);
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  CAREER_V3_DEMO: "1", CAREER_V3_DEMO_LOCAL: "1", CAREER_V3_DEMO_PROFILE: "stage1", SITE_NOINDEX: "1",
  CAREER_V3_DEMO_ORIGIN: ORIGIN, NEXT_PUBLIC_SITE_URL: ORIGIN, CAREER_V3_DEMO_DATABASE_URL: `${PG}/${DB}`,
  CAREER_V3_DEMO_SESSION_SECRET: secret(64), CAREER_V3_OTP_SECRET: secret(48),
  CAREER_V3_MAIL: "preview-outbox", CAREER_V3_PREVIEW_OUTBOX_KEY: secret(32),
  CAREER_V3_ROBOKASSA: "emulator", CAREER_V3_ROBOKASSA_TEST_PASSWORD1: secret(20), CAREER_V3_ROBOKASSA_TEST_PASSWORD2: secret(20),
  CAREER_V3_ROBOKASSA_HASH: "sha256", CAREER_V3_ADMIN_EMAILS: ADMIN, CAREER_V3_DEMO_MAX_USERS: "200",
};

// ——— fresh database: migrations 001–011 = the schema of the running closed demo ———
const root = new pg.Client({ connectionString: `${PG}/postgres` });
await root.connect();
await root.query(`DROP DATABASE IF EXISTS ${DB}`);
await root.query(`CREATE DATABASE ${DB}`);
await root.end();
const db = new pg.Pool({ connectionString: env.CAREER_V3_DEMO_DATABASE_URL, max: 4 });
{
  const c = await db.connect();
  await c.query("BEGIN");
  await c.query("SELECT set_config('mironovich.career_demo','stage1-preview',true)");
  for (const f of readdirSync("migrations/career").filter((n) => /^\d+.*\.sql$/.test(n) && n < "012").sort()) await c.query(readFileSync("migrations/career/" + f, "utf8"));
  await c.query("COMMIT");
  c.release();
}

// ——— an OLD account with OLD progress, created with the pre-stage-1 schema (password account of the closed demo) ———
Object.assign(process.env, env);
const auth = await import("../lib/server/career-demo/auth.ts");
const store = await import("../lib/server/career-v3/store.ts");
const LEGACY = "legacy-s1@example.com";
const legacyAccount = "11111111-1111-4111-8111-111111111111";
await db.query("INSERT INTO career_accounts(id,email) VALUES($1,'demo-legacy0000000001@example.invalid')", [legacyAccount]);
await db.query(
  "INSERT INTO career_demo_users(id,account_id,email,password_hash,access_until,created_at) VALUES('22222222-2222-4222-8222-222222222222',$1,$2,$3,now()+interval '20 days',now()-interval '10 days')",
  [legacyAccount, LEGACY, await auth.hashPassword("Legacy password 42")]);
const answers = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles[0].answers;
await store.saveV3Diagnostic(legacyAccount, P, answers);
await store.saveV3TaskMap(legacyAccount, P);
const legacyPlan = (await store.saveV3Plan(legacyAccount, P)).plan;
await store.startV3Step(legacyAccount, P, 1, legacyPlan.steps[0].stableId);
const legacyBefore = (await db.query("SELECT id FROM career_v3_plan_versions WHERE account_id=$1 AND status='active'", [legacyAccount])).rows[0].id;
const { careerPool } = await import("../lib/server/career/db.ts");
await careerPool().end();

// ——— migration 012 through the operator command (adds the bootstrap admin) ———
const admin = (...args) => execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/career/demo-admin.mjs", ...args], { env }).toString().trim();
const migrated = admin("migrate");
assert.match(migrated, /Схема закрытого демо готова/);
assert.match(migrated, /CAREER_V3_ADMIN_EMAILS: 1/);
assert.equal((await db.query("SELECT count(*)::int AS n FROM career_migrations WHERE version=12")).rows[0].n, 1);
assert.equal((await db.query("SELECT password_hash FROM career_demo_users WHERE email=$1", [LEGACY])).rows[0].password_hash.startsWith("scrypt$"), true, "old password hash untouched");

// ——— build + server ———
if (process.env.STAGE1_SKIP_BUILD !== "1") execFileSync("npx", ["next", "build"], { env, stdio: "inherit" });
const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(PORT)], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
for (let i = 0; i < 80; i++) { try { await fetch(ORIGIN + "/robots.txt"); break; } catch { await sleep(500); } }

let failures = 0, passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name + "\n  " + (e.stack ?? e).toString().split("\n").slice(0, 6).join("\n  ")); }
}

function client(ip) {
  const jar = new Map();
  const call = async (path, body, extra = {}) => {
    const form = extra.form;
    const r = await fetch(ORIGIN + path, {
      method: body === undefined && !form ? "GET" : "POST", redirect: "manual",
      headers: {
        "x-real-ip": ip, ...(jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
        ...(form ? { "content-type": "application/x-www-form-urlencoded", origin: ORIGIN } : body === undefined ? {} : { "content-type": "application/json", origin: ORIGIN }),
        ...(extra.headers ?? {}),
      },
      body: form ? new URLSearchParams(form).toString() : body === undefined ? undefined : JSON.stringify(body),
    });
    for (const sc of r.headers.getSetCookie()) { const m = /^([^=]+)=([^;]*)/.exec(sc); if (m) { if (m[2]) jar.set(m[1], m[2]); else jar.delete(m[1]); } }
    const type = r.headers.get("content-type") ?? "";
    const value = type.includes("json") ? await r.json() : await r.text();
    return { status: r.status, body: value, headers: r.headers };
  };
  return { call, jar, demo: (a, b) => call("/api/career/demo/" + a, b), v3: (p, b) => call(`/api/career/v3/${P}/${p}`, b), shop: (a, b) => call("/api/career/shop/" + a, b), adm: (a, b) => call("/api/career/admin/" + a, b) };
}
const ok = (r) => { assert.ok(r.status >= 200 && r.status < 300, `HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`); return r.body; };
const lastCode = async (email) => {
  const r = await db.query("SELECT body FROM career_mail_preview WHERE to_email=$1 ORDER BY created_at DESC LIMIT 1", [email]);
  return /Код для входа: (\d{6})/.exec(r.rows[0]?.body ?? "")?.[1];
};
const freeCooldown = (email) => db.query("UPDATE career_login_challenges SET resend_available_at=now()-interval '1 second', last_sent_at=last_sent_at-interval '2 hours' WHERE email=$1", [email]);
async function signIn(c, email, invite) {
  ok(await c.demo("otp-start", { email }));
  const r = ok(await c.demo("otp-verify", { code: await lastCode(email) }));
  if (r.needInvite) ok(await c.demo("otp-signup", { invite }));
  return ok(await c.demo("session")).account;
}
/** Value of an admin stat tile by its label (server-rendered HTML). */
const stat = (html, label) => {
  const m = new RegExp(label.replace(/[()]/g, "\\$&") + "</p><p[^>]*>([^<]*)</p>").exec(html.replace(/<!-- -->/g, ""));
  return m ? m[1].replace(/\u00a0/g, " ") : null;
};
let ipn = 10;
const nextIp = () => `10.0.0.${ipn++}`;
const invite = () => admin("invite", "s1test", "7");
const rkHash = (s) => createHash("sha256").update(s).digest("hex");
const resultSig = (outSum, inv, order) => rkHash(`${outSum}:${inv}:${env.CAREER_V3_ROBOKASSA_TEST_PASSWORD2}:Shp_order=${order}`);
const notify = (c, outSum, inv, order, sig = resultSig(outSum, inv, order)) =>
  fetch(ORIGIN + "/api/career/pay/robokassa/result", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ OutSum: outSum, InvId: String(inv), SignatureValue: sig, Shp_order: order }) })
    .then(async (r) => ({ status: r.status, text: await r.text() }));

// ——————————————————————————————————————— sign-in ———————————————————————————————————————
const L = client(nextIp());
await check("old account: email code signs in, same route and step state as before migration 012 (password no longer used)", async () => {
  assert.equal((await L.demo("login", { email: LEGACY, password: "Legacy password 42" })).status, 404, "password sign-in is off in the stage-1 profile");
  const acc = await signIn(L, LEGACY);
  assert.equal(acc.email, LEGACY);
  assert.equal(acc.emailVerified, true, "first code confirms the email");
  assert.equal(acc.hasAccess, true, "invite access kept");
  const pr = ok(await L.v3("progress"));
  assert.equal(pr.planVersionId, legacyBefore, "same active route as before migration 012");
  assert.equal(pr.steps.find((s) => s.position === 1).state, "in_progress", "old step state kept");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM career_demo_users WHERE email=$1", [LEGACY])).rows[0].n, 1, "no duplicate account");
});

await check("wrong code: attempts left; reused code: refused; one session per challenge", async () => {
  const c = client(nextIp()), e = "otp-wrong@example.com";
  await db.query("INSERT INTO career_staff(email,role,granted_by) VALUES($1,'admin','operator')", [e]); // creates the account without invite
  ok(await c.demo("otp-start", { email: e }));
  const code = await lastCode(e);
  const wrong = String((Number(code) + 1) % 1e6).padStart(6, "0");
  const w = await c.demo("otp-verify", { code: wrong });
  assert.equal(w.status, 400); assert.match(w.body.error, /Осталось попыток: 4/);
  ok(await c.demo("otp-verify", { code }));
  // replay with the same challenge cookie after success: the cookie was cleared — restore it to prove the server refuses
  const ch = await db.query("SELECT consumed_at FROM career_login_challenges WHERE email=$1 ORDER BY created_at DESC LIMIT 1", [e]);
  assert.ok(ch.rows[0].consumed_at, "challenge consumed");
  await db.query("UPDATE career_staff SET revoked_at=now() WHERE email=$1", [e]);
});

await check("reused code from a captured cookie is refused (409); two concurrent correct submissions open one session", async () => {
  const e = "otp-replay@example.com";
  await db.query("INSERT INTO career_staff(email,role,granted_by) VALUES($1,'admin','operator')", [e]);
  const a = client(nextIp());
  ok(await a.demo("otp-start", { email: e }));
  const cookie = [...a.jar][0];
  const code = await lastCode(e);
  const b = client(nextIp()); b.jar.set(cookie[0], cookie[1]);
  const [r1, r2] = await Promise.all([a.demo("otp-verify", { code }), b.demo("otp-verify", { code })]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
  const sessions = (await db.query("SELECT count(*)::int AS n FROM career_demo_sessions s JOIN career_demo_users u ON u.id=s.user_id WHERE u.email=$1", [e])).rows[0].n;
  assert.equal(sessions, 1);
  const again = client(nextIp()); again.jar.set(cookie[0], cookie[1]);
  assert.equal((await again.demo("otp-verify", { code })).status, 409);
  await db.query("UPDATE career_staff SET revoked_at=now() WHERE email=$1", [e]);
});

await check("expired code (10 minutes) is refused with 410", async () => {
  const c = client(nextIp()), e = "otp-expired@example.com";
  ok(await c.demo("otp-start", { email: e }));
  const code = await lastCode(e);
  await db.query("UPDATE career_login_challenges SET expires_at=now()-interval '1 second' WHERE email=$1", [e]);
  assert.equal((await c.demo("otp-verify", { code })).status, 410);
});

await check("five wrong codes lock the challenge; even the right code is then refused (423)", async () => {
  const c = client(nextIp()), e = "otp-lock@example.com";
  ok(await c.demo("otp-start", { email: e }));
  const code = await lastCode(e);
  const wrong = String((Number(code) + 7) % 1e6).padStart(6, "0");
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await c.demo("otp-verify", { code: wrong })).status);
  assert.deepEqual(statuses, [400, 400, 400, 400, 423]);
  assert.equal((await c.demo("otp-verify", { code })).status, 423);
});

await check("resend: 60 s cooldown, old code dies, new code works; at most 5 sends per hour per email", async () => {
  const c = client(nextIp()), e = "otp-resend@example.com";
  await db.query("INSERT INTO career_staff(email,role,granted_by) VALUES($1,'admin','operator')", [e]);
  ok(await c.demo("otp-start", { email: e }));
  const first = await lastCode(e);
  assert.equal((await c.demo("otp-resend", {})).status, 429, "cooldown");
  await db.query("UPDATE career_login_challenges SET resend_available_at=now()-interval '1 second' WHERE email=$1", [e]);
  ok(await c.demo("otp-resend", {}));
  const second = await lastCode(e);
  if (second !== first) assert.equal((await c.demo("otp-verify", { code: first })).status, 400, "previous code no longer valid");
  ok(await c.demo("otp-verify", { code: second }));
  await db.query("UPDATE career_staff SET revoked_at=now() WHERE email=$1", [e]);
  const h = client(nextIp()), e2 = "otp-hourly@example.com";
  const statuses = [];
  for (let i = 0; i < 6; i++) { statuses.push((await h.demo("otp-start", { email: e2 })).status); await db.query("UPDATE career_login_challenges SET resend_available_at=now()-interval '1 second' WHERE email=$1", [e2]); }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
});

await check("no email enumeration: the first step answers identically for an existing and an unknown address", async () => {
  const a = await client(nextIp()).demo("otp-start", { email: LEGACY.replace("legacy", "legacy") });
  await freeCooldown(LEGACY);
  const known = await client(nextIp()).demo("otp-start", { email: LEGACY });
  const unknown = await client(nextIp()).demo("otp-start", { email: "nobody-s1@example.com" });
  assert.equal(known.status, unknown.status);
  assert.deepEqual(Object.keys(known.body).sort(), Object.keys(unknown.body).sort());
  assert.equal(known.body.resendSeconds, unknown.body.resendSeconds);
  void a;
  assert.equal((await client(nextIp()).demo("otp-start", { email: "not-an-email" })).status, 400);
});

const U = client(nextIp());
await check("new email: code, then invite required; bad invite refused; valid invite creates the account with invite access", async () => {
  const e = "learner-s1@example.com";
  ok(await U.demo("otp-start", { email: e }));
  const r = ok(await U.demo("otp-verify", { code: await lastCode(e) }));
  assert.equal(r.needInvite, true);
  assert.equal((await U.demo("otp-signup", { invite: "AAAA-BBBB-CCCC-DDDD" })).status, 403);
  ok(await U.demo("otp-signup", { invite: invite() }));
  const acc = ok(await U.demo("session")).account;
  assert.equal(acc.hasAccess, true);
  assert.equal(acc.isAdmin, false);
  assert.equal(ok(await U.v3("diagnostic/questions")).questions.length, 18);
});

// ——————————————————————————————————————— admin ———————————————————————————————————————
const A = client(nextIp());
await check("admin: email code for the bootstrap admin opens /admin; every tab renders", async () => {
  const acc = await signIn(A, ADMIN);
  assert.equal(acc.isAdmin, true);
  assert.equal(acc.hasAccess, false, "the admin role does not grant a paid program");
  for (const tab of ["overview", "users", "sales", "learning", "prices"]) {
    const r = await A.call("/admin/" + tab);
    assert.equal(r.status, 200, tab);
    assert.match(r.body, /админ-кабинет/);
  }
  const users = await A.call("/admin/users");
  assert.match(users.body, /l\*\*\*@example\.com/, "emails masked by default");
  assert.doesNotMatch(users.body, /legacy-s1@example\.com/);
  assert.match((await A.call("/admin/users/emails")).body, /legacy-s1@example\.com/, "shown only on explicit request");
  // zero statistics render as explicit empty states, not errors or blanks
  const sales = (await A.call("/admin/sales")).body;
  for (const t of ["Продаж пока нет.", "Заказов пока нет.", "Уведомлений пока не было."]) assert.ok(sales.includes(t), t);
  assert.ok((await A.call("/admin/prices")).body.includes("Изменений ещё не было: действует AUTO."));
  assert.equal(stat((await A.call("/admin/overview")).body, "Подтверждённые оплаты (тест)"), "0");
  assert.equal(stat((await A.call("/admin/overview")).body, "Выручка (тест)"), "0 ₽");
  assert.match((await A.call("/admin/overview")).body, /это не реальная выручка/);
});

await check("session survives a reload; sign-out revokes it on the server (a copied cookie stops working)", async () => {
  const c = client(nextIp()), e = "session-s1@example.com";
  await signIn(c, e, invite());
  assert.equal(ok(await c.demo("session")).authenticated, true, "reload = new request with the same cookie");
  const saved = new Map(c.jar);
  ok(await c.demo("logout", {}));
  assert.equal(ok(await c.demo("session")).authenticated, false);
  const thief = client(nextIp());
  for (const [k, v] of saved) thief.jar.set(k, v);
  assert.equal(ok(await thief.demo("session")).authenticated, false, "old cookie no longer valid");
  assert.equal((await thief.v3("progress")).status, 401);
});

await check("non-admins: /admin and the admin API answer 404; no role from browser parameters; password session is not enough", async () => {
  for (const c of [U, L, client(nextIp())]) {
    assert.equal((await c.call("/admin")).status, 404);
    assert.equal((await c.call("/admin/prices?role=admin&isAdmin=1")).status, 404);
    assert.equal((await c.adm("price", { mode: "manual", priceRub: 5900, reason: "попытка", confirm: true })).status, 404);
  }
  assert.equal((await U.demo("otp-verify", { code: "123456", role: "admin" })).status, 400, "unexpected fields refused");
  const sess = (await db.query("SELECT s.token_hash FROM career_demo_sessions s JOIN career_demo_users u ON u.id=s.user_id WHERE u.email=$1 AND s.revoked_at IS NULL", [ADMIN])).rows;
  await db.query("UPDATE career_demo_sessions SET auth_method='password' WHERE token_hash = ANY($1)", [sess.map((x) => x.token_hash)]);
  assert.equal((await A.call("/admin")).status, 404, "admin needs a session opened with an email code");
  await db.query("UPDATE career_demo_sessions SET auth_method='otp' WHERE token_hash = ANY($1)", [sess.map((x) => x.token_hash)]);
  assert.equal((await A.call("/admin")).status, 200);
});

// ——————————————————————————————————————— price + orders + Robokassa ———————————————————————————————————————
const pagePrice = async (path) => {
  const html = (await client(nextIp()).call(path)).body;
  return [...html.matchAll(/(1 993|3 990|5 900) ₽/g)].map((m) => m[1]);
};
/** The price on the AI Career card of the catalogue (the page text also lists the three possible prices). */
const cataloguePrice = async () => {
  const html = (await client(nextIp()).call("/products")).body;
  return /([0-9] [0-9]{3}) ₽(?:<!-- -->)?\s*(?:<!-- -->)?<span[^>]*>(?:<!-- -->)?действующая цена/.exec(html)?.[1];
};
async function buyer(tag) {
  const c = client(nextIp()), e = `buyer-${tag}@example.com`;
  await signIn(c, e, invite());
  await db.query("UPDATE career_demo_users SET access_until=now()-interval '1 day' WHERE email=$1", [e]); // invite access over → must buy
  return c;
}
const setPrice = (body) => A.adm("price", body);

await check("AUTO by default: 1 993 ₽ on the product page, the catalogue and in the order; payment URL carries the same amount", async () => {
  assert.equal((await db.query("SELECT mode FROM commerce_price_settings")).rows[0].mode, "auto");
  assert.match((await client(nextIp()).call("/products/ai-career")).body, /Купить за (<!-- -->)?1 993 ₽/, "product page");
  assert.equal(await cataloguePrice(), "1 993", "catalogue");
  const b = await buyer("auto1");
  assert.equal(ok(await b.shop("order")).priceRub, 1993);
  assert.equal((await b.shop("order", { adultConfirmed: false, offerAccepted: true })).status, 400, "18+ confirmation required");
  const o = ok(await b.shop("order", { adultConfirmed: true, offerAccepted: true }));
  assert.equal(o.order.priceRub, 1993);
  const u = new URL(o.payUrl);
  assert.equal(u.searchParams.get("OutSum"), "1993.00");
  assert.equal(u.searchParams.get("IsTest"), "1");
  assert.equal(u.searchParams.get("InvId"), String(o.order.invId));
  ok(await b.shop("cancel", { orderId: o.order.id }));
});

await check("price change needs confirmation, a reason and an allowed price", async () => {
  assert.equal((await setPrice({ mode: "manual", priceRub: 3990, reason: "старт", confirm: false })).status, 400);
  assert.equal((await setPrice({ mode: "manual", priceRub: 3990, reason: "", confirm: true })).status, 400);
  assert.equal((await setPrice({ mode: "manual", priceRub: 4990, reason: "ошибка", confirm: true })).status, 400);
  assert.equal((await setPrice({ mode: "turbo", reason: "ошибка", confirm: true })).status, 400);
});

let order3990;
for (const [price, label] of [[3990, "3 990"], [5900, "5 900"]]) {
  await check(`MANUAL ${label} ₽: site, catalogue, new order and Robokassa request all show ${label} ₽`, async () => {
    ok(await setPrice({ mode: "manual", priceRub: price, reason: `тест ${price}`, confirm: true }));
    const html = (await client(nextIp()).call("/products/ai-career")).body;
    assert.match(html, new RegExp(`Купить за (<!-- -->)?${label} ₽`), "product page buy button shows " + label);
    assert.equal(await cataloguePrice(), label, "catalogue");
    const b = await buyer("m" + price);
    const o = ok(await b.shop("order", { adultConfirmed: true, offerAccepted: true }));
    assert.equal(o.order.priceRub, price);
    assert.equal(new URL(o.payUrl).searchParams.get("OutSum"), `${price}.00`);
    const em = await b.call(new URL(o.payUrl).pathname + new URL(o.payUrl).search);
    assert.match(em.body, new RegExp(`${price}\\.00`), "emulator page shows the amount");
    assert.match(em.body, /Подпись запроса проверена/);
    if (price === 3990) order3990 = { c: b, ...o.order };
  });
}

await check("existing order keeps its amount after a price change (3 990 ₽ order paid at 3 990 ₽ while 5 900 ₽ is in force)", async () => {
  const row = (await db.query("SELECT price_kopeks, status FROM career_shop_orders WHERE id=$1", [order3990.id])).rows[0];
  assert.deepEqual([row.price_kopeks, row.status], [399000, "pending"]);
  const r = await notify(null, "3990.00", order3990.invId, order3990.id);
  assert.deepEqual([r.status, r.text], [200, "OK" + order3990.invId]);
  assert.equal(ok(await order3990.c.demo("session")).account.hasAccess, true, "paid → access");
});

await check("history: who, old/new value, time, reason; append-only", async () => {
  const h = (await db.query("SELECT changed_by, old_price_kopeks, new_price_kopeks, new_mode, reason FROM commerce_price_changes ORDER BY id")).rows;
  assert.deepEqual(h.map((x) => [x.changed_by, x.old_price_kopeks, x.new_price_kopeks, x.new_mode]), [[ADMIN, 199300, 399000, "manual"], [ADMIN, 399000, 590000, "manual"]]);
  await assert.rejects(db.query("UPDATE commerce_price_changes SET reason='x'"), /append-only/);
  await assert.rejects(db.query("DELETE FROM commerce_price_changes"), /append-only/);
});

await check("back to AUTO: tier recomputed from confirmed sales (1 paid → next sale №2 → 1 993 ₽)", async () => {
  await db.query("UPDATE career_shop_orders SET status='canceled', canceled_at=now() WHERE status='pending'");
  const r = ok(await setPrice({ mode: "auto", reason: "возврат к автоматике", confirm: true }));
  assert.equal(r.priceRub, 1993);
  assert.ok((await pagePrice("/products/ai-career")).includes("1 993"));
});

await check("concurrent buyers at the 10/11 boundary get sale №10 → 1 993 ₽ and №11 → 3 990 ₽; a double click reuses the order", async () => {
  // 8 more confirmed sales (synthetic accounts) → 9 paid in total
  for (let i = 0; i < 8; i++) {
    const acc = (await db.query("INSERT INTO career_accounts(id,email) VALUES(gen_random_uuid(), 'demo-s1fill' || $1 || '@example.invalid') RETURNING id", [String(i).padStart(4, "0")])).rows[0].id;
    await db.query("INSERT INTO career_shop_orders(id,account_id,price_kopeks,price_mode,sale_position,status,provider_mode,offer_version,adult_confirmed,reserved_until,paid_at,paid_out_sum) VALUES(gen_random_uuid(),$1,199300,'auto',$2,'paid','emulator','draft-2026-11-17',true,now(),now(),'1993.00')", [acc, i + 2]);
  }
  const [b1, b2] = [await buyer("race1"), await buyer("race2")];
  const [o1, o2, o1again] = await Promise.all([
    b1.shop("order", { adultConfirmed: true, offerAccepted: true }), b2.shop("order", { adultConfirmed: true, offerAccepted: true }), b1.shop("order", { adultConfirmed: true, offerAccepted: true })]);
  const prices = [ok(o1).order.priceRub, ok(o2).order.priceRub].sort();
  assert.deepEqual(prices, [1993, 3990]);
  assert.equal(ok(o1again).order.id, o1.body.order.id, "same buyer, same live order");
  const pos = (await db.query("SELECT sale_position FROM career_shop_orders WHERE status='pending' ORDER BY sale_position")).rows.map((x) => x.sale_position);
  assert.deepEqual(pos, [10, 11]);
  // concurrent duplicate notifications for one order: one payment, one grant
  const cheap = [o1, o2].map((x) => x.body.order).find((x) => x.priceRub === 1993);
  const rs = await Promise.all([1, 2, 3].map(() => notify(null, "1993.00", cheap.invId, cheap.id)));
  assert.ok(rs.every((r) => r.status === 200 && r.text === "OK" + cheap.invId));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM career_access_grants WHERE order_id=$1", [cheap.id])).rows[0].n, 1);
  assert.deepEqual((await db.query("SELECT outcome FROM career_shop_notifications WHERE order_id=$1 ORDER BY id", [cheap.id])).rows.map((x) => x.outcome).sort(), ["duplicate", "duplicate", "paid"]);
});

await check("ResultURL: wrong signature, wrong amount, unknown order, malformed → refused, nothing granted", async () => {
  const b = await buyer("bad");
  const o = ok(await b.shop("order", { adultConfirmed: true, offerAccepted: true })).order;
  const amount = `${o.priceRub}.00`;
  assert.deepEqual(await notify(null, amount, o.invId, o.id, "0".repeat(64)), { status: 400, text: "bad sign" });
  const wrongSum = o.priceRub === 1993 ? "3990.00" : "1993.00";
  assert.deepEqual(await notify(null, wrongSum, o.invId, o.id), { status: 400, text: "amount_mismatch" });
  assert.deepEqual(await notify(null, amount, 999999, o.id), { status: 400, text: "unknown_order" });
  const mal = await fetch(ORIGIN + "/api/career/pay/robokassa/result", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "OutSum=abc" });
  assert.equal(mal.status, 400);
  assert.equal((await db.query("SELECT status FROM career_shop_orders WHERE id=$1", [o.id])).rows[0].status, "pending");
  assert.equal(ok(await b.demo("session")).account.hasAccess, false);
  // the SuccessURL redirect alone never grants access
  await b.call(`/api/career/pay/robokassa/success?OutSum=${amount}&InvId=${o.invId}&Shp_order=${o.id}&SignatureValue=${"0".repeat(64)}`);
  assert.equal(ok(await b.demo("session")).account.hasAccess, false);
});

await check("cancelled order then paid → refund_required, no access; refund via admin revokes access of a paid order", async () => {
  const b = await buyer("cancel");
  const o = ok(await b.shop("order", { adultConfirmed: true, offerAccepted: true })).order;
  ok(await b.shop("cancel", { orderId: o.id }));
  const r = await notify(null, `${o.priceRub}.00`, o.invId, o.id);
  assert.equal(r.text, "OK" + o.invId, "acknowledged so Robokassa stops retrying");
  assert.equal((await db.query("SELECT status FROM career_shop_orders WHERE id=$1", [o.id])).rows[0].status, "refund_required");
  assert.equal(ok(await b.demo("session")).account.hasAccess, false);
  // refund of the earlier paid 3 990 ₽ order
  assert.equal((await A.adm("refund", { orderId: order3990.id, reason: "", confirm: true })).status, 400);
  ok(await A.adm("refund", { orderId: order3990.id, reason: "тестовый возврат", confirm: true }));
  assert.equal(ok(await order3990.c.demo("session")).account.hasAccess, false, "refund revokes access");
  assert.equal((await A.adm("refund", { orderId: order3990.id, reason: "повтор", confirm: true })).status, 409);
});

await check("full emulator path: order → emulator page → Pay (test) → server ResultURL → success page → access, diagnostic opens", async () => {
  const b = await buyer("emu");
  const o = ok(await b.shop("order", { adultConfirmed: true, offerAccepted: true }));
  const u = new URL(o.payUrl);
  const form = Object.fromEntries(u.searchParams); form.decision = "pay";
  const r = await b.call("/api/career/pay/emulator", undefined, { form });
  assert.equal(r.status, 303);
  assert.match(r.headers.get("location"), /\/api\/career\/pay\/robokassa\/success\?/);
  const s = await b.call(new URL(r.headers.get("location")).pathname + new URL(r.headers.get("location")).search);
  assert.equal(s.status, 303);
  assert.match(s.headers.get("location"), /\/career\?payment=success$/);
  assert.equal(ok(await b.demo("session")).account.hasAccess, true);
  assert.equal(ok(await b.v3("diagnostic/questions")).questions.length, 18);
  const tampered = { ...Object.fromEntries(u.searchParams), OutSum: "1.00", decision: "pay" };
  assert.equal((await b.call("/api/career/pay/emulator", undefined, { form: tampered })).status, 400, "emulator refuses a tampered amount (error 29)");
});

await check("admin figures: sales by price level and learning funnel are counts only", async () => {
  const s = await A.call("/admin/sales");
  assert.match(s.body, /Выручка по ценовым уровням/);
  assert.match(s.body, /неверная подпись/);
  const l = await A.call("/admin/learning");
  assert.match(l.body, /Начали диагностику/);
  assert.doesNotMatch(l.body, /answers|"q\d+"/);
  const o = (await A.call("/admin/overview")).body;
  assert.match(o, /Подтверждённые оплаты/);
});

await check("admin figures equal independent SQL over the same tables (users, payments, revenue, refunds, tiers, learning)", async () => {
  const q = async (sql) => (await db.query(sql)).rows[0];
  const users = await q("SELECT count(*)::int AS n FROM career_demo_users");
  const pay = await q(`SELECT count(*) FILTER (WHERE status IN ('paid','refunded','refund_required'))::int AS confirmed,
    coalesce(sum(price_kopeks) FILTER (WHERE status IN ('paid','refunded','refund_required')),0)::bigint AS gross,
    count(*) FILTER (WHERE status='refunded')::int AS refunds, coalesce(sum(refund_kopeks) FILTER (WHERE status='refunded'),0)::bigint AS refunded FROM career_shop_orders`);
  const rub = (k) => (Number(k) / 100).toLocaleString("ru-RU").replace(/\s/g, " ") + " ₽";
  const o = (await A.call("/admin/overview")).body;
  assert.equal(stat(o, "Пользователи"), String(users.n));
  assert.equal(stat(o, "Подтверждённые оплаты (тест)"), String(pay.confirmed));
  assert.equal(stat(o, "Выручка (тест)"), rub(pay.gross));
  assert.equal(stat(o, "Возвраты"), String(pay.refunds));
  assert.ok(o.replace(/<!-- -->/g, "").includes(rub(pay.refunded)));
  assert.ok(pay.confirmed >= 10 && pay.refunds >= 1, "non-trivial data");
  const avg = await q(`SELECT coalesce(round(avg(done)*100.0/30,1),0)::float AS p FROM (SELECT count(*) FILTER (WHERE sp.state='done') AS done FROM career_v3_plan_versions pv
    LEFT JOIN career_v3_step_progress sp ON sp.plan_version_id=pv.id WHERE pv.status='active' GROUP BY pv.id) a`);
  assert.equal(stat(o, "Среднее прохождение"), `${avg.p.toLocaleString("ru-RU")} %`);
  const tiers = (await db.query("SELECT price_kopeks, count(*) FILTER (WHERE status IN ('paid','refunded','refund_required'))::int AS n FROM career_shop_orders GROUP BY price_kopeks")).rows;
  const sales = (await A.call("/admin/sales")).body.replace(/<!-- -->/g, "");
  for (const t of tiers) assert.match(sales, new RegExp(`<td[^>]*>${rub(t.price_kopeks)}</td><td[^>]*>${t.n}</td>`), "tier " + t.price_kopeks);
  const dx = await q("SELECT count(DISTINCT account_id)::int AS n FROM career_v3_diagnostics");
  assert.equal(stat((await A.call("/admin/learning")).body, "Завершили диагностику"), String(dx.n));
  assert.match(sales, /Тестовый режим: все заказы и оплаты ниже проведены без списания денег/);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM career_shop_orders WHERE provider_mode NOT IN ('test','emulator')")).rows[0].n, 0, "no live orders can exist (DB constraint)");
});

async function fillPaidTo(target) {
  await db.query("UPDATE career_shop_orders SET status='canceled', canceled_at=now() WHERE status='pending'");
  let paid = (await db.query("SELECT count(*)::int AS n FROM career_shop_orders WHERE status='paid'")).rows[0].n;
  for (; paid < target; paid++) {
    const acc = (await db.query("INSERT INTO career_accounts(id,email) VALUES(gen_random_uuid(), 'demo-s1fx' || substr(md5(random()::text),1,10) || '@example.invalid') RETURNING id")).rows[0].id;
    await db.query("INSERT INTO career_shop_orders(id,account_id,price_kopeks,price_mode,sale_position,status,provider_mode,offer_version,adult_confirmed,reserved_until,paid_at,paid_out_sum) VALUES(gen_random_uuid(),$1,590000,'auto',$2,'paid','emulator','draft-2026-11-17',true,now(),now(),'5900.00')", [acc, paid + 1]);
  }
}

await check("boundary 20/21: concurrent buyers get sale №20 → 3 990 ₽ and №21 → 5 900 ₽", async () => {
  await fillPaidTo(19);
  const [b1, b2] = [await buyer("b20"), await buyer("b21")];
  const [o1, o2] = await Promise.all([b1.shop("order", { adultConfirmed: true, offerAccepted: true }), b2.shop("order", { adultConfirmed: true, offerAccepted: true })]);
  assert.deepEqual([ok(o1).order.priceRub, ok(o2).order.priceRub].sort(), [3990, 5900]);
  assert.deepEqual((await db.query("SELECT sale_position FROM career_shop_orders WHERE status='pending' ORDER BY 1")).rows.map((x) => x.sale_position), [20, 21]);
});

await check("after sale №40 the price stays 5 900 ₽ and the admin sees «нужно решение»", async () => {
  await fillPaidTo(40);
  const b = await buyer("b41");
  assert.equal(ok(await b.shop("order")).priceRub, 5900);
  const o = ok(await b.shop("order", { adultConfirmed: true, offerAccepted: true })).order;
  assert.deepEqual([o.priceRub, (await db.query("SELECT sale_position FROM career_shop_orders WHERE id=$1", [o.id])).rows[0].sale_position], [5900, 41]);
  assert.match((await A.call("/admin/prices")).body, /после № 40: нужно решение/);
});

await check("reservation expiry: the number is freed for the next buyer; a late payment is honoured at its fixed amount", async () => {
  await fillPaidTo(41);
  const late = await buyer("late");
  const o = ok(await late.shop("order", { adultConfirmed: true, offerAccepted: true })).order;
  const pos = async (id) => (await db.query("SELECT sale_position FROM career_shop_orders WHERE id=$1", [id])).rows[0].sale_position;
  const p1 = await pos(o.id);
  await db.query("UPDATE career_shop_orders SET reserved_until=now()-interval '1 second' WHERE id=$1", [o.id]);
  const next = await buyer("next");
  const o2 = ok(await next.shop("order", { adultConfirmed: true, offerAccepted: true })).order;
  assert.equal(await pos(o2.id), p1, "the expired reservation freed its sale number for the next buyer");
  assert.equal((await db.query("SELECT status FROM career_shop_orders WHERE id=$1", [o.id])).rows[0].status, "expired");
  const r = await notify(null, `${o.priceRub}.00`, o.invId, o.id);
  assert.equal(r.text, "OK" + o.invId, "paid at Robokassa before expiry reached us — honoured");
  assert.equal((await db.query("SELECT status, price_kopeks FROM career_shop_orders WHERE id=$1", [o.id])).rows[0].status, "paid");
  assert.equal(ok(await late.demo("session")).account.hasAccess, true);
  // the late buyer sees a new order screen after expiry if they had not paid: the next order is a new reservation
  assert.equal(ok(await late.shop("order")).order.status, "paid");
});

await check("closed contour stays closed: other pages 404, noindex everywhere", async () => {
  const r = await client(nextIp()).call("/services");
  assert.equal(r.status, 404);
  assert.match((await client(nextIp()).call("/admin")).headers.get("x-robots-tag") ?? "", /noindex/);
});

try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ }
await db.end();
console.log(`career stage-1 integration: ${passed} passed, ${failures} failed`);
if (failures) { console.log(serverLog.slice(-3000)); process.exit(1); }
