// AI Career 3.0 lesson player: scripts, assembly from the lesson's own data, categories, safety, compatibility.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const P = await import("../lib/career-v3/player.ts");
const read = (p) => readFileSync(p, "utf8");
const lesson = (id) => JSON.parse(read(`content/career/v3/lessons/${id}.json`));
const script = (id) => JSON.parse(read(`content/career/v3/player/${id}.json`));
const PROTOTYPES = ["SAF-01", "SAL-03", "VAL-02"];

test("three prototype scripts pass the editorial and safety checks against their lesson version", () => {
  assert.deepEqual(readdirSync("content/career/v3/player").sort(), PROTOTYPES.map((x) => x + ".json"));
  for (const id of PROTOTYPES) {
    const s = script(id), l = lesson(id);
    assert.deepEqual(P.validatePlayerScript(s, l), [], id);
    assert.equal(s.status, "review", "scripts are editorial drafts like the lessons");
    for (const sc of s.theory) {
      const n = P.screenWords(sc);
      assert.ok(n >= 25 && n <= 75, `${id} «${sc.title}»: ${n} words`);
    }
  }
});

test("structure: why → idea → how/examples → task → actions → one criterion per screen → summary → quiz → result", () => {
  for (const id of PROTOTYPES) {
    const s = script(id), l = lesson(id);
    for (const exId of Object.keys(s.practice)) {
      const { screens } = P.assemblePlayer(s, l, { exerciseId: exId, nextLesson: null });
      const types = screens.map((x) => x.type);
      assert.equal(screens[0].kind, "why");
      assert.equal(screens[1].kind, "idea");
      assert.ok(screens.some((x) => x.kind === "example"), `${id}: has examples`);
      const t = types.indexOf("task"), c = types.indexOf("criterion"), r = types.indexOf("summary"), q = types.indexOf("quiz"), d = types.indexOf("result");
      assert.ok(t > 1 && c > t && r > c && q > r && d === screens.length - 1, `${id}/${exId}: order`);
      assert.equal(types.filter((x) => x === "criterion").length, l.content.exercises.find((e) => e.id === exId).successCriteria.length, "one criterion per screen");
      assert.equal(P.stablePrefix(screens), c, "theory, task and actions form the stable prefix");
      assert.equal(types.filter((x) => x === "action").length, l.content.exercises.find((e) => e.id === exId).instructions.length, "one action per instruction");
      assert.equal(types.filter((x) => x === "quiz").length, l.content.quiz.length, "one question per screen");
    }
  }
});

test("exercise data, success criteria, sample solutions and quiz answers come unchanged from the lesson", () => {
  for (const id of PROTOTYPES) {
    const s = script(id), l = lesson(id);
    for (const ex of l.content.exercises.filter((e) => s.practice[e.id])) {
      const { screens, exerciseId } = P.assemblePlayer(s, l, { exerciseId: ex.id });
      assert.equal(exerciseId, ex.id);
      const task = screens.find((x) => x.type === "task");
      const review = screens.find((x) => x.type === "summary");
      assert.deepEqual(screens.filter((x) => x.type === "criterion").map((x) => x.text), ex.successCriteria, "criteria unchanged");
      assert.equal(task.input, ex.syntheticInput);
      assert.deepEqual(review.criteria, ex.successCriteria);
      assert.equal(review.sample, ex.sampleSolution);
      assert.equal(review.feedback, ex.feedbackIfIncorrect);
    }
    const quiz = P.assemblePlayer(s, l).screens.filter((x) => x.type === "quiz");
    assert.deepEqual(quiz.map((q) => [q.id, q.correctId, q.question, q.options.map((o) => o.id)]), l.content.quiz.map((q) => [q.id, q.correctId, q.question, q.options.map((o) => o.id)]));
    // Short display wording keeps the original one tap away; options without an override are untouched.
    for (const q of quiz) for (const o of q.options) {
      const orig = l.content.quiz.find((x) => x.id === q.id).options.find((x) => x.id === o.id).text;
      if (o.full) { assert.equal(o.full, orig); assert.ok(o.text.split(/\s+/).length < orig.split(/\s+/).length); } else assert.equal(o.text, orig);
    }
  }
});

test("a step's own exercise is used when scripted; otherwise the first scripted practice", () => {
  const s = script("SAL-03"), l = lesson("SAL-03");
  assert.equal(P.practiceFor(s, "SAL03-TASK-2"), "SAL03-TASK-2");
  assert.equal(P.practiceFor(s, "NOPE-1"), "SAL03-TASK-1");
  assert.equal(P.practiceFor(s, null), "SAL03-TASK-1");
  assert.equal(P.assemblePlayer(s, l, { exerciseId: "SAL03-TASK-2" }).screens.filter((x) => x.type === "action").length, 5);
});

