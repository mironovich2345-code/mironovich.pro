import test from "node:test";
import assert from "node:assert/strict";
import {
  generateCareerAnalysis,
  selectedCareerAnalysisMode,
} from "../lib/server/career/ai-provider.ts";
import { syntheticAnswers, generateSyntheticAnalysis } from "../lib/career-diagnostic.ts";

const env = (patch = {}) => ({
  CAREER_SANDBOX_ENABLED: "1",
  CAREER_ENVIRONMENT: "synthetic-sandbox",
  CAREER_ONLY_SYNTHETIC: "true",
  CAREER_APP_ORIGIN: "http://127.0.0.1:3300",
  CAREER_DATABASE_URL: "postgresql://postgres@127.0.0.1:55433/mironovich_career_test",
  CAREER_DATABASE_NAME: "mironovich_career_test",
  CAREER_DATABASE_HOST: "127.0.0.1:55433",
  CAREER_SESSION_SECRET: "s".repeat(64),
  CAREER_TESTER_SECRET: "t".repeat(48),
  CAREER_PAYMENT_MODE: "fixture",
  CAREER_AI_MODE: "openai",
  CAREER_AI_ENABLED: "1",
  OPENAI_API_KEY: "sk-" + "x".repeat(32),
  ...patch,
});
const modelContent = () => ({
  taskAdvice: [
    { taskId: "table", advice: "Сверяйте контрольные суммы с ручным эталоном и фиксируйте пропуски." },
    { taskId: "document", advice: "Сравнивайте черновики инструкции с экспертным перечнем требований." },
  ],
  directions: [
    "Отработайте проверку учебных таблиц по контрольному списку.",
    "Освойте безопасную формулировку запросов по вымышленным примерам.",
    "Собирайте доказательства качества после независимой проверки.",
  ],
  phaseFocus: [
    "Сначала фиксируйте начальное время выполнения выбранной задачи",
    "Проверяйте пробные ответы только на разрешённых примерах",
    "Сверяйте выводы с ручным эталоном и отмечайте ошибки",
    "Покажите измерения без обещаний гарантированного результата",
  ],
});
function responder(payload = modelContent(), options = {}) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(options.badResponse ?? {
      status: "completed",
      output: [{
        type: "message",
        status: "completed",
        role: "assistant",
        content: [{ type: "output_text", text: JSON.stringify(payload) }],
      }],
    }), { status: options.status || 200 });
  };
  return { calls, fetcher };
}

test("AI pilot is fail-closed unless all local synthetic explicit opt-ins are present", () => {
  assert.equal(selectedCareerAnalysisMode({}), "rules");
  assert.equal(selectedCareerAnalysisMode(env({ CAREER_AI_MODE: "rules", OPENAI_API_KEY: "" })), "rules");
  for (const patch of [
    { CAREER_AI_MODE: "openai", CAREER_AI_ENABLED: "0" },
    { CAREER_AI_MODE: "unknown" },
    { OPENAI_API_KEY: "" },
    { CAREER_APP_ORIGIN: "https://preview.up.railway.app" },
    { CAREER_APP_ORIGIN: "https://mironovich.pro" },
    { RAILWAY_ENVIRONMENT_NAME: "production" },
  ]) assert.throws(() => selectedCareerAnalysisMode(env(patch)));
});

test("rules mode never contacts an external service", async () => {
  const a = syntheticAnswers();
  const client = responder();
  const output = await generateCareerAnalysis(a, "rules", client.fetcher, env());
  assert.deepEqual(output, generateSyntheticAnalysis(a));
  assert.equal(client.calls.length, 0);
});

test("restricted or unapproved scenario remains deterministic even in AI pilot", async () => {
  for (const patch of [
    { dataSensitivity: "restricted" },
    { accessRules: "ask_first" },
    { accessRules: "forbidden" },
    { errorImpact: "high" },
    { reviewTime: "none" },
    { decisionAuthority: "regulated" },
  ]) {
    const a = syntheticAnswers();
    Object.assign(a.questions, patch);
    const client = responder();
    const result = await generateCareerAnalysis(a, "openai", client.fetcher, env());
    assert.equal(client.calls.length, 0);
    assert.notEqual(result.engine, "openai");
    assert.match(result.disclaimer, /не вызывался/);
  }
});

