// AI Career 3.0 stage 1 — unit tests: fail-closed stage-1 profile, mail and Robokassa configuration, email-code crypto,
// Robokassa signatures (formulas from docs.robokassa.ru), no secrets in the repository.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";

const cfg = await import("../lib/server/career-demo/config.ts");
const rk = await import("../lib/server/commerce/robokassa.ts");
const otp = await import("../lib/server/career-demo/otp.ts");

const DOMAIN = "ai-career-stage1-production-1234.up.railway.app";
const stage1 = (patch = {}) => ({
  CAREER_V3_DEMO: "1", CAREER_V3_DEMO_PROFILE: "stage1", SITE_NOINDEX: "1", NODE_ENV: "production",
  RAILWAY_PROJECT_NAME: "mironovich-career-stage1", RAILWAY_ENVIRONMENT_NAME: "ai-career-stage1-preview", RAILWAY_SERVICE_NAME: "ai-career-stage1",
  RAILWAY_PUBLIC_DOMAIN: DOMAIN, CAREER_V3_DEMO_ORIGIN: "https://" + DOMAIN, NEXT_PUBLIC_SITE_URL: "https://" + DOMAIN,
  CAREER_V3_DEMO_DATABASE_URL: "postgresql://u:p@db.railway.internal:5432/mironovich_career_stage1",
  CAREER_V3_DEMO_SESSION_SECRET: "s".repeat(20) + "0123456789abcdef0123456789abcdef",
  CAREER_V3_OTP_SECRET: "o".repeat(10) + "fedcba9876543210fedcba9876543210",
  CAREER_V3_MAIL: "smtp", CAREER_V3_SMTP_HOST: "smtp.mail.ru", CAREER_V3_SMTP_PORT: "465", CAREER_V3_SMTP_USER: "info@mironovich.pro",
  CAREER_V3_SMTP_PASSWORD: "app-password-x", CAREER_V3_SMTP_FROM: "AI Career <info@mironovich.pro>",
  ...patch,
});

test("stage-1 profile opens only with its own Railway environment, service and database", () => {
  assert.deepEqual(cfg.demoProblems(stage1()), []);
  const c = cfg.demoConfig(stage1());
  assert.equal(c.profile, "stage1");
  assert.equal(c.passwordLogin, false, "passwordless");
  assert.equal(c.loginCookieName, "__Host-career_login");
  assert.ok(c.commerce, "commerce only in stage 1");
  assert.equal(c.commerce.robokassa, null, "no Robokassa variables → payments not ready");
  for (const [name, patch] of Object.entries({
    "demo project": { RAILWAY_PROJECT_NAME: cfg.DEMO_RAILWAY_PROJECT },
    "demo environment": { RAILWAY_ENVIRONMENT_NAME: cfg.DEMO_RAILWAY_ENVIRONMENT },
    "demo service": { RAILWAY_SERVICE_NAME: cfg.DEMO_RAILWAY_SERVICE },
    "demo database": { CAREER_V3_DEMO_DATABASE_URL: "postgresql://u:p@h:5432/" + cfg.DEMO_DATABASE_NAME },
    "unknown profile": { CAREER_V3_DEMO_PROFILE: "production" },
    "no otp secret": { CAREER_V3_OTP_SECRET: "" },
    "short otp secret": { CAREER_V3_OTP_SECRET: "short" },
    "otp secret = session secret": { CAREER_V3_OTP_SECRET: "s".repeat(20) + "0123456789abcdef0123456789abcdef" },
    "no mail": { CAREER_V3_MAIL: "" },
    "wrong sender": { CAREER_V3_SMTP_FROM: "noreply@gmail.com" },
    "smtp without password": { CAREER_V3_SMTP_PASSWORD: "" },
    "odd smtp port": { CAREER_V3_SMTP_PORT: "25" },
    "live robokassa password": { ROBOKASSA_PASSWORD1: "live" },
    "live robokassa mode": { CAREER_V3_ROBOKASSA: "live", CAREER_V3_ROBOKASSA_TEST_PASSWORD1: "aaaaaaaa1", CAREER_V3_ROBOKASSA_TEST_PASSWORD2: "bbbbbbbb2" },
    "same test passwords": { CAREER_V3_ROBOKASSA: "test", CAREER_V3_ROBOKASSA_LOGIN: "shop", CAREER_V3_ROBOKASSA_TEST_PASSWORD1: "samesame1", CAREER_V3_ROBOKASSA_TEST_PASSWORD2: "samesame1" },
    "bad hash": { CAREER_V3_ROBOKASSA: "test", CAREER_V3_ROBOKASSA_LOGIN: "shop", CAREER_V3_ROBOKASSA_TEST_PASSWORD1: "aaaaaaaa1", CAREER_V3_ROBOKASSA_TEST_PASSWORD2: "bbbbbbbb2", CAREER_V3_ROBOKASSA_HASH: "crc32" },
    "yookassa mixed in": { YOOKASSA_SHOP_ID: "1" },
    "production environment": { RAILWAY_ENVIRONMENT: "production" },
    "main domain": { CAREER_V3_DEMO_ORIGIN: "https://mironovich.pro", RAILWAY_PUBLIC_DOMAIN: "mironovich.pro", NEXT_PUBLIC_SITE_URL: "https://mironovich.pro" },
  })) assert.equal(cfg.demoConfig(stage1(patch)), null, name);
});

