import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkRelease, findPlaceholders, releaseTarget, runReleaseGuard } from "../lib/release-guard.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const quiet = { log() {}, warn() {} };
const PROD = { NEXT_PUBLIC_SITE_URL: "https://mironovich.pro" };
const IDS = { NEXT_PUBLIC_YANDEX_METRICA_ID: "12345678", NEXT_PUBLIC_GA_ID: "G-TEST1234" };

/** Copy of the repo's legal sources in a temp dir, optionally edited. */
function fixture({ published, fill = false, edit = (s) => s } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guard-"));
  fs.mkdirSync(path.join(dir, "config"));
  fs.mkdirSync(path.join(dir, "content", "legal"), { recursive: true });
  const legal = JSON.parse(fs.readFileSync(path.join(repo, "config", "legal.json"), "utf8"));
  if (published !== undefined) legal.published = published;
  fs.writeFileSync(path.join(dir, "config", "legal.json"), JSON.stringify(legal));
  for (const slug of ["privacy", "consent"]) {
    let md = fs.readFileSync(path.join(repo, "content", "legal", slug + ".md"), "utf8");
    if (fill) for (const p of findPlaceholders(md)) md = md.split(p).join("заполнено");
    fs.writeFileSync(path.join(dir, "content", "legal", slug + ".md"), edit(md, slug));
  }
  return dir;
}

test("target: local, staging and preview builds are not production", () => {
  assert.equal(releaseTarget({}).production, false);
  assert.equal(releaseTarget({ NEXT_PUBLIC_SITE_URL: "https://mironovich-staging.up.railway.app" }).production, false);
  assert.equal(releaseTarget({ RAILWAY_ENVIRONMENT_NAME: "staging", NEXT_PUBLIC_SITE_URL: "https://x.up.railway.app" }).production, false);
  assert.equal(releaseTarget({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).production, false);
});

test("target: production is detected by the public URL or by Railway — either is enough", () => {
  assert.equal(releaseTarget(PROD).production, true);
  assert.equal(releaseTarget({ NEXT_PUBLIC_SITE_URL: " HTTPS://MIRONOVICH.PRO/ " }).production, true);
  assert.equal(releaseTarget({ NEXT_PUBLIC_SITE_URL: "https://www.mironovich.pro" }).production, true);
  assert.equal(releaseTarget({ RAILWAY_ENVIRONMENT_NAME: "production" }).production, true);
  assert.equal(releaseTarget({ RAILWAY_ENVIRONMENT_NAME: "staging", ...PROD }).production, true);
});

test("current repository: a production build is refused (old texts, 9 open fields)", () => {
  const r = runReleaseGuard({ cwd: repo, env: { ...PROD, ...IDS, NEXT_PUBLIC_ANALYTICS_CONSENT: "required" }, log: quiet });
  assert.equal(r.blocked, true);
  assert.match(r.message, /published=false/);
  assert.match(r.message, /privacy\.md: незаполненные поля \(7\)/);
  assert.match(r.message, /consent\.md: незаполненные поля \(2\)/);
  assert.match(r.message, /Обойти проверку нельзя/);
});

test("current repository: staging and local builds are never blocked, only reported", () => {
  const warned = [];
  const log = { log() {}, warn: (m) => warned.push(m) };
  const staging = runReleaseGuard({
    cwd: repo, log,
    env: { NEXT_PUBLIC_SITE_URL: "https://s.up.railway.app", SITE_NOINDEX: "1", LEGAL_PREVIEW: "1" },
  });
  assert.equal(staging.blocked, false);
  assert.ok(warned.some((m) => m.includes("published=false")));
  assert.equal(runReleaseGuard({ cwd: repo, env: {}, log: quiet }).blocked, false);
});

test("forced production check (npm run release:check -- --production) uses the same rules", () => {
  assert.equal(runReleaseGuard({ cwd: repo, env: {}, forceProduction: true, log: quiet }).blocked, true);
});

test("published but placeholders left → refused", () => {
  const r = runReleaseGuard({ cwd: fixture({ published: true }), env: { ...PROD, ...IDS, NEXT_PUBLIC_ANALYTICS_CONSENT: "required" }, log: quiet });
  assert.equal(r.blocked, true);
  assert.doesNotMatch(r.message, /published=false/);
  assert.match(r.message, /незаполненные поля/);
});

test("filled, published, consent required → passes, and says it is not legal approval", () => {
  const logs = [];
  const r = runReleaseGuard({
    cwd: fixture({ published: true, fill: true }),
    env: { ...PROD, ...IDS, NEXT_PUBLIC_ANALYTICS_CONSENT: "required" },
    log: { log: (m) => logs.push(m), warn: (m) => logs.push(m) },
  });
  assert.equal(r.blocked, false, r.message);
  assert.ok(logs.some((m) => m.includes("Это не юридическое одобрение")));
});

test("filled but still published=false → refused (old texts)", () => {
  const r = runReleaseGuard({ cwd: fixture({ published: false, fill: true }), env: { ...PROD, ...IDS, NEXT_PUBLIC_ANALYTICS_CONSENT: "required" }, log: quiet });
  assert.equal(r.blocked, true);
  assert.match(r.message, /published=false/);
});

const filled = { legal: { published: true, edition: "2026-11-01" } };
const docsOf = (dir) => Object.fromEntries(["privacy", "consent"].map((s) => [s, fs.readFileSync(path.join(dir, "content", "legal", s + ".md"), "utf8")]));

test("analytics without consent mode → refused; invalid consent value → refused", () => {
  const docs = docsOf(fixture({ fill: true }));
  assert.match(checkRelease({ ...filled, docs, env: { ...PROD, ...IDS } }).errors.join("\n"), /≠required/);
  assert.match(checkRelease({ ...filled, docs, env: { ...PROD, ...IDS, NEXT_PUBLIC_ANALYTICS_CONSENT: "Required" } }).errors.join("\n"), /допустимо только/);
  assert.equal(checkRelease({ ...filled, docs, env: { ...PROD, NEXT_PUBLIC_ANALYTICS_CONSENT: "required", ...IDS } }).errors.length, 0);
});

test("no counters at all and no consent mode → allowed (nothing loads); policy mismatch is a warning", () => {
  const r = checkRelease({ ...filled, docs: docsOf(fixture({ fill: true })), env: PROD });
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.some((w) => w.includes("Google Analytics")));
});

