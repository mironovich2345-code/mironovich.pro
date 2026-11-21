// Closed cloud demo — HTTP integration test against a real `next start` server and a local PostgreSQL
// database named exactly mironovich_career_demo_v3 (see docs/products/ai-career-v3/demo/README.md).
// Needs a production build made with the demo variables (.env.career-demo.local) and `demo-admin.mjs migrate`.
// Covers: registration, repeat registration, invite reuse, wrong password, rate limit, CSRF/host checks,
// sign-in after a server restart, sign-out revocation, data isolation, nine profiles' full path over HTTP,
// recovery, account deletion, retention, closed demo under bad configuration, migration guards, content untouched.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";
import http from "node:http";

process.loadEnvFile(".env.career-demo.local");
const ORIGIN = process.env.CAREER_V3_DEMO_ORIGIN;
const PORT = new URL(ORIGIN).port;
const P = "sales_manager";
const contentBefore = execFileSync("git", ["status", "--porcelain", "content/"]).toString();
assert.equal(process.env.CAREER_V3_DEMO_LOCAL, "1", "this test only runs against the LOCAL demo database");
assert.equal(new URL(ORIGIN).hostname, "127.0.0.1");
const db = new pg.Pool({ connectionString: process.env.CAREER_V3_DEMO_DATABASE_URL, max: 2 });
// Fresh local state for repeatable runs (local demo DB only — asserted above).
await db.query("TRUNCATE career_accounts, career_demo_invites, career_rate_buckets, career_events CASCADE");
const admin = (...args) => execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/career/demo-admin.mjs", ...args], { env: process.env }).toString().trim();

