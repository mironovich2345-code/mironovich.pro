// Closed cloud demo — unit tests: fail-closed configuration, password hashing, codes, preview library isolation.
// node --experimental-strip-types --test tests/career-demo-config.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const cfg = await import("../lib/server/career-demo/config.ts");
const auth = await import("../lib/server/career-demo/auth.ts");

const DOMAIN = "ai-career-v3-demo-production-1234.up.railway.app";
const cloud = () => ({
  CAREER_V3_DEMO: "1", SITE_NOINDEX: "1", NODE_ENV: "production",
  RAILWAY_PROJECT_NAME: cfg.DEMO_RAILWAY_PROJECT, RAILWAY_ENVIRONMENT_NAME: cfg.DEMO_RAILWAY_ENVIRONMENT, RAILWAY_SERVICE_NAME: cfg.DEMO_RAILWAY_SERVICE,
  RAILWAY_PUBLIC_DOMAIN: DOMAIN, CAREER_V3_DEMO_ORIGIN: "https://" + DOMAIN, NEXT_PUBLIC_SITE_URL: "https://" + DOMAIN,
  CAREER_V3_DEMO_DATABASE_URL: "postgresql://u:p@postgres-demo.railway.internal:5432/" + cfg.DEMO_DATABASE_NAME,
  CAREER_V3_DEMO_SESSION_SECRET: "s".repeat(20) + "0123456789abcdef0123456789abcdef",
});
const local = () => ({
  CAREER_V3_DEMO: "1", CAREER_V3_DEMO_LOCAL: "1", SITE_NOINDEX: "1", CAREER_V3_DEMO_ORIGIN: "http://127.0.0.1:3400",
  CAREER_V3_DEMO_DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/" + cfg.DEMO_DATABASE_NAME, CAREER_V3_DEMO_SESSION_SECRET: "x".repeat(10) + "0123456789abcdef0123456789abcdef0123456789",
});

test("a complete cloud configuration opens the demo with a __Host- Secure cookie", () => {
  assert.deepEqual(cfg.demoProblems(cloud()), []);
  const c = cfg.demoConfig(cloud());
  assert.equal(c.origin, "https://" + DOMAIN);
  assert.equal(c.cookieName, "__Host-career_demo_session");
  assert.equal(c.local, false);
  assert.equal(cfg.demoConfig(local()).cookieName, "career_demo_session");
});

test("every configuration error closes the demo (null), never a weaker mode", () => {
  const cases = {
    "not requested": { CAREER_V3_DEMO: "" },
    "wrong project": { RAILWAY_PROJECT_NAME: "mironovich-pro" },
    "production environment": { RAILWAY_ENVIRONMENT_NAME: "production" },
    "legacy production flag": { RAILWAY_ENVIRONMENT: "production" },
    "wrong service": { RAILWAY_SERVICE_NAME: "web" },
    "http origin": { CAREER_V3_DEMO_ORIGIN: "http://" + DOMAIN },
    "main domain": { CAREER_V3_DEMO_ORIGIN: "https://mironovich.pro", RAILWAY_PUBLIC_DOMAIN: "mironovich.pro", NEXT_PUBLIC_SITE_URL: "https://mironovich.pro" },
    "custom domain": { CAREER_V3_DEMO_ORIGIN: "https://demo.example.com", RAILWAY_PUBLIC_DOMAIN: "demo.example.com", NEXT_PUBLIC_SITE_URL: "https://demo.example.com" },
    "origin ≠ service domain": { CAREER_V3_DEMO_ORIGIN: "https://other.up.railway.app", NEXT_PUBLIC_SITE_URL: "https://other.up.railway.app" },
    "origin with path": { CAREER_V3_DEMO_ORIGIN: "https://" + DOMAIN + "/x" },
    "site url mismatch": { NEXT_PUBLIC_SITE_URL: "https://mironovich.pro" },
    "wrong db name": { CAREER_V3_DEMO_DATABASE_URL: "postgresql://u:p@h:5432/railway" },
    "test db name": { CAREER_V3_DEMO_DATABASE_URL: "postgresql://u:p@h:5432/mironovich_career_test" },
    "not postgres": { CAREER_V3_DEMO_DATABASE_URL: "mysql://u:p@h/" + cfg.DEMO_DATABASE_NAME },
    "other DB url present": { DATABASE_URL: "postgresql://u:p@h/main" },
    "v2 DB url present": { CAREER_DATABASE_URL: "postgresql://u:p@h/mironovich_career_test" },
    "short secret": { CAREER_V3_DEMO_SESSION_SECRET: "short" },
    "repeated secret": { CAREER_V3_DEMO_SESSION_SECRET: "a".repeat(64) },
    "no noindex": { SITE_NOINDEX: "" },
    "sandbox mixed in": { CAREER_SANDBOX_ENABLED: "1" },
    "payments mixed in": { CAREER_PAYMENT_MODE: "yookassa" },
    "live key present": { YOOKASSA_SECRET_KEY: "live_x" },
    "mail present": { CAREER_SMTP_URL: "smtp://x" },
    "external AI present": { OPENAI_API_KEY: "sk-x" },
    "fixture library mixed in": { CAREER_V3_FIXTURE_LIBRARY: "1" },
    "access too long": { CAREER_V3_DEMO_ACCESS_DAYS: "365" },
    "local flag on Railway": { CAREER_V3_DEMO_LOCAL: "1" },
  };
  for (const [name, patch] of Object.entries(cases)) {
    assert.equal(cfg.demoConfig({ ...cloud(), ...patch }), null, name);
    assert.ok(cfg.demoProblems({ ...cloud(), ...patch }).length > 0, name);
  }
  assert.equal(cfg.demoConfig({ ...local(), CAREER_V3_DEMO_ORIGIN: "http://localhost:3400" }), null, "local only on 127.0.0.1");
  assert.equal(cfg.demoConfig({ ...local(), CAREER_V3_DEMO_ORIGIN: "https://" + DOMAIN }), null);
  assert.throws(() => cfg.requireDemo({}), (e) => e.status === 404);
});