test("malformed counter IDs → refused (they would silently not load)", () => {
  const docs = docsOf(fixture({ fill: true }));
  const r = checkRelease({ ...filled, docs, env: { ...PROD, NEXT_PUBLIC_ANALYTICS_CONSENT: "required", NEXT_PUBLIC_YANDEX_METRICA_ID: "ym-1", NEXT_PUBLIC_GA_ID: "UA-1-1" } });
  assert.equal(r.errors.length, 2);
});

test("GA4 enabled but the policy does not name it → refused", () => {
  const docs = docsOf(fixture({ fill: true, edit: (md) => md.replaceAll("Google Analytics 4", "сервис статистики").replaceAll("GA4", "сервис") }));
  const r = checkRelease({ ...filled, docs, env: { ...PROD, ...IDS, NEXT_PUBLIC_ANALYTICS_CONSENT: "required" } });
  assert.match(r.errors.join("\n"), /GA4 включён, но политика его не называет/);
});

test("LEGAL_PREVIEW / SITE_NOINDEX in production and edition mismatch → refused", () => {
  const docs = docsOf(fixture({ fill: true }));
  const env = { ...PROD, ...IDS, NEXT_PUBLIC_ANALYTICS_CONSENT: "required" };
  assert.match(checkRelease({ ...filled, docs, env: { ...env, LEGAL_PREVIEW: "1" } }).errors.join(), /LEGAL_PREVIEW/);
  assert.match(checkRelease({ ...filled, docs, env: { ...env, SITE_NOINDEX: "1" } }).errors.join(), /SITE_NOINDEX/);
  assert.match(checkRelease({ legal: { published: true, edition: "2027-01-01" }, docs, env }).errors.join(), /edition/);
});

test("the placeholder pattern catches every form used in the drafts", () => {
  assert.deepEqual(findPlaceholders("a [УТОЧНИТЬ] b [ОПИСАТЬ ЗАКОННУЮ СХЕМУ] c [УТОЧНИТЬ допустимый адрес] ⟦x⟧ [Политике](/privacy)"),
    ["[УТОЧНИТЬ]", "[ОПИСАТЬ ЗАКОННУЮ СХЕМУ]", "[УТОЧНИТЬ допустимый адрес]", "⟦x⟧"]);
});