let server;
async function startServer(env = process.env, port = PORT) {
  const child = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(port)], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://127.0.0.1:${port}/robots.txt`); return { child, log: () => log }; } catch { await sleep(500); }
  }
  throw new Error("server did not start\n" + log);
}
async function stopServer(s) {
  try { process.kill(-s.child.pid, "SIGTERM"); } catch { /* gone */ }
  for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${PORT}/robots.txt`); await sleep(250); } catch { return; } }
}

/** Minimal cookie-jar client; every client has its own simulated address for the per-IP limits. */
function client(ip) {
  let cookie = "";
  const call = async (path, body, extra = {}) => {
    const r = await fetch(ORIGIN + path, {
      method: body === undefined ? "GET" : "POST", redirect: "manual",
      headers: { "x-real-ip": ip, ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json", origin: ORIGIN }), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = r.headers.get("set-cookie");
    if (set) { const m = /^(career_demo_session)=([^;]*)/.exec(set); if (m) cookie = m[2] ? `${m[1]}=${m[2]}` : ""; }
    const type = r.headers.get("content-type") ?? "";
    const value = type.includes("json") ? await r.json() : Buffer.from(await r.arrayBuffer());
    return { status: r.status, body: value, headers: r.headers };
  };
  return {
    call, get cookie() { return cookie; }, set cookie(v) { cookie = v; },
    v3: (path, body) => call(`/api/career/v3/${P}/${path}`, body),
    demo: (action, body) => call(`/api/career/demo/${action}`, body),
  };
}
const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body).slice(0, 300)); return r.body; };
const PASSWORD = "Demo-pass-" + Math.random().toString(36).slice(2, 10);
let ipSeq = 0;
const newIp = () => `198.51.100.${++ipSeq}`;
const email = (tag) => `tester-${tag}-${Date.now().toString(36)}@example.com`;
async function register(tag) {
  const c = client(newIp());
  const e = email(tag);
  const r = ok(await c.demo("register", { email: e, password: PASSWORD, passwordConfirm: PASSWORD, invite: admin("invite", "test") }), 201);
  assert.match(r.recoveryCode, /^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/);
  return { c, email: e, recoveryCode: r.recoveryCode };
}
const results = [];
const check = async (name, fn) => { await fn(); results.push(name); console.log("PASS", name); };

try {
  server = await startServer();

  await check("closed contour pages: noindex, redirects, v2 and preview APIs closed", async () => {
    const c = client(newIp());
    const home = await c.call("/");
    assert.equal(home.status, 200);
    assert.match(home.body.toString(), /закрытая демоверсия/, "/ shows the demo");
    assert.match((await c.call("/career/v3")).headers.get("x-robots-tag"), /noindex/);
    assert.equal((await c.call("/blog")).status, 404, "the rest of the public site is absent");
    assert.equal((await c.call("/offer/ai-career")).status, 404);
    assert.equal((await c.call("/api/career/session")).status, 404, "v2 API is not part of the demo");
    assert.equal((await c.call("/api/lead")).status, 404);
    assert.match((await c.call("/robots.txt")).body.toString(), /Disallow: \//);
    assert.equal((await c.v3("state")).status, 401, "no anonymous v3 access");
  });

  let A, B;
  await check("registration with a one-time invite; invite reuse and repeat registration refused", async () => {
    const c = client(newIp());
    assert.equal((await c.demo("register", { email: email("x"), password: PASSWORD, passwordConfirm: PASSWORD })).status, 403, "invite required");
    assert.equal((await c.demo("register", { email: email("x"), password: PASSWORD, passwordConfirm: PASSWORD, invite: "AAAA-BBBB-CCCC-DDDD" })).status, 403);
    const invite = admin("invite", "reuse");
    const e = email("a");
    assert.equal((await c.demo("register", { email: e, password: "short", passwordConfirm: "short", invite })).status, 400, "weak password");
    assert.equal((await c.demo("register", { email: e, password: PASSWORD, passwordConfirm: PASSWORD + "x", invite })).status, 400, "confirmation mismatch");
    const r = ok(await c.demo("register", { email: e.toUpperCase(), password: PASSWORD, passwordConfirm: PASSWORD, invite: invite.toLowerCase().replaceAll("-", " ") }), 201);
    assert.ok(r.recoveryCode && c.cookie);
    const s = ok(await c.demo("session"));
    assert.deepEqual([s.authenticated, s.account.email, s.account.emailVerified], [true, e, false], "email stored lower-case, never marked verified");
    A = { c, email: e, recoveryCode: r.recoveryCode };
    const other = client(newIp());
    assert.equal((await other.demo("register", { email: email("b"), password: PASSWORD, passwordConfirm: PASSWORD, invite })).status, 403, "invite is single-use");
    const fresh = admin("invite", "dup");
    assert.equal((await other.demo("register", { email: e, password: PASSWORD, passwordConfirm: PASSWORD, invite: fresh })).status, 409, "email already registered");
    ok(await other.demo("register", { email: email("b"), password: PASSWORD, passwordConfirm: PASSWORD, invite: fresh }), 201);
    B = { c: other };
    const row = (await db.query("SELECT password_hash, recovery_hash FROM career_demo_users WHERE email=$1", [e])).rows[0];
    assert.match(row.password_hash, /^scrypt\$15\$8\$1\$/);
    assert.ok(!row.password_hash.includes(PASSWORD) && row.recovery_hash !== r.recoveryCode);
    const alias = (await db.query("SELECT a.email FROM career_accounts a JOIN career_demo_users u ON u.account_id=a.id WHERE u.email=$1", [e])).rows[0].email;
    assert.match(alias, /^demo-[0-9a-f]{16}@example\.invalid$/, "career_accounts keeps a synthetic alias");
  });

  await check("cookie is HttpOnly + SameSite; CSRF (Origin), host and body checks", async () => {
    const c = client(newIp());
    const r = await c.demo("login", { email: A.email, password: PASSWORD });
    const set = r.headers.get("set-cookie");
    assert.match(set, /HttpOnly/i);
    assert.match(set, /SameSite=lax/i);
    assert.equal((await c.call("/api/career/demo/login", { email: A.email, password: PASSWORD }, { origin: "https://evil.example" })).status, 403);
    assert.equal((await c.call(`/api/career/v3/${P}/plan`, {}, { origin: "https://evil.example" })).status, 403);
    const foreignHost = await new Promise((resolve, reject) => http.get({ host: "127.0.0.1", port: PORT, path: "/api/career/demo/session", headers: { host: "evil.example" } }, (r) => { r.resume(); resolve(r.statusCode); }).on("error", reject));
    assert.equal(foreignHost, 403, "foreign Host header refused");
    assert.equal((await c.call("/api/career/demo/login", { email: A.email, password: PASSWORD, role: "admin" })).status, 400, "unexpected fields refused");
    assert.equal((await c.call("/api/career/demo/login", undefined, {})).status, 404, "GET login is not an action");
  });

  await check("wrong password and unknown email give the same answer; rate limit locks the email", async () => {
    const c = client(newIp());
    const wrong = await c.demo("login", { email: A.email, password: "wrong-password-1" });
    const unknown = await c.demo("login", { email: "nobody@example.com", password: "wrong-password-1" });
    assert.deepEqual([wrong.status, unknown.status, wrong.body.error], [401, 401, unknown.body.error]);
    const t = await register("rate");
    let status = 0;
    for (let i = 0; i < 10; i++) status = (await client(newIp()).demo("login", { email: t.email, password: "wrong-password-" + i })).status;
    assert.equal(status, 429, "per-email limit across addresses");
    assert.equal((await client(newIp()).demo("login", { email: t.email, password: PASSWORD })).status, 429, "locked even with the right password");
  });

  await check("sign-out revokes the session server-side", async () => {
    const t = await register("logout");
    const stolen = t.c.cookie;
    ok(await t.c.v3("state"));
    ok(await t.c.demo("logout", {}));
    assert.equal(t.c.cookie, "");
    t.c.cookie = stolen;
    assert.equal((await t.c.v3("state")).status, 401, "revoked token is useless");
    assert.equal(ok(await t.c.demo("session")).authenticated, false);
  });

  await check("sign-in survives a server restart (sessions in PostgreSQL)", async () => {
    await stopServer(server);
    server = await startServer();
    assert.equal(ok(await A.c.demo("session")).authenticated, true);
    const c = client(newIp());
    ok(await c.demo("login", { email: A.email, password: PASSWORD }));
    ok(await c.v3("state"));
  });

  const lessonCache = new Map();
  const lesson = async (c, id) => {
    if (!lessonCache.has(id)) lessonCache.set(id, ok(await c.v3("lessons/" + id)).lesson);
    return lessonCache.get(id);
  };
  const profiles = JSON.parse(readFileSync("tests/fixtures/career-v3/pilot-profiles.json", "utf8")).profiles.filter((p) => p.id !== "FX-diagnostic-changed");
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const rows = [];
  await check("nine profiles: full path over HTTP on the real lessons in review", async () => {
    for (const p of profiles) {
      let u = await register(p.id.slice(3, 12));
      const st = ok(await u.c.v3("state"));
      assert.equal(st.libraryMode, "demo_review_preview");
      assert.equal(ok(await u.c.v3("diagnostic/questions")).questions.length, 18, "18 questions");
      ok(await u.c.v3("diagnostic", { answers: p.answers }));
      assert.equal(ok(await u.c.v3("task-map", {})).taskMap.status, "ready");
      const plan = ok(await u.c.v3("plan", {})).plan;
      assert.equal(plan.status, "ready", p.id);
      assert.equal(new Set(plan.steps.map((s) => s.stableId)).size, 30, "30 distinct steps");
      for (const step of plan.steps) {
        if (step.position === 11) {
          ok(await u.c.demo("logout", {}));
          assert.equal((await u.c.v3("progress")).status, 401);
          ok(await u.c.demo("login", { email: u.email, password: PASSWORD }));
          const pr = ok(await u.c.v3("progress"));
          assert.deepEqual([pr.summary.done, pr.resumePosition], [10, 11], `${p.id}: resume after sign-in`);
        }
        const l = await lesson(u.c, step.lessonId);
        assert.equal(l.status, "review", "learner sees the original document; status unchanged");
        const ex = l.content.exercises.find((e) => e.id === step.exerciseId);
        ok(await u.c.v3(`progress/steps/${step.position}/start`, { stableId: step.stableId }));
        ok(await u.c.v3(`progress/steps/${step.position}/self-check`, { stableId: step.stableId, criteriaMet: ex.successCriteria.map(() => true) }));
        const pr = ok(await u.c.v3("progress"));
        if (!pr.quizzes[step.lessonId]?.passed) {
          const wrong = ok(await u.c.v3(`progress/lessons/${step.lessonId}/quiz`, { answers: Object.fromEntries(l.content.quiz.map((q) => [q.id, q.options.find((o) => o.id !== q.correctId).id])) }));
          assert.equal(wrong.passed, false);
          assert.equal(ok(await u.c.v3(`progress/lessons/${step.lessonId}/quiz`, { answers: Object.fromEntries(l.content.quiz.map((q) => [q.id, q.correctId])) })).passed, true);
        }
        assert.equal(ok(await u.c.v3(`progress/steps/${step.position}/complete`, { stableId: step.stableId, completionMet: step.completionCriteria.map(() => true) })).state, "done");
      }
      const fin = ok(await u.c.v3("progress"));
      assert.deepEqual([fin.summary.done, fin.summary.percent], [30, 100]);
      const res = ok(await u.c.v3("results"));
      let measured = 0;
      for (const m of res.measurements.filter((x) => x.eligible)) {
        const unit = m.units.find((x) => x !== "minutes") ?? m.units[0];
        const minutes = unit === "minutes";
        const conditions = Object.fromEntries(["sameTaskType", "sameMethod", "samePerformer", "trainingDataOnly", ...(minutes ? ["reviewIncluded"] : [])].map((k) => [k, true]));
        ok(await u.c.v3(`results/measurements/${m.position}`, { stableId: m.stableId, metricId: m.metric.id, measurement: {
          unit, baseline: { value: minutes ? 19 : 50, sampleSize: 4, measuredOn: daysAgo(9) }, after: { value: minutes ? 2.5 : 75, sampleSize: 4, measuredOn: daysAgo(2) },
          reviewMinutes: minutes ? 7 : null, fixMinutes: minutes ? 3.5 : null, errorsFound: 2, conditions, limitations: [] } }));
        measured++;
      }
      for (const kind of ["results", "pilot", "development"]) {
        const rep = ok(await u.c.v3("results/report?kind=" + kind));
        assert.equal(rep.sections.length, 6);
        assert.match(rep.text, /Демонстрационная версия: учебные материалы находятся на проверке/);
        assert.ok(!rep.text.includes(u.email));
        const pdf = await u.c.v3("results/report.pdf?kind=" + kind);
        assert.equal(pdf.status, 200);
        assert.equal(pdf.body.subarray(0, 5).toString(), "%PDF-");
      }
      ok(await u.c.v3("diagnostic", { answers: p.answers }));
      const stale = ok(await u.c.v3("progress"));
      assert.ok(stale.stale, "repeated diagnostic makes the route stale");
      assert.equal((await u.c.v3("progress/steps/1/start", { stableId: plan.steps[0].stableId })).status, 409, "stale route is read-only");
      ok(await u.c.v3("plan", { rebuild: true }));
      const after = ok(await u.c.v3("results"));
      assert.deepEqual([after.history[0].done, after.summary.done], [30, 0], "old route kept in history");
      rows.push({ profile: p.id.replace("FX-", ""), variant: plan.variant, steps: 30, measured, reports: 3 });
      u = null;
    }
    console.table(rows);
  });

  await check("data isolation: each account sees only its own data; tampering refused", async () => {
    const a = ok(await A.c.v3("progress"));
    assert.equal(a.plan, null, "A has not built a route");
    ok(await B.c.v3("diagnostic", { answers: profiles[0].answers }));
    ok(await B.c.v3("task-map", {}));
    const planB = ok(await B.c.v3("plan", {})).plan;
    assert.equal(ok(await A.c.v3("progress")).plan, null, "B's route is invisible to A");
    assert.equal(ok(await A.c.v3("diagnostic")).result, null);
    assert.equal((await B.c.v3("progress/steps/1/start", { stableId: "STEP-XX-forged" })).status >= 400, true, "forged step id refused");
    assert.equal((await B.c.v3("progress/steps/31/start", { stableId: planB.steps[0].stableId })).status >= 400, true);
    assert.equal((await B.c.v3("progress/steps/1/complete", { stableId: planB.steps[0].stableId, completionMet: planB.steps[0].completionCriteria.map(() => true), state: "done" })).status, 400, "client cannot send a state");
    assert.equal((await B.c.v3("progress/steps/1/complete", { stableId: planB.steps[0].stableId, completionMet: planB.steps[0].completionCriteria.map(() => true) })).status, 409, "cannot complete a step that was not started");
    assert.equal((await B.c.v3("lessons/ZZZ-99")).status, 404);
    assert.equal((await B.c.v3("preview/lessons")).status, 404, "review preview endpoints stay closed");
    assert.equal((await B.c.v3("plan", { rebuild: "yes" })).status, 400);
  });

  await check("lesson player: catalogue, saved screen + choices across sign-in, ordered saves, version carry-over, isolation", async () => {
    const u = await register("player");
    ok(await u.c.v3("diagnostic", { answers: profiles[0].answers }));
    ok(await u.c.v3("task-map", {}));
    const plan = ok(await u.c.v3("plan", {})).plan;
    const cats = ok(await u.c.v3("catalogue")).categories;
    assert.equal(cats.find((c) => c.id === "safety").lessons.find((l) => l.id === "SAF-01").player, true);
    assert.equal(cats.find((c) => c.id === "prompting").status, "future", "empty category is not shown as ready");
    const pl = ok(await u.c.v3("player/lessons/SAF-01"));
    assert.deepEqual([pl.position, pl.restarted, pl.step, pl.result.quizPassed], [0, false, null, false]);
    const n = pl.screens.length;
    const before = ok(await u.c.v3("progress")).summary;
    let seq = 1000;
    const pos = (screen, extra = {}) => u.c.v3("player/lessons/SAF-01/position", { scriptVersion: pl.scriptVersion, exerciseId: pl.exerciseId, screen, seq: ++seq, ...extra });
    const quizId = pl.screens.find((x) => x.type === "quiz").id;
    ok(await pos(7, { choices: { q: { [quizId]: "a" }, checked: [], c: [true, null] } }));
    ok(await u.c.demo("logout", {}));
    ok(await u.c.demo("login", { email: u.email, password: PASSWORD }));
    const back = ok(await u.c.v3("player/lessons/SAF-01"));
    assert.equal(back.position, 7, "screen restored after sign-in");
    assert.deepEqual([back.choices.q[quizId], back.choices.c], ["a", [true, null]], "choices restored");
    // Fast switching: an older request arriving after a newer one is ignored.
    const newer = ++seq + 10;
    ok(await u.c.v3("player/lessons/SAF-01/position", { scriptVersion: pl.scriptVersion, exerciseId: pl.exerciseId, screen: 9, seq: newer }));
    assert.equal(ok(await u.c.v3("player/lessons/SAF-01/position", { scriptVersion: pl.scriptVersion, exerciseId: pl.exerciseId, screen: 3, seq: newer - 5 })).stale, true);
    assert.equal(ok(await u.c.v3("player/lessons/SAF-01")).position, 9);
    seq = newer;
    for (const [extra, code] of [[{ screen: n }, 400], [{ screen: -1 }, 400], [{ screen: "7" }, 400], [{ scriptVersion: "999" }, 409], [{ exerciseId: "SAF01-TASK-9" }, 400],
      [{ choices: { q: { [quizId]: "z" } } }, 400], [{ choices: { note: "free text" } }, 400], [{ choices: { c: ["yes"] } }, 400], [{ seq: -1 }, 400]]) {
      assert.equal((await pos(3, extra)).status, code, JSON.stringify(extra));
    }
    assert.equal((await pos(3, { role: "admin" })).status, 400, "unexpected fields refused");
    assert.equal((await u.c.v3("player/lessons/SAF-02")).status, 404, "lesson without a script → full lesson only");
    assert.equal((await u.c.v3("player/lessons/ZZZ-99")).status, 404);
    const safStep = plan.steps.find((x) => x.lessonId === "SAF-01");
    const other = plan.steps.find((x) => x.lessonId !== "SAF-01");
    const inStep = ok(await u.c.v3(`player/lessons/SAF-01?step=${safStep.position}`));
    assert.deepEqual([inStep.step.position, inStep.inRoute, inStep.step.state], [safStep.position, true, "not_started"]);
    assert.equal((await u.c.v3(`player/lessons/SAF-01?step=${other.position}`)).status, 404, "a step of another lesson");
    assert.equal((await u.c.v3("player/lessons/SAF-01?step=99")).status, 400);
    // Script update: theory/practice position is kept, later screens restart from the self-check.
    await db.query("UPDATE career_v3_player_positions SET script_version='1', screens=screens+1, screen=15 WHERE lesson_id='SAF-01' AND account_id=(SELECT account_id FROM career_demo_users WHERE email=$1)", [u.email]);
    const upd = ok(await u.c.v3("player/lessons/SAF-01"));
    const prefix = upd.screens.findIndex((x) => x.type === "criterion");
    assert.deepEqual([upd.position, upd.restarted], [Math.min(15, prefix), 15 > prefix], "carry-over to the stable prefix");
    await db.query("UPDATE career_v3_player_positions SET script_version='1', screens=screens+1, screen=5 WHERE lesson_id='SAF-01' AND account_id=(SELECT account_id FROM career_demo_users WHERE email=$1)", [u.email]);
    assert.deepEqual([ok(await u.c.v3("player/lessons/SAF-01")).position, ok(await u.c.v3("player/lessons/SAF-01")).restarted], [5, false], "theory position survives a script update");
    // Regression (found live after deploy): a row saved by the previous version has choices = {} (column default).
    await db.query("UPDATE career_v3_player_positions SET choices='{}'::jsonb, seq=0 WHERE lesson_id='SAF-01' AND account_id=(SELECT account_id FROM career_demo_users WHERE email=$1)", [u.email]);
    const legacy = ok(await u.c.v3("player/lessons/SAF-01"));
    assert.deepEqual([legacy.choices.q, legacy.choices.checked, legacy.choices.c], [{}, [], []], "legacy row opens with empty choices");
    ok(await u.c.v3(`player/lessons/SAF-01?step=${safStep.position}`));
    assert.equal(ok(await B.c.v3("player/lessons/SAF-01")).position, 0, "another account has its own position");
    assert.deepEqual(ok(await u.c.v3("progress")).summary, before, "screens are not route steps; progress unchanged");
    assert.doesNotMatch(JSON.stringify(pl.screens.filter((x) => x.type === "text")), /SAF01-|TPL-|STEP-/, "no internal ids in text screens");
  });

  await check("lesson result is decided by the server: wrong answers never complete the lesson or the step; right answers + criteria complete the step", async () => {
    // In the route.
    const u = await register("result");
    ok(await u.c.v3("diagnostic", { answers: profiles[0].answers }));
    ok(await u.c.v3("task-map", {}));
    const plan = ok(await u.c.v3("plan", {})).plan;
    const st = plan.steps.find((x) => x.lessonId === "SAF-01");
    const pl = ok(await u.c.v3(`player/lessons/SAF-01?step=${st.position}`));
    const quiz = pl.screens.filter((x) => x.type === "quiz");
    const last = pl.screens.length - 1;
    const wrong = Object.fromEntries(quiz.map((q) => [q.id, q.options.find((o) => o.id !== q.correctId).id]));
    const right = Object.fromEntries(quiz.map((q) => [q.id, q.correctId]));
    const w = ok(await u.c.v3("player/lessons/SAF-01/quiz", { answers: wrong, exerciseId: pl.exerciseId }));
    assert.deepEqual([w.passed, w.countedIn, w.correct], [false, "route", 0]);
    const atEnd = ok(await u.c.v3("player/lessons/SAF-01/position", { scriptVersion: pl.scriptVersion, exerciseId: pl.exerciseId, screen: last, seq: 1 }));
    assert.equal(atEnd.completed, false, "viewing the last screen is not completion");
    const r1 = ok(await u.c.v3(`player/lessons/SAF-01?step=${st.position}`));
    assert.deepEqual([r1.result.quizPassed, r1.result.completedAt, r1.step.state], [false, null, "not_started"]);
    assert.equal((await u.c.v3(`progress/steps/${st.position}/complete`, { stableId: st.stableId, completionMet: st.completionCriteria.map(() => true) })).status, 409, "server refuses step completion");
    // Self-check with all criteria from the player path, then the right answers.
    const crit = pl.screens.filter((x) => x.type === "criterion").map(() => true);
    ok(await u.c.v3(`progress/steps/${st.position}/self-check`, { stableId: st.stableId, criteriaMet: crit }));
    const g = ok(await u.c.v3("player/lessons/SAF-01/quiz", { answers: right, exerciseId: pl.exerciseId }));
    assert.deepEqual([g.passed, g.countedIn], [true, "route"]);
    const r2 = ok(await u.c.v3(`player/lessons/SAF-01?step=${st.position}`));
    assert.deepEqual([r2.result.quizPassed, r2.step.state], [true, "self_checked"]);
    assert.equal(ok(await u.c.v3("player/lessons/SAF-01/position", { scriptVersion: pl.scriptVersion, exerciseId: pl.exerciseId, screen: last, seq: 2 })).completed, true);
    ok(await u.c.v3(`progress/steps/${st.position}/complete`, { stableId: st.stableId, completionMet: st.completionCriteria.map(() => true) }));
    const r3 = ok(await u.c.v3(`player/lessons/SAF-01?step=${st.position}`));
    assert.equal(r3.step.state, "done");
    assert.ok(r3.nextStep && r3.nextStep.position > st.position, "next step offered");
    assert.equal(ok(await u.c.v3("progress")).summary.done, 1, "exactly the one step completed by the server rules");
    // A later wrong attempt never erases the pass (existing rule).
    ok(await u.c.v3("player/lessons/SAF-01/quiz", { answers: wrong, exerciseId: pl.exerciseId }));
    assert.equal(ok(await u.c.v3(`player/lessons/SAF-01?step=${st.position}`)).result.quizPassed, true);

    // Outside the route (no diagnostic yet): the test is graded on the server and stored with the position.
    const v = await register("result-free");
    const pv = ok(await v.c.v3("player/lessons/VAL-02"));
    const vq = pv.screens.filter((x) => x.type === "quiz");
    const vw = ok(await v.c.v3("player/lessons/VAL-02/quiz", { answers: Object.fromEntries(vq.map((q) => [q.id, q.options.find((o) => o.id !== q.correctId).id])), exerciseId: pv.exerciseId }));
    assert.deepEqual([vw.passed, vw.countedIn], [false, "lesson"]);
    assert.equal(ok(await v.c.v3("player/lessons/VAL-02")).result.quizPassed, false);
    assert.equal((await v.c.v3("player/lessons/VAL-02/quiz", { answers: { nope: "a" } })).status, 400, "incomplete or foreign answers refused");
    const vr = ok(await v.c.v3("player/lessons/VAL-02/quiz", { answers: Object.fromEntries(vq.map((q) => [q.id, q.correctId])), exerciseId: pv.exerciseId }));
    assert.equal(vr.passed, true);
    assert.equal(ok(await v.c.v3("player/lessons/VAL-02")).result.quizPassed, true);
  });

  await check("password recovery: recovery code, operator reset code, sessions revoked", async () => {
    const t = await register("recover");
    const NEW = PASSWORD + "-new";
    const c = client(newIp());
    assert.equal((await c.demo("recover", { email: t.email, code: "AAAA-BBBB-CCCC-DDDD-EEEE", password: NEW, passwordConfirm: NEW })).status, 400);
    const r = ok(await c.demo("recover", { email: t.email, code: t.recoveryCode, password: NEW, passwordConfirm: NEW }));
    assert.notEqual(r.recoveryCode, t.recoveryCode);
    assert.equal((await t.c.v3("state")).status, 401, "old sessions revoked");
    assert.equal((await client(newIp()).demo("login", { email: t.email, password: PASSWORD })).status, 401, "old password no longer works");
    ok(await client(newIp()).demo("login", { email: t.email, password: NEW }));
    assert.equal((await c.demo("recover", { email: t.email, code: t.recoveryCode, password: PASSWORD, passwordConfirm: PASSWORD })).status, 400, "recovery code is single-use");
    const reset = admin("reset", t.email);
    assert.match(reset, /^([A-Z2-9]{4}-){3}[A-Z2-9]{4}$/);
    ok(await client(newIp()).demo("recover", { email: t.email, code: reset, password: PASSWORD, passwordConfirm: PASSWORD }));
    assert.equal((await client(newIp()).demo("recover", { email: t.email, code: reset, password: NEW, passwordConfirm: NEW })).status, 400, "reset code is single-use");
    ok(await client(newIp()).demo("login", { email: t.email, password: PASSWORD }));
  });

  await check("account deletion removes everything; retention purge after access ends", async () => {
    const t = await register("delete");
    ok(await t.c.v3("diagnostic", { answers: profiles[1].answers }));
    const acc = (await db.query("SELECT account_id FROM career_demo_users WHERE email=$1", [t.email])).rows[0].account_id;
    assert.equal((await t.c.demo("delete-account", { password: "wrong-password-0" })).status, 401);
    ok(await t.c.demo("delete-account", { password: PASSWORD }));
    for (const table of ["career_accounts WHERE id=$1", "career_demo_users WHERE account_id=$1", "career_v3_diagnostics WHERE account_id=$1", "career_events WHERE account_id=$1"])
      assert.equal((await db.query("SELECT count(*)::int n FROM " + table, [acc])).rows[0].n, 0, table);
    assert.equal((await client(newIp()).demo("login", { email: t.email, password: PASSWORD })).status, 401);
    const old = await register("expired");
    await db.query("UPDATE career_demo_users SET access_until=now()-interval '8 days' WHERE email=$1", [old.email]);
    // Stage 1: the session stays, but learning needs access — expired access closes the cabinet with 402 (buy / ask for access).
    assert.equal((await old.c.v3("state")).status, 402, "expired access closes the cabinet");
    assert.equal((await client(newIp()).demo("login", { email: old.email, password: PASSWORD })).status, 403);
    assert.ok(JSON.parse(admin("purge")).accountsRemoved >= 1);
    assert.equal((await db.query("SELECT count(*)::int n FROM career_demo_users WHERE email=$1", [old.email])).rows[0].n, 0);
    assert.doesNotMatch(admin("status"), /@/, "status shows counts only");
  });

  await check("bootstrap invite from the Railway variable: added once, single-use, never revived, never printed", async () => {
    const { newCode } = await import("../lib/server/career-demo/auth.ts");
    const code = newCode(4);
    const run = (value) => execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/career/demo-admin.mjs", "migrate"],
      { env: { ...process.env, CAREER_V3_DEMO_BOOTSTRAP_INVITE: value } }).toString();
    const out1 = run(code);
    assert.match(out1, /Стартовое приглашение добавлено/);
    assert.ok(!out1.includes(code) && !out1.includes(code.replaceAll("-", "")), "code never printed");
    assert.match(run("not-a-code"), /неверный формат/);
    const c = client(newIp());
    const e = email("bootstrap");
    ok(await c.demo("register", { email: e, password: PASSWORD, passwordConfirm: PASSWORD, invite: code }), 201);
    assert.match(run(code), /уже было добавлено/, "a restart does not revive a spent bootstrap invite");
    assert.equal((await client(newIp()).demo("register", { email: email("bootstrap2"), password: PASSWORD, passwordConfirm: PASSWORD, invite: code })).status, 403);
  });

  await check("bad configuration closes the demo (404), never opens another mode", async () => {
    await stopServer(server);
    server = null;
    const bad = [
      { CAREER_V3_DEMO_DATABASE_URL: process.env.CAREER_V3_DEMO_DATABASE_URL.replace(/mironovich_career_demo_v3$/, "mironovich_career_demo_other") },
      { CAREER_V3_DEMO_SESSION_SECRET: "short" },
      { CAREER_SANDBOX_ENABLED: "1" },
      { CAREER_PAYMENT_MODE: "fixture" },
      { RAILWAY_ENVIRONMENT_NAME: "production" },
      { CAREER_V3_DEMO_ORIGIN: "http://example.com:" + PORT },
    ];
    for (const patch of bad) {
      const s = await startServer({ ...process.env, ...patch });
      try {
        const c = client(newIp());
        assert.equal((await c.call("/career/v3")).status, 404, JSON.stringify(Object.keys(patch)));
        assert.equal((await c.demo("session")).status, 404);
        assert.equal((await c.demo("login", { email: A.email, password: PASSWORD })).status, 404);
        assert.equal((await c.call("/blog")).status, 404, "the rest of the site stays closed too");
        assert.equal((await c.call("/")).status, 404, "/ is the (closed) demo");
        assert.equal((await c.call("/api/career/session")).status, 404);
      } finally { await stopServer(s); }
    }
  });

  await check("migration guards: demo DB needs the runner's setting; other DB names are refused", async () => {
    const sql = readFileSync("migrations/career/009_demo_password_auth.sql", "utf8");
    await assert.rejects(db.query(sql), /CAREER_TEST_DATABASE_REQUIRED/, "no setting → refused on the demo DB");
    const other = new pg.Client({ connectionString: process.env.CAREER_V3_DEMO_DATABASE_URL.replace(/mironovich_career_demo_v3$/, "mironovich_career_demo_other") });
    await other.connect();
    try {
      for (const f of readdirSync("migrations/career").filter((n) => n.endsWith(".sql"))) {
        await assert.rejects(other.query("BEGIN; SELECT set_config('mironovich.career_demo','closed-demo-v3',true); " + readFileSync("migrations/career/" + f, "utf8") + " COMMIT;"), /CAREER_TEST_DATABASE_REQUIRED/, f);
        await other.query("ROLLBACK");
      }
    } finally { await other.query("ROLLBACK").catch(() => {}); await other.end(); }
  });

  await check("content files untouched: lessons stay in review", async () => {
    assert.equal(execFileSync("git", ["status", "--porcelain", "content/"]).toString(), contentBefore);
    for (const f of readdirSync("content/career/v3/lessons").filter((n) => n.endsWith(".json"))) {
      const d = JSON.parse(readFileSync("content/career/v3/lessons/" + f, "utf8"));
      assert.deepEqual([d.status, d.quality.canBePublished, d.sourcePolicy.factualClaimsChecked], ["review", false, false], f);
    }
  });
  console.log(`career demo integration: ${results.length} checks passed`);
} finally {
  if (server) await stopServer(server);
  await db.end();
}
