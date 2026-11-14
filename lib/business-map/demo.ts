import type { BusinessMapInput, Company, Process } from "./contracts.ts";

export const demoCompany: Company = { industry: "services", headcount: "11-50", goal: "cost", systems: ["crm", "tables", "mail"], salary: 60000 };
export function emptyProcess(id: string, name = ""): Process {
  return { id, name, employees: null, operations: null, period: "day", minutes: null, source: "estimate", mechanical: "unknown", systems: null, regulation: "unknown", exceptions: "unknown", error: "unknown", judgment: "unknown", access: "unknown", personalData: "unknown", independent: false, overlapsWith: [] };
}
const reporting: Process = { ...emptyProcess("reports", "Сбор еженедельных отчётов"), description: "Собрать данные из CRM в сводную таблицу и проверить значения.", employees: 3, operations: 40, period: "day", minutes: 12, source: "measured", mechanical: "from50to75", systems: ["crm", "tables"], regulation: "yes", exceptions: "from10to30", error: "minor", judgment: "rare", access: "available", personalData: "no", independent: true };
const requests: Process = { ...reporting, id: "requests", name: "Проверка клиентских заявок", operations: 20, systems: ["crm"], error: "serious", personalData: "yes" };
const contracts: Process = { ...reporting, id: "contracts", name: "Согласование нестандартных договоров", operations: 8, period: "month", minutes: 45, systems: ["crm", "mail", "erp"], regulation: "no", judgment: "sometimes", access: "manual", exceptions: "from30to50", mechanical: "from25to50" };
export const demoNames = { portfolio: "Три процесса · разные приоритеты", missing: "Не хватает данных", risk: "Высокий риск", payback: "Нет окупаемости", capacity: "Превышен рабочий фонд" } as const;
export type DemoId = keyof typeof demoNames;
/** Synthetic fixtures only. Callers receive a fresh copy, never a shared mutable draft. */
export function loadDemo(id: DemoId): BusinessMapInput {
  const processes: Process[] = id === "portfolio" ? [reporting, requests, contracts]
    : id === "missing" ? [{ ...emptyProcess("missing", "Обработка входящих документов"), employees: 2 }]
    : id === "risk" ? [requests]
    : id === "capacity" ? [{ ...reporting, id: "capacity", name: "Проверка перегруженной команды", employees: 1, operations: 100, minutes: 60 }]
    : [{ ...reporting, cash: { disposition: "retained", replaceableHours: 0, replacementRate: 0, cancelledPayments: 2000 }, costs: { implementation: [80000,120000], training: [0,0], licenses: [3000,3000], maintenance: [0,0], external: [0,0] } }];
  return structuredClone({ company: { ...demoCompany, salary: id === "missing" ? null : demoCompany.salary }, processes });
}
