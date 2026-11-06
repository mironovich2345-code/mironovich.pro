import { automationModel } from "../../config/automation-model.ts";
import { numberField, record, round2, type Parsed } from "./input.ts";
import { calculateLabor, type LaborInput } from "./labor.ts";

export const processTypes = { reporting: "Отчётность", transfer: "Перенос данных", requests: "Обработка заявок", documents: "Документы", knowledge: "Поиск по знаниям", training: "Обучение сотрудников", custom: "Другой процесс" } as const;
export const apiOptions = { yes: "Есть API", unknown: "Не знаю", no: "Нет API" } as const;
export const dataOptions = { clean: "Структурированы", mixed: "Нужно привести в порядок", poor: "Разрозненные / низкое качество", unknown: "Не знаю" } as const;
export const loadOptions = { low: "До 100 операций в день", medium: "101–1 000 операций в день", high: "Более 1 000 операций в день", unknown: "Не знаю" } as const;
export type AutomationInput = {
  processType: keyof typeof processTypes; employees: number; integrations: number;
  api: keyof typeof apiOptions; data: keyof typeof dataOptions; load: keyof typeof loadOptions;
  interface: boolean; documents: boolean; ai: boolean; humanReview: boolean; support: boolean;
  confirmedCashBenefit?: number; residualManualCost?: number;
};
export const defaultAutomation: AutomationInput = {
  processType: "reporting", employees: 3, integrations: 1, api: "unknown", data: "mixed", load: "low",
  interface: false, documents: false, ai: false, humanReview: true, support: true,
};
const has = (o: object, v: unknown): boolean => typeof v === "string" && Object.hasOwn(o, v);
export function parseAutomationInput(raw: unknown): Parsed<AutomationInput> {
  const src = record(raw);
  if (!src) return { ok: false, errors: { form: "Нужны параметры процесса." } };
  const errors: Record<string, string> = {};
  for (const [key, options] of Object.entries({ processType: processTypes, api: apiOptions, data: dataOptions, load: loadOptions })) {
    if (!has(options, src[key])) errors[key] = "Выберите значение из списка.";
  }
  if (!numberField(src.employees, 0, 10000, true)) errors.employees = "Введите целое число от 0 до 10 000.";
  if (!numberField(src.integrations, 0, 20, true)) errors.integrations = "Введите целое число от 0 до 20.";
  for (const key of ["interface", "documents", "ai", "humanReview", "support"]) {
    if (typeof src[key] !== "boolean") errors[key] = "Укажите да или нет.";
  }
  const hasEconomics = src.confirmedCashBenefit !== undefined || src.residualManualCost !== undefined;
  if (hasEconomics) {
    for (const key of ["confirmedCashBenefit", "residualManualCost"]) {
      if (!numberField(src[key], 0, 1000000000)) errors[key] = "Введите сумму от 0 до 1 000 000 000.";
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { ...Object.fromEntries(Object.keys(defaultAutomation).map((k) => [k, src[k]])), ...(hasEconomics ? { confirmedCashBenefit: src.confirmedCashBenefit, residualManualCost: src.residualManualCost } : {}) } as AutomationInput };
}

export type Approach = "Обычная автоматизация" | "Интеграция существующих систем" | "Готовый SaaS-сервис" | "Скрипт или небольшой внутренний инструмент" | "Разработка приложения" | "ИИ-автоматизация";
export function recommend(i: AutomationInput): { approach: Approach; reason: string; usesAI: boolean } {
  const aiUseful = i.ai && (i.documents || i.processType === "documents" || i.processType === "knowledge");
  if (aiUseful) return { approach: "ИИ-автоматизация", usesAI: true, reason: "В задаче есть работа с неструктурированным текстом или знаниями, и вы указали потребность в ИИ. Гипотезу нужно проверить пилотом на ваших примерах." };
  const prefix = i.ai ? "Для описанного типа задачи сначала стоит проверить решение без ИИ. " : "";
  if (i.interface || i.processType === "custom") return { approach: "Разработка приложения", usesAI: false, reason: prefix + "Указаны отдельный интерфейс или нестандартный процесс. Сначала сравните готовые продукты, затем уточните сценарии собственной разработки." };
  if (i.integrations > 0 && i.api === "yes") return { approach: "Интеграция существующих систем", usesAI: false, reason: prefix + "Есть системы с API: начните с поддерживаемого обмена данными и правил обработки. ИИ для переноса данных не требуется." };
  if (i.processType === "requests" || i.processType === "training" || (i.integrations > 0 && i.api !== "yes")) return { approach: "Готовый SaaS-сервис", usesAI: false, reason: prefix + "Сначала проверьте готовые сервисы и штатные коннекторы. Возможность связать ваши системы ещё не подтверждена; наличие подходящего продукта нужно проверить." };
  if (i.integrations === 0 && i.load === "low" && !i.documents) return { approach: "Скрипт или небольшой внутренний инструмент", usesAI: false, reason: prefix + "Небольшая нагрузка и отсутствие интеграций позволяют начать с одного локального сценария без отдельного приложения." };
  return { approach: "Обычная автоматизация", usesAI: false, reason: prefix + "Начните с правил, шаблонов и обработки данных. Потребность в ИИ из выбранных параметров не следует." };
}

export type Range = readonly [number, number];
type Model = typeof automationModel;
export type ModelInput = Omit<Model, "approvedByOwner" | "publicPricingEnabled"> & { approvedByOwner: boolean; publicPricingEnabled: boolean };
export function calculateAutomation(raw: AutomationInput, labor?: LaborInput, model: ModelInput = automationModel) {
  const parsed = parseAutomationInput(raw);
  if (!parsed.ok) throw new RangeError("Invalid automation input");
  const i = parsed.value;
  const recommendation = recommend(i);
  if (i.data === "unknown" || i.load === "unknown") return {
    version: model.version, recommendation, stages: [] as { name: string; hours: Range }[], hours: [0, 0] as Range,
    complexity: "Нужно уточнить", pricingEnabled: false, budget: null, recurring: [] as { name: string; range: Range | null }[], recurringTotal: null,
    potentialTimeValue: labor ? calculateLabor(labor).freedTimeValue : null, paybackMonths: null,
    paybackReason: "Сначала нужно уточнить исходные данные.", risks: ["Состояние данных или объём работы неизвестны. Трудоёмкость не рассчитывается без этих ответов.", "Возможность подключения программ и последствия ошибок нужно проверить отдельно."],
  };
  const factor = model.dataFactor[i.data] * model.loadFactor[i.load];
  const scale = (range: Range, multiplier = 1): [number, number] => [Math.ceil(range[0] * multiplier), Math.ceil(range[1] * multiplier)];
  const stages: { name: string; hours: Range }[] = [
    { name: "Анализ требований", hours: scale(model.stages.requirements, factor) },
    { name: "Проектирование", hours: scale(model.stages.design, factor) },
    { name: "Интеграции", hours: scale(model.stages.integration, i.integrations * (i.api === "yes" ? 1 : model.noApiFactor) * factor) },
    { name: "Backend и обработка данных", hours: scale(model.stages.backend, factor) },
    { name: "Подготовка документов", hours: i.documents || i.processType === "documents" ? scale(model.stages.documents, factor) : [0, 0] },
    { name: "Frontend", hours: i.interface ? scale(model.stages.frontend, model.loadFactor[i.load]) : [0, 0] },
    { name: "ИИ-компоненты", hours: recommendation.usesAI ? scale(model.stages.ai, factor) : [0, 0] },
  ];
  const subtotal: Range = [stages.reduce((n, s) => n + s.hours[0], 0), stages.reduce((n, s) => n + s.hours[1], 0)];
  stages.push({ name: "Тестирование", hours: [Math.ceil(subtotal[0] * model.testingFraction[0]), Math.ceil(subtotal[1] * model.testingFraction[1])] });
  stages.push({ name: "Развёртывание", hours: scale(model.stages.deployment, model.loadFactor[i.load]) });
  const hours: Range = [stages.reduce((n, s) => n + s.hours[0], 0), stages.reduce((n, s) => n + s.hours[1], 0)];
  const pricingEnabled = model.approvedByOwner && model.publicPricingEnabled;
  const money = (r: Range): Range => [round2(r[0]), round2(r[1])];
  const multiply = (r: Range, n: number): Range => [r[0] * n, r[1] * n];
  const recurring = [
    { name: "Инфраструктура", range: money(multiply(model.monthly.infrastructure, model.loadFactor[i.load])) },
    { name: "Внешние сервисы и API", range: money(multiply(model.monthly.servicesPerIntegration, i.integrations)) },
    { name: "ИИ-модели", range: recommendation.usesAI ? model.monthly.ai[i.load] : [0, 0] as Range },
    { name: "Техническое сопровождение", range: i.support ? money(multiply(model.monthly.supportHours, model.hourlyRate)) : [0, 0] as Range },
  ];
  const recurringTotal: Range = [recurring.reduce((n, s) => n + s.range[0], 0), recurring.reduce((n, s) => n + s.range[1], 0)];
  const budget: Range = money([hours[0] * model.hourlyRate, hours[1] * model.hourlyRate]);
  // This potential value is capacity, not confirmed cash savings. Do not infer ROI from it.
  const potentialTimeValue = labor ? calculateLabor(labor).freedTimeValue : null;
  const payback = pricingEnabled && i.confirmedCashBenefit !== undefined && i.residualManualCost !== undefined
    ? calculatePayback(budget, [i.confirmedCashBenefit - recurringTotal[1] - i.residualManualCost, i.confirmedCashBenefit - recurringTotal[0] - i.residualManualCost]) : null;
  const risks = ["Оценка основана на выбранных параметрах, без изучения кода, систем и данных.", "Стоимость владения зависит от тарифов сервисов и условий сопровождения."];
  if (i.integrations > 0 && i.api !== "yes") risks.push("Обмен данными не подтверждён: без API интеграция может быть ненадёжной или невозможной. Часы в модели — условная гипотеза, а не обещание реализуемости.");
  if (i.data !== "clean") risks.push("Потребуется проверить качество и подготовить данные.");
  if (recommendation.usesAI) risks.push(i.humanReview ? "Затраты времени на проверку человеком нужно учитывать отдельно." : "Для ИИ не предусмотрена проверка человеком: необходимо оценить последствия ошибок.");
  if (i.load === "high") risks.push("Нагрузка свыше 1 000 операций в день требует отдельной оценки пиков и ограничений.");
  if (i.employees === 0) risks.push("Количество сотрудников равно нулю: уточните участников процесса.");
  return {
    version: model.version, recommendation, stages, hours,
    complexity: hours[1] <= 80 ? "Низкая" : hours[1] <= 200 ? "Средняя" : "Высокая",
    pricingEnabled, budget: pricingEnabled ? budget : null,
    recurring: recurring.map((s) => ({ name: s.name, range: pricingEnabled ? s.range : null })),
    recurringTotal: pricingEnabled ? recurringTotal : null, potentialTimeValue,
    paybackMonths: payback,
    paybackReason: !pricingEnabled ? "Денежная модель не утверждена: бюджет и окупаемость не публикуются. Нужны также подтверждённая денежная выгода и остаточные затраты; стоимость высвобождаемого времени их не заменяет." : payback ? "Срок рассчитан по указанной вами денежной выгоде, за вычетом регулярных расходов и остаточного ручного труда. Это сценарий, а не обещание результата." : "Без положительной чистой денежной выгоды во всём диапазоне затрат срок не определяется. Нужны подтверждённые выгоды и остаточные затраты на ручную работу.", risks,
  };
}

/** Only use with confirmed NET cash benefit after recurring costs and residual labour. */
export function calculatePayback(investment: Range, netMonthlyCashBenefit: Range): Range | null {
  if (![...investment, ...netMonthlyCashBenefit].every(Number.isFinite) || investment[0] < 0 || investment[1] < investment[0] || netMonthlyCashBenefit[0] <= 0 || netMonthlyCashBenefit[1] < netMonthlyCashBenefit[0]) return null;
  return [Math.ceil(investment[0] / netMonthlyCashBenefit[1] * 10) / 10, Math.ceil(investment[1] / netMonthlyCashBenefit[0] * 10) / 10];
}
