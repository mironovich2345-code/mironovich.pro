import type { Band, Group, ProcessResult, Quantity } from "../../lib/business-map/contracts.ts";

export const groups: Record<Group, string> = { first: "Проверить первым", preliminary: "Уточнить данные", later: "Проверить позже", prepare: "Сначала подготовить", "not-now": "Не сейчас", insufficient: "Недостаточно данных", excluded: "Нужен эксперт" };
export const bands: Record<Band, string> = { low: "Низкая", medium: "Средняя", high: "Высокая" };
export const scenarioNames = ["Консервативный", "Базовый", "Оптимистичный"];
export const periodNames = { day: "день", week: "неделю", month: "месяц" };
export const systemNames: Record<string, string> = { crm: "CRM", erp: "1С / ERP", tables: "Таблицы", mail: "Почта и мессенджеры", paper: "Бумага", voice: "Голос", custom: "Своя система", other: "Другое", none: "Пока ничего" };
export const fieldNames: Record<string, string> = { employees: "число участников", operations: "частота команды", minutes: "минуты на операцию", source: "источник времени", mechanical: "механическая доля", systems: "системы процесса", regulation: "регламент", exceptions: "исключения", error: "последствия ошибки", judgment: "человеческое суждение", access: "доступ к данным", personalData: "персональные данные", workloadCapacity: "нагрузка и рабочий фонд команды" };
export const explanations: Record<string, string> = {
  "R-G1": "Уточните частоту, длительность и участников. Пока данных недостаточно для приоритета.",
  "R-G2": "Отметьте механические шаги в нескольких выполнениях процесса.",
  "R-G3": "Слишком много исключений. Сначала стандартизируйте процесс.",
  "R-G4": "Сначала оцифруйте бумажные и голосовые входные данные.",
  "R-G5": "Критическая ошибка требует экспертной оценки. Автоматическая рекомендация исключена.",
  "R-G6": "Серьёзные последствия и частые решения человека требуют экспертной оценки.",
  "R-HIGH-RISK": "Цена ошибки повышает риск. Сначала согласуйте контроль результата человеком.",
  "R-LOWCONF": "Данные предварительные. Уточните их до выбора пилота.",
  "R-CAPACITY": "Часы превышают рабочий фонд участников. Проверьте частоту команды, длительность и график.",
  "R-MISSING-ASSESSMENT": "Для оценки пригодности нужны дополнительные ответы.",
};
export function reason(r: ProcessResult): string {
  const specific = r.reasons.find(k => ["R-G5","R-G6","R-CAPACITY","R-G3","R-G4","R-G1","R-G2","R-HIGH-RISK","R-LOWCONF","R-MISSING-ASSESSMENT"].includes(k));
  return specific ? explanations[specific] : r.group === "first" ? "Заметный потенциал времени при посильной сложности. Начните с небольшой проверки." : r.group === "later" ? "Уточните ограничения перед пилотом: в этой комбинации ценности и сложности есть более простой старт." : "Небольшой потенциал времени при текущей сложности. Сначала проверьте другие процессы.";
}
export const number = (value: number, digits = 1) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
export const show = (q: Quantity | null | undefined, digits = 1) => q ? number(q.display, digits) : "Не рассчитано";
export const rubles = (q: Quantity | null | undefined) => q ? `${show(q, 2)} ₽` : "Не рассчитано";
export function freedRange(r: ProcessResult): string {
  return r.scenarios.length ? `${show(r.scenarios[0].freedHours)}–${show(r.scenarios[2].freedHours)} ч` : "Нужно уточнить";
}
export function paybackText(r: ProcessResult): string {
  if (!r.scenarios.length) return "Не рассчитана: уточните параметры процесса";
  if (r.paybackRange) return `${show(r.paybackRange.min)}–${show(r.paybackRange.max)} мес.${r.longPayback ? " · базовый срок длиннее двух лет" : ""}`;
  if (r.scenarios.every(s => s.payback.status === "not-recoverable")) return "Не окупается по прямой экономии при введённых данных";
  if (r.scenarios.some(s => s.payback.status === "not-recoverable")) return "Часть сценариев не окупается по прямой экономии";
  return "Не рассчитана: добавьте недостающие затраты";
}

export const inputError = (message: string) => message.replace("или null, если оно неизвестно.", "или оставьте поле пустым, если значение неизвестно.");
