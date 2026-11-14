import { loadDemo, type DemoId } from "../demo.ts";
import {
  initialConversation,
  newProcess,
  say,
  saveCompany,
  saveCoreProcess,
} from "./engine.ts";
import { fitnessScenarios, scenarioById } from "./industry.ts";
import type { ConversationState, ScenarioId } from "./contracts.ts";
export const dialogDemoNames = {
  conversation: "Три клуба · начало разговора",
  missing: "Не хватает данных",
  portfolio: "Карта · разные приоритеты",
  risk: "Высокий риск",
  payback: "Нет окупаемости",
  capacity: "Превышен рабочий фонд",
  critical: "Критическая цена ошибки",
  unneeded: "Автоматизация не нужна",
  many: "Больше пяти процессов",
  correction: "Исправление гипотезы ИИ · демо",
} as const;
export type DialogDemoId = keyof typeof dialogDemoNames;
export function loadDialogDemo(id: DialogDemoId): ConversationState {
  let state = {
    ...initialConversation(),
    industry: "fitness" as const,
    locations: 3,
    systems: ["crm", "tables"],
  };
  if (id === "conversation")
    return say(
      {
        ...state,
        processes: [
          newProcess("reporting"),
          newProcess("missed-leads"),
          newProcess("sales-control"),
        ],
      },
      "Синтетический пример: три клуба, ручные отчёты, пропуски заявок и ручной контроль. Это гипотезы: выберите процесс, чтобы проверить его.",
      "demo",
    );
  if (id === "many")
    return say(
      { ...state, overflow: fitnessScenarios.map((s) => s.id) },
      "Демонстрация: упомянуты все семь направлений. Выберите не больше пяти.",
      "demo",
    );
  if (id === "correction")
    return say(
      {
        ...state,
        processes: [newProcess("reporting")],
        proposalSource: "demo",
        proposal: {
          industry: "fitness",
          locations: 3,
          scaleEvidence: "три клуба",
          systems: [],
          facts: [{ text: "В примере три клуба", evidence: "три клуба" }],
          hypotheses: [
            {
              scenarioId: "onboarding",
              reason: "Возможно, требуется обучение менеджеров",
            },
          ],
          workloads: [],
        },
      },
      "Демонстрация ошибочной трактовки, без вызова OpenAI: описание про отчёты ошибочно связано с обучением. Отклоните предложение или подтвердите после проверки.",
      "demo",
    );
  if (id === "unneeded")
    return say(
      {
        ...state,
        processes: [
          { ...newProcess("reporting"), confirmed: false, asked: ["confirm"] },
        ],
      },
      "Проблема не подтвердилась. Отчёт уже формируется автоматически; новые изменения пока не нужны.",
      "demo",
    );
  const input = loadDemo((id === "critical" ? "risk" : id) as DemoId);
  state = saveCompany(state, {
    ...input.company,
    industry: "fitness",
  }) as typeof state;
  const ids: ScenarioId[] =
    id === "risk" || id === "critical"
      ? ["missed-leads"]
      : id === "missing"
        ? ["transfer"]
        : ["reporting", "missed-leads", "sales-control"];
  for (const [i, core] of input.processes.entries()) {
    const p = newProcess(ids[i]);
    state = { ...state, processes: [...state.processes, p] };
    state = saveCoreProcess(state, {
      ...core,
      id: p.id,
      ...(id === "portfolio" || id === "payback" || id === "missing"
        ? { name: scenarioById(ids[i]).name }
        : {}),
      ...(id === "portfolio" && i === 2
        ? {
            description:
              "Собрать нестандартные статусы продаж из CRM, почты и ERP и согласовать отклонения с управляющим.",
          }
        : {}),
      ...(id === "critical" ? { error: "critical" as const } : {}),
    }) as typeof state;
  }
  return {
    ...state,
    activeId: state.processes[0]?.id ?? null,
    messages: [
      {
        id: "demo-start",
        role: "assistant",
        text: "Загружен полностью вымышленный набор. Это демонстрационные данные, а не ответ ИИ. Можно менять любое значение и сравнивать результаты ядра.",
        source: "demo",
      },
    ],
  };
}
