import { processAnalysisPolicy as policy } from "../../config/process-analysis.ts";
import { readLeadRequest } from "../lead-request.ts";
import { clientIpSource, createLeadLimiter } from "../rate-limit.ts";
import { ANALYSIS_VERSION, parseAnalysisRequest } from "./process-analysis-contract.ts";
import { liveAnalysisAvailable, mockAnalysisAvailable, type AnalysisEnv, type AnalysisGates } from "./process-analysis-policy.ts";
import { requestProcessAnalysis } from "./process-analysis-provider.ts";
import { sharedAnalysisBudget, type AnalysisBudget, type AnalysisOutcome, type AnalysisUsage } from "./process-analysis-budget.ts";
import { demoAnalysis } from "./process-analysis-demo.ts";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const failure = (status: number, error: string) => Response.json({ ok: false, error, baselineAvailable: true }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
export function createProcessAnalysisHandler({ env = process.env, gates = policy, fetcher = fetch, budget, timeoutMs = policy.timeoutMs as number, bodyTimeoutMs = 5000 }: { env?: AnalysisEnv; gates?: AnalysisGates; fetcher?: typeof fetch; budget?: AnalysisBudget; timeoutMs?: number; bodyTimeoutMs?: number } = {}) {
  // This soft abuse limiter is additional; shared durable quotas are reserved below.
  const limited = createLeadLimiter({ source: clientIpSource(env.RATE_LIMIT_CLIENT_IP), perClient: 2, overall: 10 });
  return async function POST(req: Request): Promise<Response> {
    if (limited(req.headers)) return failure(429, "Слишком много попыток. Базовый результат доступен.");
    const host = req.headers.get("host") ?? new URL(req.url).host;
    try {
      const origin = new URL(req.headers.get("origin") ?? "");
      if (!["http:", "https:"].includes(origin.protocol) || origin.host !== host || req.headers.get("sec-fetch-site") === "cross-site") return failure(403, "Отправьте запрос со страницы сайта.");
    } catch { return failure(403, "Отправьте запрос со страницы сайта."); }
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get("content-type") ?? "")) return failure(415, "Нужен JSON-запрос в UTF-8.");
    const bodyController = new AbortController();
    const bodyTimer = setTimeout(() => bodyController.abort(), bodyTimeoutMs);
    let read: Awaited<ReturnType<typeof readLeadRequest>>;
    try {
      // Cancel a slow input stream as well as bounding its bytes and UTF-8 decoding.
      const bounded = req.body ? new Request(req, { body: req.body.pipeThrough(new TransformStream(), { signal: bodyController.signal }), duplex: "half" } as RequestInit) : req;
      read = await readLeadRequest(bounded, policy.maxRequestCharacters);
    } catch { return failure(400, "Не удалось прочитать запрос."); }
    finally { clearTimeout(bodyTimer); }
    if (!read.ok) return failure(read.status, "Некорректный или слишком большой запрос.");
    const clean = parseAnalysisRequest(read.body);
    if (!clean) return failure(422, "Проверьте описание: один процесс без личных данных, ссылок и секретов; подтвердите отдельное уведомление.");
    if (mockAnalysisAvailable(env, host)) return Response.json({ ok: true, version: ANALYSIS_VERSION, source: "mock", analysis: demoAnalysis(clean.input) }, { headers });
    if (!liveAnalysisAvailable(env, gates)) return failure(503, "Индивидуальный ИИ-разбор пока выключен. Бесплатный базовый результат сохранён.");
    let ledger: AnalysisBudget;
    try { ledger = budget ?? sharedAnalysisBudget(env); } catch { return failure(503, "Контроль расходов недоступен. Базовый результат сохранён."); }
    let reserved: Awaited<ReturnType<AnalysisBudget["reserve"]>>;
    try { reserved = await ledger.reserve(); } catch { return failure(503, "Контроль расходов недоступен. Базовый результат сохранён."); }
    if (!reserved.ok) return failure(reserved.reason === "limit" ? 429 : 503, reserved.reason === "limit" ? "Достигнут общий лимит ИИ-разборов. Используйте базовый результат." : "Контроль расходов недоступен. Базовый результат сохранён.");
    let outcome: AnalysisOutcome = "failed", usage: AnalysisUsage | null = null;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, timeoutMs); });
      const result = await Promise.race([requestProcessAnalysis(clean.input, env.OPENAI_API_KEY!, fetcher, controller.signal), timeout]);
      usage = result.usage;
      if (usage && (usage.inputTokens > policy.maxModelContextTokens || usage.outputTokens > policy.maxOutputTokens)) {
        outcome = "invalid"; await ledger.trip();
        return failure(502, "Ответ вышел за проверенные границы. Базовый результат сохранён.");
      }
      if (!result.ok) {
        outcome = result.kind === "rate" ? "failed" : result.kind;
        return failure(result.kind === "rate" ? 429 : result.kind === "refusal" ? 422 : 502, "ИИ не смог подготовить проверенный ответ. Базовый результат сохранён.");
      }
      outcome = "completed";
      return Response.json({ ok: true, version: ANALYSIS_VERSION, source: "openai", analysis: result.analysis }, { headers });
    } catch { return failure(502, "ИИ-разбор прерван или недоступен. Базовый результат сохранён."); }
    finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      // Failure leaves a spent reservation, never a refund. Do not log raw driver/provider errors.
      await ledger.finish(reserved.id, outcome, usage).catch(() => {});
    }
  };
}
