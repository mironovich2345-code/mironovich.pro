// AI Career 3.0 server API. Sandbox-only: careerConfig() returns 404 outside the synthetic
// sandbox (and always on Railway production), the tester gate and a synthetic session are required.
// Routes: /api/career/v3/{professionId}/{library|diagnostic|diagnostic/questions|diagnostic/task-options|
//   plan/readiness|task-map|lessons/selection|plan}
import { NextRequest, NextResponse } from "next/server";
import { careerConfig, CareerError, GATE_COOKIE, SESSION_COOKIE } from "@/lib/server/career/config";
import { limit, sessionAccount, validGate } from "@/lib/server/career/auth";
import { loadProfessionBundle, ProfessionUnavailableError } from "@/lib/server/career-v3/content";
import {
  readV3Diagnostic, readV3Plan, readV3TaskMap, requireV3Access, saveV3Diagnostic, saveV3Plan, saveV3TaskMap,
  taskOptionsFor, v3LessonSelection,
} from "@/lib/server/career-v3/store";
import { learnerCatalog } from "@/lib/career-v3/library";
import { questionnaire } from "@/lib/career-v3/diagnostic";
import { assessPlanReadiness } from "@/lib/career-v3/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY = 8192;

const json = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  if (req.headers.get("content-type")?.split(";")[0] !== "application/json") throw new CareerError(415, "Требуется JSON");
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) throw new CareerError(413, "Запрос слишком большой");
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY) throw new CareerError(413, "Запрос слишком большой");
  try {
    const b = JSON.parse(raw);
    if (!b || typeof b !== "object" || Array.isArray(b)) throw Error();
    return b;
  } catch {
    throw new CareerError(400, "Неверный JSON");
  }
}

function onlyFields(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some((k) => !allowed.includes(k))) throw new CareerError(400, "Неожиданные данные запроса");
}

async function handle(req: NextRequest, ctx: { params: Promise<{ action: string[] }> }) {
  try {
    const config = careerConfig();
    if (req.headers.get("host") !== new URL(config.origin).host) throw new CareerError(403, "Неверный host");
    if (req.method === "POST" && req.headers.get("origin") !== config.origin) throw new CareerError(403, "Неверный источник запроса");
    if (!validGate(req.cookies.get(GATE_COOKIE)?.value)) throw new CareerError(403, "Требуется допуск тестировщика; реальные данные запрещены");
    const accountId = await sessionAccount(req.cookies.get(SESSION_COOKIE)?.value);
    if (!accountId) throw new CareerError(401, "Требуется вход по учебному email-коду");
    await limit("v3:" + accountId, 120, 60);

    const [professionId, ...rest] = (await ctx.params).action;
    const action = rest.join("/");
    if (!/^[a-z][a-z0-9_]{2,40}$/.test(professionId ?? "")) throw new CareerError(404, "Маршрут не найден");
    const body = req.method === "POST" ? await readBody(req) : {};

    if (req.method === "GET" && action === "library") return json(learnerCatalog(loadProfessionBundle(professionId).library));
    if (req.method === "GET" && action === "diagnostic/questions") return json(questionnaire(loadProfessionBundle(professionId).diagnostic));
    if (req.method === "POST" && action === "diagnostic/task-options") {
      onlyFields(body, ["answers"]);
      return json(taskOptionsFor(professionId, body.answers));
    }
    if (req.method === "POST" && action === "diagnostic") {
      onlyFields(body, ["answers"]);
      return json(await saveV3Diagnostic(accountId, professionId, body.answers));
    }
    if (req.method === "GET" && action === "diagnostic") return json(await readV3Diagnostic(accountId, professionId));
    if (req.method === "GET" && action === "plan/readiness") {
      await requireV3Access(accountId);
      const saved = await readV3Diagnostic(accountId, professionId);
      if (!saved.result) throw new CareerError(409, "Сначала пройдите диагностику");
      return json(assessPlanReadiness(loadProfessionBundle(professionId).library, saved.result));
    }
    if (action === "task-map" && req.method === "POST") { onlyFields(body, []); return json(await saveV3TaskMap(accountId, professionId)); }
    if (action === "task-map" && req.method === "GET") return json(await readV3TaskMap(accountId, professionId));
    if (action === "lessons/selection" && req.method === "GET") return json(await v3LessonSelection(accountId, professionId));
    if (action === "plan" && req.method === "POST") { onlyFields(body, []); return json(await saveV3Plan(accountId, professionId)); }
    if (action === "plan" && req.method === "GET") return json(await readV3Plan(accountId, professionId));
    throw new CareerError(404, "Маршрут не найден");
  } catch (e) {
    if (e instanceof ProfessionUnavailableError) return json({ error: e.message }, 404);
    if (e instanceof CareerError) {
      const errors = (e as CareerError & { errors?: unknown }).errors;
      return json(errors ? { error: e.message, errors } : { error: e.message }, e.status);
    }
    console.error("career-v3 route failed", (e as Error).name);
    return json({ error: "Внутренняя ошибка тестового контура" }, 500);
  }
}

export const GET = handle;
export const POST = handle;