test("no internal identifiers, career promises or fear wording in learner-visible script text", () => {
  for (const id of PROTOTYPES) {
    const { screens } = P.assemblePlayer(script(id), lesson(id), { nextLesson: { id: "X", title: "Следующий" } });
    const visible = JSON.stringify(screens.filter((x) => x.type === "text" || x.type === "action" || x.type === "result").map((x) => ({ ...x, kind: undefined, type: undefined, nextLesson: undefined })));
    assert.doesNotMatch(visible, P.TECH_ID, id);
    assert.doesNotMatch(JSON.stringify(script(id)), /гарантир|увольнен|повышени\S* (зарплат|доход)/i, id);
  }
});

test("a script written for another lesson version is refused (old routes keep the full lesson view)", () => {
  const l = { ...lesson("SAF-01"), version: "1.1.0" };
  assert.ok(P.validatePlayerScript(script("SAF-01"), l).some((x) => /lesson version/.test(x)));
  const bad = { ...script("SAF-01"), theory: [{ kind: "how", title: "x", text: ["SAF01-TASK-1 слишком коротко"] }] };
  const issues = P.validatePlayerScript(bad, lesson("SAF-01"));
  assert.ok(issues.some((x) => /why/.test(x)) && issues.some((x) => /words/.test(x)) && issues.some((x) => /technical id/.test(x)));
});

test("categories: six learner categories, every written lesson mapped, moduleIds unchanged, empty ones marked future", async () => {
  assert.deepEqual(P.CATEGORIES.map((c) => c.title), ["Безопасность", "Архитектор запросов", "ИИ в моей профессии", "Автоматизация работы", "Моя ценность для компании", "Карьера в эпоху ИИ"]);
  const curriculum = JSON.parse(read("content/career/v3/curriculum.json"));
  const modules = new Set(curriculum.modules.map((m) => m.id));
  for (const c of P.CATEGORIES) for (const m of c.modules) assert.ok(modules.has(m), `module ${m} exists`);
  const byCat = {};
  for (const f of readdirSync("content/career/v3/lessons")) {
    const l = JSON.parse(read("content/career/v3/lessons/" + f));
    (byCat[P.categoryOf(l.id, l.moduleId)] ??= []).push(l.id);
  }
  assert.deepEqual(Object.keys(byCat).sort(), ["automation", "career", "profession", "safety", "value"]);
  assert.equal(byCat.prompting, undefined, "«Архитектор запросов» has no lessons yet → shown as future");
});

test("normal product mode: no review lessons delivered, catalogue shows only future categories, player refused", async () => {
  for (const k of Object.keys(process.env)) if (k.startsWith("CAREER_V3_DEMO") || k === "CAREER_V3_FIXTURE_LIBRARY") delete process.env[k];
  const { lessonCatalogue } = await import("../lib/server/career-v3/player-store.ts");
  const cats = lessonCatalogue("sales_manager");
  assert.ok(cats.every((c) => c.status === "future" && c.lessons.length === 0));
});

test("compatibility: scripts live outside the lesson files, so lesson versions, content hash and plans are unchanged", async () => {
  const professions = JSON.parse(read("content/career/v3/professions.json"));
  const dirs = professions.professions.flatMap((p) => p.lessonDirs ?? []);
  assert.ok(dirs.length > 0 && dirs.every((d) => !d.includes("player")), "player dir is not a lesson dir");
  for (const id of PROTOTYPES) assert.equal(lesson(id).version, script(id).lessonVersion);
  const sql = read("migrations/career/010_v3_player_positions.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS career_v3_player_positions/);
  assert.doesNotMatch(sql, /ALTER TABLE|DROP |DELETE FROM|UPDATE \w+ SET/, "additive migration only");
  assert.match(sql, /mironovich_career_demo_v3/, "same database guard as the other migrations");
});

test("short answer wordings: only where clearly shorter; a non-shorter or unknown override is refused", () => {
  const l = lesson("SAF-01"), sc = script("SAF-01");
  assert.equal(Object.keys(sc.quizDisplay).length, 3, "all three SAF-01 questions shortened");
  const longer = { ...sc, quizDisplay: { "SAF01-Q1": { a: l.content.quiz[0].options[0].text + " и ещё" } } };
  assert.ok(P.validatePlayerScript(longer, l).some((x) => /shorter/.test(x)));
  const unknown = { ...sc, quizDisplay: { "SAF01-Q9": { a: "x" } } };
  assert.ok(P.validatePlayerScript(unknown, l).some((x) => /no such question/.test(x)));
});

test("the result screen never claims the skill by itself — the server decides (no «done» screen type)", () => {
  const src = read("components/career-v3/LessonPlayer.tsx");
  assert.match(src, /if \(!data\.result\.quizPassed\)/, "result screen gated on the server-confirmed test");
  assert.match(src, /Урок ещё не завершён/);
  const store = read("lib/server/career-v3/player-store.ts");
  assert.match(store, /const completed = screen === total - 1 && quizPassed;/, "«completed» needs the server-counted test");
  assert.match(store, /submitV3Quiz\(accountId, professionId, lessonId, body\.answers\)/, "in the route the existing endpoint counts the test");
  assert.match(store, /WHERE EXCLUDED\.seq >= career_v3_player_positions\.seq/, "older saves cannot overwrite newer ones");
});