test("structured AI enhancement preserves fixed risk scores, 30 steps and PDF compatibility", async () => {
  const client = responder();
  const a = syntheticAnswers();
  const base = generateSyntheticAnalysis(a);
  const result = await generateCareerAnalysis(a, "openai", client.fetcher, env());
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].url, "https://api.openai.com/v1/responses");
  const request = JSON.parse(client.calls[0].init.body);
  assert.equal(request.store, false);
  assert.equal(request.background, false);
  assert.equal(request.max_output_tokens, 1800);
  assert.equal(request.model, "gpt-6-luna");
  assert.equal(request.tools.length, 0);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  const safeInput = JSON.parse(request.input[0].content);
  assert.deepEqual(safeInput.questions, a.questions);
  assert.equal(safeInput.selectedTasks.length, 2);
  assert.ok(!JSON.stringify(request).includes("example.invalid"));
  assert.equal(result.engine, "openai");
  assert.equal(result.synthetic, true);
  assert.equal(result.tasks.length, base.tasks.length);
  assert.deepEqual(result.tasks.map(x=>x.score), base.tasks.map(x=>x.score));
  assert.equal(result.directions.length, 3);
  assert.equal(result.plan.length, 30);
  assert.deepEqual(result.plan.map(x=>x.day), Array.from({length:30},(_,i)=>i+1));
  assert.deepEqual(result.plan.map(x=>x.theme), base.plan.map(x=>x.theme));
  assert.equal(result.plan.filter(x=>x.action.includes("Учебный акцент:")).length, 4);
  assert.match(result.disclaimer, /ИИ-анализ/);
});

test("unsafe and malformed model output is rejected instead of silently spending the analysis", async () => {
  const badVariants = [
    { ...modelContent(), directions: ["Одно направление"] },
    { ...modelContent(), taskAdvice: modelContent().taskAdvice.slice(0,1) },
    { ...modelContent(), taskAdvice: [
      { taskId: "table", advice: "Сверяйте контрольные суммы с эталонной учебной таблицей." },
      { taskId: "table", advice: "Повторяйте проверки с фиктивными входными данными." },
    ] },
    { ...modelContent(), directions: [
      "Отправьте данные на https://example.com для анализа",
      ...modelContent().directions.slice(1),
    ] },
    { ...modelContent(), phaseFocus: [
      "Свяжитесь с coach@example.com, чтобы отправить реальные сведения",
      ...modelContent().phaseFocus.slice(1),
    ] },
    { ...modelContent(), taskAdvice: modelContent().taskAdvice.map((x,i)=>({
      ...x,
      advice: i ? "Гарантируем повышение зарплаты после учебного курса" : x.advice,
    })) },
    { ...modelContent(), unexpected: "arbitrary" },
  ];
  for (const bad of badVariants) {
    const client = responder(bad);
    await assert.rejects(generateCareerAnalysis(syntheticAnswers(), "openai", client.fetcher, env()), e=>e.status===502);
    assert.equal(client.calls.length,1);
  }
  await assert.rejects(generateCareerAnalysis(syntheticAnswers(),"openai",responder({},{
    badResponse:{status:"incomplete",output:[]},
  }).fetcher,env()),e=>e.status===503);
  await assert.rejects(generateCareerAnalysis(syntheticAnswers(),"openai",responder({},{
    status:429,
  }).fetcher,env()),e=>e.status===503);
});

test("invalid answers never trigger a model call", async () => {
  const client = responder();
  await assert.rejects(generateCareerAnalysis({
    questions: { role: "custom company employee name" }, tasks: ["table"],
  }, "openai", client.fetcher, env()),e=>e.status===400);
  assert.equal(client.calls.length,0);
});
