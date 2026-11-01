import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkRelease, findPlaceholders, releaseTarget, runReleaseGuard } from "../lib/release-guard.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const quiet = { log() {}, warn() {} };
const PROD = { NEXT_PUBLIC_SITE_URL: "https://mironovich.pro" };
const IDS = { NEXT_PUBLIC_YANDEX_METRICA_ID: "12345678" };

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

const withLegal = (patch) => {
  const dir = fixture();
  const file = path.join(dir, "config", "legal.json");
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), ...patch }));
  return dir;
};

test("target: non-production only when the site URL is explicitly non-public", () => {
  assert.equal(releaseTarget({ NEXT_PUBLIC_SITE_URL: "https://mironovich-staging.up.railway.app" }).production, false);
  assert.equal(releaseTarget({ RAILWAY_ENVIRONMENT_NAME: "staging", NEXT_PUBLIC_SITE_URL: "https://x.up.railway.app" }).production, false);
  assert.equal(releaseTarget({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).production, false);
});

test("target: fail-closed — no variables at all means production (the build bakes in the public URL)", () => {
  const t = releaseTarget({});
  assert.equal(t.production, true);
  assert.match(t.reason, /не задан/);
  assert.match(t.reason, /не передана в сборку/);
  // Railway variables missing at build time, staging name only at runtime: still checked
  assert.equal(releaseTarget({ RAILWAY_ENVIRONMENT_NAME: "staging" }).production, true);
  assert.equal(releaseTarget({ NEXT_PUBLIC_SITE_URL: "   " }).production, true);
});

test("target: production by the public URL or by Railway — either is enough", () => {
  assert.equal(releaseTarget(PROD).production, true);
  assert.equal(releaseTarget({ NEXT_PUBLIC_SITE_URL: " HTTPS://MIRONOVICH.PRO/ " }).production, true);
  assert.equal(releaseTarget({ NEXT_PUBLIC_SITE_URL: "https://www.mironovich.pro" }).production, true);
  assert.equal(releaseTarget({ RAILWAY_ENVIRONMENT_NAME: "production", NEXT_PUBLIC_SITE_URL: "https://x.up.railway.app" }).production, true);
  assert.equal(releaseTarget({ RAILWAY_ENVIRONMENT_NAME: "Production", NEXT_PUBLIC_SITE_URL: "https://x.up.railway.app" }).production, true);
  assert.equal(releaseTarget({ RAILWAY_ENVIRONMENT: "production", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).production, true);
});

test("no switch-off: unrelated or made-up variables do not change the target", () => {
  for (const extra of [{ __MRNV_RELEASE_GUARD_DONE: "1" }, { SKIP_RELEASE_GUARD: "1" }, { NODE_ENV: "development" }, { CI: "1" }]) {
    assert.equal(releaseTarget({ ...PROD, ...extra }).production, true);
    // a repo state that must be refused stays refused, whatever else is set
    assert.equal(runReleaseGuard({ cwd: withLegal({ legacyRelease: undefined }), env: { ...PROD, ...extra }, log: quiet }).blocked, true);
  }
});

test("current repository: owner-approved release with the CURRENT legal texts passes, drafts reported", () => {
  const warned = [];
  const r = runReleaseGuard({ cwd: repo, env: { ...PROD, ...IDS }, log: { log() {}, warn: (m) => warned.push(m) } });
  assert.equal(r.blocked, false, r.message);
  assert.ok(warned.some((m) => m.includes("ПРЕЖНИМИ текстами")));
  assert.ok(warned.some((m) => /privacy\.md: незаполненные поля \(5\) — проект не публикуется/.test(m)));
  assert.ok(warned.some((m) => /consent\.md: незаполненные поля \(1\) — проект не публикуется/.test(m)));
});


test("legacy texts WITHOUT a recorded owner decision → refused (unfilled drafts are errors again)", () => {
  const r = runReleaseGuard({ cwd: withLegal({ legacyRelease: undefined }), env: { ...PROD, ...IDS }, log: quiet });
  assert.equal(r.blocked, true);
  assert.match(r.message, /legacyRelease/);
  assert.match(r.message, /незаполненные поля \(5\)/);
  for (const bad of [{}, { approvedBy: "" , date: "2026-11-01" }, { approvedBy: "владелец", date: "скоро" }, "yes", true]) {
    assert.equal(runReleaseGuard({ cwd: withLegal({ legacyRelease: bad }), env: { ...PROD, ...IDS }, log: quiet }).blocked, true, JSON.stringify(bad));
  }
});

test("legacy release never allows draft pages or other preview switches in production", () => {
  for (const extra of [{ LEGAL_PREVIEW: "1" }, { SITE_NOINDEX: "1" }, { NEXT_PUBLIC_CONSENT_PREVIEW: "1" }, { NEXT_PUBLIC_YANDEX_METRICA_ID: "ym-bad" }]) {
    assert.equal(runReleaseGuard({ cwd: repo, env: { ...PROD, ...IDS, ...extra }, log: quiet }).blocked, true, JSON.stringify(extra));
  }
});

test("published=true ignores the legacy decision: drafts must be complete", () => {
  const r = runReleaseGuard({ cwd: withLegal({ published: true }), env: { ...PROD, ...IDS }, log: quiet });
  assert.equal(r.blocked, true);
  assert.match(r.message, /незаполненные поля \(5\)/);
});

test("current repository: staging and local builds are never blocked, only reported", () => {
  const warned = [];
  const log = { log() {}, warn: (m) => warned.push(m) };
  const staging = runReleaseGuard({
    cwd: repo, log,
    env: { NEXT_PUBLIC_SITE_URL: "https://s.up.railway.app", SITE_NOINDEX: "1", LEGAL_PREVIEW: "1" },
  });
  assert.equal(staging.blocked, false);
  assert.ok(warned.some((m) => m.includes("незаполненные поля")));
  assert.equal(runReleaseGuard({ cwd: repo, env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, log: quiet }).blocked, false);
});

test("forced production check (npm run release:check -- --production) uses the same rules", () => {
  assert.equal(runReleaseGuard({ cwd: repo, env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, forceProduction: true, log: quiet }).blocked, false);
  assert.equal(runReleaseGuard({ cwd: withLegal({ legacyRelease: undefined }), env: {}, forceProduction: true, log: quiet }).blocked, true);
});

test("the target is always printed, so Railway build logs show what the guard saw", () => {
  const lines = [];
  runReleaseGuard({ cwd: repo, env: { NEXT_PUBLIC_SITE_URL: "https://s.up.railway.app", RAILWAY_ENVIRONMENT_NAME: "staging" }, log: { log: (m) => lines.push(m), warn() {} } });
  assert.match(lines[0], /цель сборки: не production \(NEXT_PUBLIC_SITE_URL=https:\/\/s\.up\.railway\.app; RAILWAY_ENVIRONMENT_NAME=staging\)/);
});

test("rate limit source: invalid value refused in production, unset is the safe fallback (warning)", () => {
  const docs = docsOf(fixture({ fill: true }));
  const env = { ...PROD, ...IDS };
  assert.match(checkRelease({ ...filled, docs, env: { ...env, RATE_LIMIT_CLIENT_IP: "true" } }).errors.join(), /RATE_LIMIT_CLIENT_IP/);
  const unset = checkRelease({ ...filled, docs, env });
  assert.equal(unset.errors.length, 0);
  assert.ok(unset.warnings.some((w) => w.includes("общий лимит")));
  assert.equal(checkRelease({ ...filled, docs, env: { ...env, RATE_LIMIT_CLIENT_IP: "x-real-ip" } }).warnings.some((w) => w.includes("RATE_LIMIT")), false);
});

test("published but placeholders left → refused", () => {
  const r = runReleaseGuard({ cwd: fixture({ published: true }), env: { ...PROD, ...IDS }, log: quiet });
  assert.equal(r.blocked, true);
  assert.doesNotMatch(r.message, /published=false/);
  assert.match(r.message, /незаполненные поля/);
});

test("filled, published, consent required → passes, and says it is not legal approval", () => {
  const logs = [];
  const r = runReleaseGuard({
    cwd: fixture({ published: true, fill: true }),
    env: { ...PROD, ...IDS },
    log: { log: (m) => logs.push(m), warn: (m) => logs.push(m) },
  });
  assert.equal(r.blocked, false, r.message);
  assert.ok(logs.some((m) => m.includes("Это не юридическое одобрение")));
});

test("filled but still published=false and no owner decision → refused (old texts)", () => {
  const dir = fixture({ published: false, fill: true });
  const file = path.join(dir, "config", "legal.json");
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), legacyRelease: undefined }));
  const r = runReleaseGuard({ cwd: dir, env: { ...PROD, ...IDS }, log: quiet });
  assert.equal(r.blocked, true);
  assert.match(r.message, /published=false/);
});