test("preview mailbox: allowed only in the stage-1 preview (or local tests), never in the closed demo or with a weak key", () => {
  assert.ok(cfg.demoConfig(stage1({ CAREER_V3_MAIL: "preview-outbox", CAREER_V3_PREVIEW_OUTBOX_KEY: "k".repeat(10) + "0123456789abcdefXYZ" })));
  assert.equal(cfg.demoConfig(stage1({ CAREER_V3_MAIL: "preview-outbox", CAREER_V3_PREVIEW_OUTBOX_KEY: "short" })), null);
  const demo = { ...stage1(), CAREER_V3_DEMO_PROFILE: "closed-demo", RAILWAY_PROJECT_NAME: cfg.DEMO_RAILWAY_PROJECT, RAILWAY_ENVIRONMENT_NAME: cfg.DEMO_RAILWAY_ENVIRONMENT, RAILWAY_SERVICE_NAME: cfg.DEMO_RAILWAY_SERVICE,
    CAREER_V3_DEMO_DATABASE_URL: "postgresql://u:p@h:5432/" + cfg.DEMO_DATABASE_NAME, CAREER_V3_MAIL: "preview-outbox", CAREER_V3_PREVIEW_OUTBOX_KEY: "k".repeat(10) + "0123456789abcdefXYZ" };
  assert.equal(cfg.demoConfig(demo), null, "closed demo: no preview mailbox");
  assert.equal(cfg.demoConfig({ ...demo, CAREER_V3_MAIL: "smtp", CAREER_V3_ROBOKASSA: "emulator", CAREER_V3_ROBOKASSA_TEST_PASSWORD1: "aaaaaaaa1", CAREER_V3_ROBOKASSA_TEST_PASSWORD2: "bbbbbbbb2" }), null, "closed demo: no payments");
  const demoOk = cfg.demoConfig({ ...demo, CAREER_V3_MAIL: "smtp" });
  assert.ok(demoOk && demoOk.passwordLogin && !demoOk.commerce, "closed demo keeps password sign-in, no commerce");
});

test("problems never echo secret values", () => {
  const text = cfg.demoProblems(stage1({ CAREER_V3_SMTP_FROM: "x@gmail.com", CAREER_V3_OTP_SECRET: "tiny-otp", CAREER_V3_ROBOKASSA: "test", CAREER_V3_ROBOKASSA_TEST_PASSWORD1: "pw1-secret" })).join("\n");
  assert.doesNotMatch(text, /tiny-otp|pw1-secret|app-password-x/);
});

test("email code: six digits, HMAC salted by the challenge, masked email", () => {
  for (let i = 0; i < 50; i++) assert.match(otp.newOtp(), /^\d{6}$/);
  const a = otp.codeDigest("k".repeat(32), "t1", "123456"), b = otp.codeDigest("k".repeat(32), "t2", "123456");
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, b, "same code under two challenges → different digests");
  assert.equal(otp.maskEmail("damironovich@mail.ru"), "d***@mail.ru");
  assert.deepEqual([otp.OTP_TTL_MINUTES, otp.OTP_MAX_ATTEMPTS, otp.OTP_RESEND_SECONDS, otp.OTP_MAX_SENDS_PER_HOUR], [10, 5, 60, 5]);
});

const conf = { mode: "test", merchantLogin: "demo-shop", password1: "pass1test", password2: "pass2test", hash: "md5", receipt: false };
const md5 = (s) => createHash("md5").update(s).digest("hex");

test("Robokassa request: MerchantLogin:OutSum:InvId:Password#1:Shp_order=…, IsTest=1 always, amount from the order", () => {
  const r = rk.paymentRequest(conf, { id: "0b0b0b0b-1111-4222-8333-444444444444", invId: 1005, priceKopeks: 399000 }, { email: "b@example.com" });
  const u = new URL(r.url);
  assert.equal(u.origin + u.pathname, "https://auth.robokassa.ru/Merchant/Index.aspx");
  assert.equal(u.searchParams.get("OutSum"), "3990.00");
  assert.equal(u.searchParams.get("IsTest"), "1");
  assert.equal(u.searchParams.get("SignatureValue"), md5("demo-shop:3990.00:1005:pass1test:Shp_order=0b0b0b0b-1111-4222-8333-444444444444"));
  assert.doesNotMatch(r.signatureBase, /pass1test/, "the password never leaves the server");
  assert.equal(rk.verifyRequest(conf, u.searchParams), true);
  u.searchParams.set("OutSum", "1.00");
  assert.equal(rk.verifyRequest(conf, u.searchParams), false, "tampered amount");
});

