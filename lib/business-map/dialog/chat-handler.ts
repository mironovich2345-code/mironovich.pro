import { businessMapAiPolicy as policy } from "../../../config/business-map-ai.ts";
import {
  authorizePrototype,
  PREVIEW_REALM,
  previewResponseHeaders,
  type PreviewEnvironment,
} from "../preview-access.ts";
import { prototypeMode } from "../prototype-policy.ts";
import { readLeadRequest } from "../../lead-request.ts";
import { parseChatRequest } from "./ai-schema.ts";
import {
  aiConfigured,
  AiFailure,
  orchestrateAi,
  type AiEnvironment,
} from "./ai-orchestrator.ts";
export type ChatEnvironment = PreviewEnvironment & AiEnvironment;
/** Per-process circuit breaker, NOT a distributed quota. No text, IP, credentials or replies stored. */
export class ChatBudget {
  private minute = -1;
  private minuteCalls = 0;
  private day = -1;
  private dailyCalls = 0;
  private inFlight = 0;
  private ids = new Set<string>();
  reserve(id: string, now: number): "duplicate" | "rate_limit" | null {
    const day = Math.floor(now / 86400000),
      minute = Math.floor(now / 60000);
    if (this.day !== day) {
      this.day = day;
      this.dailyCalls = 0;
      this.ids.clear();
    }
    if (this.minute !== minute) {
      this.minute = minute;
      this.minuteCalls = 0;
    }
    if (this.ids.has(id)) return "duplicate";
    if (
      this.dailyCalls >= policy.maxDailyCallsPerInstance ||
      this.minuteCalls >= policy.maxRequestsPerMinute ||
      this.inFlight >= policy.maxInFlight ||
      this.ids.size >= policy.maxRequestIds
    )
      return "rate_limit";
    this.ids.add(id);
    this.dailyCalls++;
    this.minuteCalls++;
    this.inFlight++;
    return null;
  }
  release() {
    this.inFlight = Math.max(0, this.inFlight - 1);
  }
}
const messages: Record<string, string> = {
  disabled:
    "ИИ-консультант временно недоступен. Продолжите по отраслевым сценариям.",
  duplicate: "Этот запрос уже отправлен. Повторного обращения к ИИ не будет.",
  rate_limit: "Достигнут лимит ИИ-запросов. Продолжите без ИИ.",
  timeout: "ИИ не успел ответить. Можно продолжить без него.",
  provider_limit: "Лимит провайдера. Отраслевые сценарии доступны.",
  provider_error:
    "Не удалось получить ответ ИИ. Данные карты сохранены в этой вкладке.",
  invalid_output:
    "Ответ ИИ не прошёл проверку. Используйте сценарии или уточните сообщение.",
  refused: "ИИ не смог разобрать сообщение. Используйте отраслевой сценарий.",
};
export function createChatHandler(deps: {
  env: () => ChatEnvironment;
  fetcher?: typeof fetch;
  now?: () => number;
  budget?: ChatBudget;
}) {
  const budget = deps.budget ?? new ChatBudget();
  return async function handle(request: Request): Promise<Response> {
    const env = deps.env();
    const reply = (status: number, code: string) =>
      Response.json(
        {
          ok: false,
          source: "unavailable",
          code,
          error: messages[code] ?? "Запрос не принят.",
        },
        { status, headers: previewResponseHeaders },
      );
    // Independently enforce Preview-only policy, even when called without middleware.
    if (
      prototypeMode(
        env.NODE_ENV,
        env.BUSINESS_MAP_PROTOTYPE,
        env.RAILWAY_ENVIRONMENT_NAME,
        env.SITE_NOINDEX,
      ) !== "preview"
    )
      return reply(404, "hidden");
    const access = await authorizePrototype(
      env,
      request.headers.get("authorization"),
    );
    if (access === "hidden") return reply(404, "hidden");
    if (access !== "allow") {
      const response = reply(401, "unauthorized");
      response.headers.set("WWW-Authenticate", PREVIEW_REALM);
      return response;
    }
    if (
      request.method !== "POST" ||
      new URL(request.url).pathname !== "/api/business-map/chat"
    )
      return reply(404, "hidden");
    const origin = request.headers.get("origin");
    if (
      (origin && origin !== new URL(request.url).origin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return reply(403, "origin");
    if (
      !/^application\/json(?:\s*;|$)/i.test(
        request.headers.get("content-type") ?? "",
      )
    )
      return reply(415, "content_type");
    if (!aiConfigured(env)) return reply(503, "disabled");
    const raw = await readLeadRequest(request, policy.maxRequestCharacters);
    if (!raw.ok) return reply(raw.status, "input");
    const input = parseChatRequest(raw.body);
    if (!input) return reply(422, "input");
    const limit = budget.reserve(input.requestId, (deps.now ?? Date.now)());
    if (limit) return reply(limit === "duplicate" ? 409 : 429, limit);
    try {
      return Response.json(await orchestrateAi(input, env, deps.fetcher), {
        headers: previewResponseHeaders,
      });
    } catch (error) {
      const code = error instanceof AiFailure ? error.code : "provider_error";
      return reply(code === "timeout" ? 504 : 502, code);
    } finally {
      budget.release();
    }
  };
}