const filled = { legal: { published: true, edition: "2026-11-01" } };
const docsOf = (dir) => Object.fromEntries(["privacy", "consent"].map((s) => [s, fs.readFileSync(path.join(dir, "content", "legal", s + ".md"), "utf8")]));

test("GA4 is gone: no GA variable is needed, and a leftover one does not block (warning only)", () => {
  const docs = docsOf(fixture({ fill: true }));
  const clean = checkRelease({ ...filled, docs, env: { ...PROD, ...IDS } });
  assert.deepEqual(clean.errors, []);
  const leftover = checkRelease({ ...filled, docs, env: { ...PROD, ...IDS, NEXT_PUBLIC_GA_ID: "G-OLD1234", NEXT_PUBLIC_ANALYTICS_CONSENT: "required" } });
  assert.deepEqual(leftover.errors, []);
  assert.ok(leftover.warnings.some((w) => w.includes("NEXT_PUBLIC_GA_ID")));
  assert.ok(leftover.warnings.some((w) => w.includes("NEXT_PUBLIC_ANALYTICS_CONSENT")));
});

test("no Metrica at all → allowed; policy naming Metrica without a counter is a warning", () => {
  const r = checkRelease({ ...filled, docs: docsOf(fixture({ fill: true })), env: PROD });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.includes("Яндекс Метрику")));
});