test("problems never echo secret values", () => {
  const env = { ...cloud(), CAREER_V3_DEMO_SESSION_SECRET: "tiny-secret", CAREER_V3_DEMO_DATABASE_URL: "postgresql://user:hunter2@h/railway" };
  const text = cfg.demoProblems(env).join("\n");
  assert.doesNotMatch(text, /tiny-secret|hunter2/);
});

test("scrypt hashes: salted, verifiable, malformed hashes rejected", async () => {
  const h1 = await auth.hashPassword("Correct horse 42");
  const h2 = await auth.hashPassword("Correct horse 42");
  assert.notEqual(h1, h2);
  assert.match(h1, /^scrypt\$15\$8\$1\$/);
  assert.ok(!h1.includes("Correct"));
  assert.equal(await auth.verifyPassword("Correct horse 42", h1), true);
  assert.equal(await auth.verifyPassword("correct horse 42", h1), false);
  assert.equal(await auth.verifyPassword("x", "plain"), false);
  assert.equal(await auth.verifyPassword("x", "scrypt$30$8$1$" + "A".repeat(24) + "$" + "A".repeat(44)), false, "absurd cost refused");
});

test("codes, emails and passwords are normalised and validated", () => {
  const code = auth.newCode(4);
  assert.match(code, /^([A-HJ-NP-Z2-9]{4}-){3}[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(auth.normalizeCode(code.toLowerCase().replaceAll("-", " "), 4), code);
  assert.equal(auth.normalizeCode("AAAA-BBBB-CCCC-DDD0", 4), null, "0 is not in the alphabet");
  assert.equal(auth.normalizeCode(code, 5), null);
  assert.equal(auth.normalizeEmail("  Tester@Example.COM "), "tester@example.com");
  assert.equal(auth.normalizeEmail("no-at-sign"), null);
  assert.equal(auth.passwordProblem("short", "short", "a@b.cd") !== null, true);
  assert.equal(auth.passwordProblem("long enough pw", "long enough px", "a@b.cd"), "Пароль и подтверждение не совпадают");
  assert.equal(auth.passwordProblem("aaaaaaaaaaaa", "aaaaaaaaaaaa", "a@b.cd"), "Пароль слишком простой");
  assert.equal(auth.passwordProblem("tester-2026-pass", "tester-2026-pass", "tester@example.com"), "Пароль не должен содержать email");
  assert.equal(auth.passwordProblem("Good pass 2026!", "Good pass 2026!", "tester@example.com"), null);
});

test("preview library: only inside a valid demo; copies only, inputs and files unchanged", async () => {
  const { demoPreviewSources } = await import("../lib/server/career-demo/preview-library.ts");
  const curriculum = JSON.parse(readFileSync("content/career/v3/curriculum.json", "utf8"));
  const lessons = readdirSync("content/career/v3/lessons").filter((f) => f.endsWith(".json"))
    .map((f) => ({ path: "content/career/v3/lessons/" + f, document: JSON.parse(readFileSync("content/career/v3/lessons/" + f, "utf8")) }));
  const snapshot = JSON.stringify({ curriculum, lessons });
  const saved = { ...process.env };
  try {
    for (const k of Object.keys(process.env)) if (k.startsWith("RAILWAY_") || k.startsWith("CAREER_")) delete process.env[k];
    assert.throws(() => demoPreviewSources(curriculum, lessons, "2026-11-19"), /outside the closed demo/);
    Object.assign(process.env, local());
    const out = demoPreviewSources(curriculum, lessons, "2026-11-19");
    assert.equal(out.lessons.length, lessons.filter((l) => l.document.status === "review").length);
    assert.ok(out.lessons.length >= 14);
    assert.ok(out.lessons.every((l) => l.document.quality.reviewer.includes("DEMO PREVIEW ONLY")));
    assert.equal(JSON.stringify({ curriculum, lessons }), snapshot, "inputs are not mutated");
    assert.ok(lessons.every((l) => l.document.status === "review" && l.document.quality.canBePublished === false));
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("outside the demo the library is the real content: nothing published, preview mode absent", async () => {
  for (const k of Object.keys(process.env)) if (k.startsWith("CAREER_V3_DEMO")) delete process.env[k];
  const { loadProfessionBundle } = await import("../lib/server/career-v3/content.ts");
  const b = loadProfessionBundle("sales_manager");
  assert.equal(b.libraryMode, "content");
  assert.equal(b.library.published.length, 0, "no lesson in review is delivered in normal mode");
});