test("Robokassa receipt: URL-encoded minified JSON signed between InvId and Password#1", () => {
  const r = rk.paymentRequest({ ...conf, receipt: true }, { id: "0b0b0b0b-1111-4222-8333-444444444444", invId: 7, priceKopeks: 199300 }, {});
  const receipt = rk.receiptParam(199300);
  assert.equal(r.params.Receipt, receipt);
  assert.deepEqual(JSON.parse(decodeURIComponent(receipt)), { items: [{ name: rk.PRODUCT_DESCRIPTION, quantity: 1, sum: 1993, payment_method: "full_payment", payment_object: "service", tax: "none" }] });
  assert.equal(r.params.SignatureValue, md5(`demo-shop:1993.00:7:${receipt}:pass1test:Shp_order=0b0b0b0b-1111-4222-8333-444444444444`));
});

test("ResultURL: OutSum:InvId:Password#2:Shp_* (as received, case-insensitive hex); SuccessURL uses Password#1", () => {
  const p = new URLSearchParams({ OutSum: "1993.000000", InvId: "1005", Shp_order: "x1", SignatureValue: md5("1993.000000:1005:pass2test:Shp_order=x1").toUpperCase() });
  const n = rk.parseNotification(p);
  assert.equal(rk.verifyResult(conf, n), true);
  assert.equal(rk.verifySuccess(conf, n), false, "Password#1 is not valid for ResultURL");
  assert.equal(rk.signResult(conf, "1993.000000", 1005, { Shp_order: "x1" }), md5("1993.000000:1005:pass2test:Shp_order=x1"));
  assert.equal(rk.parseNotification(new URLSearchParams({ OutSum: "1e3", InvId: "1", SignatureValue: "ab".repeat(16) })), null);
  assert.equal(rk.parseNotification(new URLSearchParams({ OutSum: "1", InvId: "1", SignatureValue: "zz" })), null);
  for (const h of ["sha1", "sha256", "sha384", "sha512"]) {
    const c2 = { ...conf, hash: h };
    const sig = createHash(h).update("10.00:3:pass2test").digest("hex");
    assert.equal(rk.verifyResult(c2, rk.parseNotification(new URLSearchParams({ OutSum: "10.00", InvId: "3", SignatureValue: sig }))), true, h);
  }
});

test("no SMTP, Robokassa, OTP or session secrets in the repository", () => {
  const files = [];
  const walk = (d) => { for (const n of readdirSync(d)) { if ([".git", "node_modules", ".next", "public"].includes(n)) continue; const p = d + "/" + n; if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx|mjs|js|json|ya?ml|md|sql)$/.test(n)) files.push(p); } };
  for (const d of ["app", "lib", "components", "config", "scripts", "migrations", ".github", "docs"]) walk(d);
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    // Literal values only; clearly marked local placeholders of offline scripts ("audit-only…") are not secrets.
    const hits = [...s.matchAll(/CAREER_V3_(SMTP_PASSWORD|OTP_SECRET|ROBOKASSA_TEST_PASSWORD[12]|PREVIEW_OUTBOX_KEY|DEMO_SESSION_SECRET)\s*[:=]\s*["']([^"'$]{6,})/g)].filter((m) => !m[2].startsWith("audit-only"));
    assert.deepEqual(hits.map((m) => m[0]), [], f);
  }
});

test("CSP keeps upgrade-insecure-requests for every public origin; only a loopback http test build drops it", async () => {
  const src = readFileSync("next.config.mjs", "utf8");
  const m = /const loopbackSite = (\/.+\/)\.test\(process\.env\.NEXT_PUBLIC_SITE_URL/.exec(src);
  assert.ok(m, "loopback switch present");
  const re = new Function("return " + m[1])();
  for (const url of ["https://mironovich.pro", "https://ai-career-stage1-ai-career-stage1-preview.up.railway.app", "http://mironovich.pro", "http://127.0.0.1.evil.com"]) assert.equal(re.test(url), false, url);
  for (const url of ["http://127.0.0.1:3410", "http://localhost:3000"]) assert.equal(re.test(url), true, url);
  assert.match(src, /\.\.\.\(loopbackSite \? \[\] : \["upgrade-insecure-requests"\]\)/);
});