test("malformed Metrica ID → refused (it would silently not load)", () => {
  const r = checkRelease({ ...filled, docs: docsOf(fixture({ fill: true })), env: { ...PROD, NEXT_PUBLIC_YANDEX_METRICA_ID: "ym-1" } });
  assert.equal(r.errors.length, 1);
});

test("legal texts that still mention Google Analytics / GA4 → refused", () => {
  for (const add of ["Используется Google Analytics 4.", "Данные GA4.", "cookies `_ga*`."]) {
    const docs = docsOf(fixture({ fill: true, edit: (md, slug) => (slug === "privacy" ? md + "\n" + add + "\n" : md) }));
    assert.match(checkRelease({ ...filled, docs, env: { ...PROD, ...IDS } }).errors.join(), /Google Analytics \/ GA4/, add);
  }
});

test("Metrica enabled but the policy does not name it → refused", () => {
  const docs = docsOf(fixture({ fill: true, edit: (md, slug) => (slug === "privacy" ? md.replaceAll("Яндекс Метрик", "сервис статистик") : md) }));
  assert.match(checkRelease({ ...filled, docs, env: { ...PROD, ...IDS } }).errors.join(), /Метрика включена/);
});

test("LEGAL_PREVIEW / SITE_NOINDEX in production and edition mismatch → refused", () => {
  const docs = docsOf(fixture({ fill: true }));
  const env = { ...PROD, ...IDS };
  assert.match(checkRelease({ ...filled, docs, env: { ...env, LEGAL_PREVIEW: "1" } }).errors.join(), /LEGAL_PREVIEW/);
  assert.match(checkRelease({ ...filled, docs, env: { ...env, SITE_NOINDEX: "1" } }).errors.join(), /SITE_NOINDEX/);
  assert.match(checkRelease({ ...filled, docs, env: { ...env, NEXT_PUBLIC_CONSENT_PREVIEW: "1" } }).errors.join(), /CONSENT_PREVIEW/);
  assert.match(checkRelease({ legal: { published: true, edition: "2027-01-01" }, docs, env }).errors.join(), /edition/);
});

test("the placeholder pattern catches every form used in the drafts", () => {
  assert.deepEqual(findPlaceholders("a [УТОЧНИТЬ] b [ОПИСАТЬ ЗАКОННУЮ СХЕМУ] c [УТОЧНИТЬ допустимый адрес] ⟦x⟧ [Политике](/privacy)"),
    ["[УТОЧНИТЬ]", "[ОПИСАТЬ ЗАКОННУЮ СХЕМУ]", "[УТОЧНИТЬ допустимый адрес]", "⟦x⟧"]);
});
