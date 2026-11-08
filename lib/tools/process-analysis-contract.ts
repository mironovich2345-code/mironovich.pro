import { record } from "./input.ts";
import { taskLabels, type Task } from "./guided.ts";

export const ANALYSIS_VERSION = "process-analysis-1";
export const ANALYSIS_NOTICE = "process-analysis-notice-draft-1";
export type ProcessInput = { task: Task; description: string; tools: string; consequence: string };
export type AnalysisRequest = { version: typeof ANALYSIS_VERSION; noticeVersion: typeof ANALYSIS_NOTICE; consent: true; input: ProcessInput };
export const approaches = { service: "Готовый сервис", rules: "Обычные правила", integration: "Интеграция", ai: "ИИ с контролем", not_now: "Пока не автоматизировать" } as const;
export type ProcessAnalysis = {
  understanding: string; decision: "automate" | "pilot" | "wait"; approach: keyof typeof approaches;
  rationale: string; benefits: string[]; actions: { title: string; detail: string }[];
  checks: string[]; pilot: string; successCriteria: string[]; risks: string[]; uncertainties: string[];
  humanReviewRequired: true;
};
const exact = (s: Record<string, unknown>, keys: string[]) => Object.keys(s).length === keys.length && keys.every(k => Object.hasOwn(s, k));

/** Detection is deliberately conservative, never an anonymization guarantee.
 * Shared by UI/server. Suspect text is rejected, never sent to a model to clean. */
export function sensitiveTextError(value: string): string | null {
  const text = value.normalize("NFKC");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(text)) return "Удалите скрытые и управляющие символы.";
  if (/(?:https?:|www\.|mailto:|\b[\w-]+\.(?:ru|com|net|org|io|рф|su|biz|dev|app)\b)|(?:[\w.+-]+\s*(?:@|\[at\]|\(at\)|собака)\s*[\w.-]+)|(?:@[\wа-яё]{3,})/iu.test(text)) return "Удалите ссылки, адреса и контакты.";
  if (/(?:\+?\d[\s().-]*){7,}|\b[A-Z]{2}\d{2}[A-Z\d ]{10,}\b|\b(?:ИНН|СНИЛС|паспорт|реквизиты|номер карты|расч[её]тный сч[её]т)\s*[:№=]?\s*[\d-]{3,}/iu.test(text)) return "Удалите телефоны, номера документов и банковские реквизиты.";
  if (/(?:sk-|ghp_|github_pat_|AKIA)[a-z\d_-]{8,}|-----BEGIN|\b[A-Za-z\d_+\/-]{45,}={0,2}\b|(?:пароль|password|api[_ -]?key|token|токен|секрет|ключ доступа)\s*[:=]\s*\S+/iu.test(text)) return "Удалите пароли, токены и коммерческие секреты.";
  if (/(?:ФИО|дата рождения|диагноз|история болезни|пациент)|(?<!\p{L})(?:Иван|Пётр|Петр|Сергей|Александр|Алексей|Анна|Мария|Елена)\s+[А-ЯЁ][а-яё]+|(?:клиент|сотрудник|менеджер)\s+(?:Иван|Анна|Мария|Сергей)(?!\p{L})/iu.test(text)) return "Замените имена и личные сведения ролями: «клиент», «сотрудник».";
  if (/<\/?[a-z][^>]*>|(?:ignore|disregard).{0,35}(?:instructions|prompt|previous)|(?:игнорируй|забудь|отмени).{0,40}(?:инструкц|правил|ограничен)|(?:system|assistant|developer)\s*:|(?:раскрой|покажи|выведи).{0,30}(?:prompt|промпт|системн|секрет|ключ)/iu.test(text)) return "Опишите только процесс, без команд модели, разметки и скрытых инструкций.";
  return null;
}
export function processInputError(input: ProcessInput): string | null {
  if (input.description.trim().length < 60 || input.description.length > 1800) return "Опишите один процесс: от 60 до 1800 символов.";
  if (input.tools.length > 240 || input.consequence.length > 240) return "Каждое уточнение — не больше 240 символов.";
  return sensitiveTextError([input.description, input.tools, input.consequence].join("\n"));
}
export function parseAnalysisRequest(raw: unknown): AnalysisRequest | null {
  const s = record(raw), i = record(s?.input);
  if (!s || !exact(s, ["version", "noticeVersion", "consent", "input"]) || s.version !== ANALYSIS_VERSION || s.noticeVersion !== ANALYSIS_NOTICE || s.consent !== true || !i || !exact(i, ["task", "description", "tools", "consequence"])) return null;
  if (typeof i.task !== "string" || !Object.hasOwn(taskLabels, i.task) || ![i.description, i.tools, i.consequence].every(v => typeof v === "string")) return null;
  const input = { task: i.task as Task, description: i.description as string, tools: i.tools as string, consequence: i.consequence as string };
  return processInputError(input) ? null : { version: ANALYSIS_VERSION, noticeVersion: ANALYSIS_NOTICE, consent: true, input };
}
/** This exact string is previewed in the browser and supplied as the model's input. */
export function processText(input: ProcessInput): string {
  return `Задача: ${taskLabels[input.task]}\n\nОписание процесса:\n${input.description}${input.tools ? `\n\nИспользуемые инструменты:\n${input.tools}` : ""}${input.consequence ? `\n\nПоследствия ошибки:\n${input.consequence}` : ""}`;
}
const boundedString = { type: "string", minLength: 12, maxLength: 700 };
const stringList = (minItems: number, maxItems: number) => ({ type: "array", minItems, maxItems, items: boundedString });
export const analysisSchema = {
  type: "object", additionalProperties: false,
  required: ["understanding", "decision", "approach", "rationale", "benefits", "actions", "checks", "pilot", "successCriteria", "risks", "uncertainties", "humanReviewRequired"],
  properties: {
    understanding: boundedString, decision: { type: "string", enum: ["automate", "pilot", "wait"] }, approach: { type: "string", enum: Object.keys(approaches) }, rationale: boundedString,
    benefits: stringList(1, 3), actions: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "detail"], properties: { title: boundedString, detail: boundedString } } },
    checks: stringList(2, 5), pilot: boundedString, successCriteria: stringList(2, 4), risks: stringList(1, 4), uncertainties: stringList(1, 4), humanReviewRequired: { type: "boolean", enum: [true] },
  },
};

