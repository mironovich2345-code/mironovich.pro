import { careerConfig, CareerError } from "./config.ts";
import {
  careerTasks,
  generateSyntheticAnalysis,
  validateCareerAnswers,
  type CareerAnswers,
  type CareerResult,
} from "../../career-diagnostic.ts";

export type CareerAnalysisMode = "rules" | "openai";
const MODEL = "gpt-6-luna";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const MAX_OUTPUT_TOKENS = 1800;
const RESPONSE_BYTES_LIMIT = 65536;

/**
 * The default is rules-only. Real API requests require three independent gates:
 * local synthetic sandbox, explicit AI mode, and explicit enable flag + key.
 * A Railway preview or production host cannot enable the external provider.
 */
export function selectedCareerAnalysisMode(env: NodeJS.ProcessEnv = process.env): CareerAnalysisMode {
  const mode = env.CAREER_AI_MODE || "rules";
  if (mode === "rules") return mode;
  if (mode !== "openai") throw new CareerError(503, "Неверный режим учебного анализа");
  const config = careerConfig(env);
  if (!config.local || env.CAREER_AI_ENABLED !== "1")
    throw new CareerError(503, "Внешний ИИ доступен только в локальном закрытом учебном контуре");
  if (!env.OPENAI_API_KEY || !/^sk-[A-Za-z0-9_-]{16,}$/.test(env.OPENAI_API_KEY))
    throw new CareerError(503, "Для локального ИИ-пилота не настроен API-ключ");
  return mode;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).sort().join("|") === [...keys].sort().join("|");

/** Reject personal identifiers, external links and unsupported promises. */
function safeGeneratedText(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (s.length < 12 || s.length > 220 || /[\u0000-\u001f<>]/u.test(s)) return false;
  if (/(?:https?:\/\/|www\.|@|(?:\+7|8)[-\s(]*\d{3}|(?:паспорт|снилс|инн)\s*[:№]?\s*\d|\d{2,}%)/iu.test(s))
    return false;
  if (/(?:гарантир\w*\s+(?:доход|зарплат|работ|повыш)|(?:отправ|загру|переда)\w*\s+(?:парол|паспорт|секрет|данн))/iu.test(s))
    return false;
  return true;
}

type Advice = { taskId: string; advice: string };
type AiContent = { taskAdvice: Advice[]; directions: string[]; phaseFocus: string[] };

function parseAdvice(value: unknown, selectedIds: string[]): AiContent {
  if (!isObject(value) || !exactKeys(value, ["taskAdvice", "directions", "phaseFocus"]))
    throw new CareerError(502, "ИИ вернул неверную структуру анализа");
  if (!Array.isArray(value.taskAdvice) || value.taskAdvice.length !== selectedIds.length ||
      !Array.isArray(value.directions) || value.directions.length !== 3 ||
      !Array.isArray(value.phaseFocus) || value.phaseFocus.length !== 4)
    throw new CareerError(502, "ИИ вернул неполный план");
  const advice: Advice[] = [];
  for (const item of value.taskAdvice) {
    if (!isObject(item) || !exactKeys(item, ["taskId", "advice"]) ||
        typeof item.taskId !== "string" || !selectedIds.includes(item.taskId) ||
        !safeGeneratedText(item.advice)) throw new CareerError(502, "ИИ вернул недопустимую рекомендацию");
    advice.push({ taskId: item.taskId, advice: item.advice.trim() });
  }
  if (new Set(advice.map((x) => x.taskId)).size !== selectedIds.length ||
      !value.directions.every(safeGeneratedText) ||
      !value.phaseFocus.every(safeGeneratedText) ||
      new Set(value.directions).size !== 3)
    throw new CareerError(502, "ИИ вернул противоречивые рекомендации");
  return {
    taskAdvice: advice,
    directions: (value.directions as string[]).map((x) => x.trim()),
    phaseFocus: (value.phaseFocus as string[]).map((x) => x.trim()),
  };
}

function buildSchema(taskIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["taskAdvice", "directions", "phaseFocus"],
    properties: {
      taskAdvice: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["taskId", "advice"],
          properties: {
            taskId: { type: "string", enum: taskIds },
            advice: { type: "string" },
          },
        },
      },
      directions: { type: "array", items: { type: "string" } },
      phaseFocus: { type: "array", items: { type: "string" } },
    },
  };
}