function safeExplanation(s: unknown): s is string {
  if (typeof s !== "string" || s.trim().length < 12 || s.length > 700 || sensitiveTextError(s)) return false;
  // Never accept numeric financial/time estimates, guarantees or unverified capabilities.
  const text = s.replace(/1[СC]/giu, "учётная система");
  if (/\d|[%₽$€]|\bROI\b|гарантир|окупаемость|точно сэконом|экономия состав|обеспечит эконом|автоматически (?:оплат|перевед|увол|отправ.{0,20}клиент)/iu.test(text)) return false;
  if (/без (?:участия человека|проверки человеком)|самостоятельно.{0,25}(?:оплат|уволь|принимать решен)|(?:включ|настро).{0,20}автоплат/iu.test(text)) return false;
  if (/половин|вдвое|втрое|стопроцентн|за (?:один|два|три|неделю|месяц|день|час)|внедрение займ[её]т/iu.test(text)) return false;
  if (/экономи[яию]|сэконом|бюджет|стоимост|окуп/iu.test(text) && !/неизвест|не (?:определ|рассчит|подтверж|оцен|обещ)|нельзя (?:определ|рассчит|оцен)/iu.test(text)) return false;
  if (/(?:есть|имеет|поддерживает|доступен|предоставляет|используйте|подключите|через|вызовите).{0,45}\bAPI\b|\bAPI\b.{0,40}(?:доступен|поддерживает|позволяет|передаёт|возвращает)|полный доступ/iu.test(text)) return false;
  if (/\bAPI\b/iu.test(text) && !/провер|неизвест|документирован/iu.test(text)) return false;
  if (/(?:Битрикс|amoCRM|Salesforce|1[СC]).{0,60}(?:умеет|поддерживает|позволяет|созда[её]т|переда[её]т)/iu.test(text)) return false;
  return true;
}
export function parseProcessAnalysis(raw: unknown): ProcessAnalysis | null {
  const r = record(raw);
  if (!r || !exact(r, analysisSchema.required) || !["automate", "pilot", "wait"].includes(String(r.decision)) || typeof r.approach !== "string" || !Object.hasOwn(approaches, r.approach) || r.humanReviewRequired !== true) return null;
  if ((r.decision === "wait") !== (r.approach === "not_now")) return null;
  if (![r.understanding, r.rationale, r.pilot].every(safeExplanation)) return null;
  for (const [key, min, max] of [["benefits", 1, 3], ["checks", 2, 5], ["successCriteria", 2, 4], ["risks", 1, 4], ["uncertainties", 1, 4]] as const) {
    const list = r[key];
    if (!Array.isArray(list) || list.length < min || list.length > max || new Set(list).size !== list.length || !list.every(safeExplanation)) return null;
  }
  if (!Array.isArray(r.actions) || r.actions.length < 3 || r.actions.length > 5 || !r.actions.every(a => { const row = record(a); return row && exact(row, ["title", "detail"]) && safeExplanation(row.title) && safeExplanation(row.detail); })) return null;
  return r as ProcessAnalysis;
}