function extractCompletedText(value: unknown): string {
  if (!isObject(value) || value.status !== "completed" || !Array.isArray(value.output))
    throw new CareerError(502, "ИИ не завершил анализ");
  const messages = value.output.filter((x): x is Record<string, unknown> =>
    isObject(x) && x.type === "message" && x.role === "assistant" && x.status === "completed");
  if (messages.length !== 1 || !Array.isArray(messages[0].content))
    throw new CareerError(502, "ИИ вернул неожиданный ответ");
  const content = messages[0].content.filter((x): x is Record<string, unknown> =>
    isObject(x) && x.type === "output_text" && typeof x.text === "string");
  if (content.length !== 1) throw new CareerError(502, "ИИ вернул неполный текст");
  return content[0].text as string;
}

const PHASE_STARTS = [1, 7, 15, 24] as const;

/**
 * The model sees only 18 allowlisted categorical codes and 1-5 curated task
 * descriptions; neither email nor accountId is sent. The 30-step skeleton,
 * task scores and all access/risk rules remain deterministic and immutable.
 */
export async function generateCareerAnalysis(
  answers: CareerAnswers,
  mode: CareerAnalysisMode = selectedCareerAnalysisMode(),
  fetcher: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CareerResult> {
  const valid = validateCareerAnswers(answers);
  if (!valid) throw new CareerError(400, "Некорректные учебные ответы");
  const base = generateSyntheticAnalysis(valid);
  if (mode === "rules") return base;
  if (mode !== "openai" || selectedCareerAnalysisMode(env) !== "openai")
    throw new CareerError(503, "ИИ-пилот закрыт");

  // Never call an outside service when the selected scenario disallows tools
  // or may involve confidential material, even though only codes are supplied.
  if (valid.questions.dataSensitivity === "restricted" ||
      valid.questions.accessRules !== "approved") {
    return {
      ...base,
      disclaimer: "Учебный план на вымышленных данных. Внешний ИИ не вызывался: для выбранного сценария отсутствует разрешение на использование инструментов или данных.",
    };
  }

  const taskIds = base.tasks.map((task) => task.id);
  const taskDescriptions = careerTasks
    .filter((task) => taskIds.includes(task.id))
    .map(({ id, title, steps }) => ({ id, title, steps }));
  const request = {
    model: MODEL,
    store: false,
    background: false,
    reasoning: { effort: "none" },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    tools: [],
    instructions: [
      "Ты методист практического обучения сотрудников. Ответ только на русском.",
      "Переданы исключительно вымышленные категориальные ответы и заранее выбранные учебные задачи.",
      "Не добавляй реальных людей, работодателей, персональные данные, контакты, URL или непроверенные цифры.",
      "Никаких гарантий трудоустройства, повышения зарплаты или автоматического увольнения.",
      "Внешние ИИ-инструменты можно только для разрешённых учебных примеров под проверкой человека.",
      "Верни по одному совету для каждого taskId, три направления развития и четыре учебных фокуса этапов.",
      "Каждый текст — от 12 до 220 символов. Не меняй идентификаторы задач.",
    ].join(" "),
    input: [{ role: "user", content: JSON.stringify({
      questions: valid.questions,
      selectedTasks: taskDescriptions,
      phaseNames: ["Разберите задачу", "Попробуйте ИИ", "Проверьте качество", "Оформите результат"],
    }) }],
    text: {
      format: {
        type: "json_schema",
        name: "career_synthetic_pilot_v1",
        strict: true,
        schema: buildSchema(taskIds),
      },
    },
  };
  let raw: string;
  try {
    const response = await fetcher(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.OPENAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new CareerError(503, "Пробный ИИ-анализ недоступен");
    const text = await response.text();
    if (text.length > RESPONSE_BYTES_LIMIT) throw new CareerError(502, "Слишком большой ответ ИИ");
    raw = extractCompletedText(JSON.parse(text));
  } catch {
    // No keys, payload, model text or upstream errors in server logs.
    throw new CareerError(503, "Учебный ИИ-анализ не завершён. Доступ к анализу сохранён.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw new CareerError(502, "ИИ вернул неверный JSON. Доступ к анализу сохранён.");
  }
  const ai = parseAdvice(parsed, taskIds);
  const suggestions = new Map(ai.taskAdvice.map(({ taskId, advice }) => [taskId, advice]));
  return {
    ...base,
    version: "synthetic-openai-v1",
    engine: "openai",
    disclaimer: "Учебный персонализированный ИИ-анализ только по вымышленным категориальным ответам. Не прогноз увольнения и не гарантия повышения дохода. Решения проверяет человек.",
    tasks: base.tasks.map((t) => ({
      ...t,
      recommendation: t.recommendation + " Учебная рекомендация: " + suggestions.get(t.id),
    })),
    directions: ai.directions,
    plan: base.plan.map((step) => {
      const phase = PHASE_STARTS.indexOf(step.day as 1 & 7 & 15 & 24);
      return phase < 0 ? step : {
        ...step,
        action: step.action + " Учебный акцент: " + ai.phaseFocus[phase],
      };
    }),
  };
}
