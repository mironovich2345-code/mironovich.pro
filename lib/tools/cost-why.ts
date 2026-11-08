import { calculateGuided, initialGuided, parseGuided, taskLabels, type GuidedInput, type Measurement, type Task } from "./guided.ts";
import { numberField, record, round2 } from "./input.ts";

export const COST_VERSION = "tools-cost-3.0.0";
export const costTaskLabels: Record<Task, string> = { ...taskLabels, crm: "Заявки клиентов", training: "Обучение", documents: "Документы", calls: "Разбор звонков" };
export type CostBasis = { kind: "unknown" } | { kind: "hourly"; hourly: number } | { kind: "monthly"; monthly: number; hours: number; hoursAssumption: boolean };
export type Timing = Omit<Measurement, "hourlyCost" | "independent"> & { periodAssumption: boolean };
export type CostProcess = { timing: Timing | null; cost: CostBasis; independent: boolean };
export type CostInput = Omit<GuidedInput, "measurements"> & { processes: Record<Task, CostProcess> | Partial<Record<Task, CostProcess>> };
const exact = (r: Record<string, unknown>, keys: string[]) => Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k));
export const hourlyRate = (c: CostBasis): number | null => c.kind === "unknown" ? null : c.kind === "hourly" ? c.hourly : c.monthly / c.hours;
export function parseCostInput(raw: unknown): CostInput | null {
  const s = record(raw), p = record(s?.processes);
  if (!s || !exact(s, ["tasks", "employees", "systems", "impact", "processes"]) || !p) return null;
  const base = parseGuided({ ...s, measurements: {} });
  if (!base || !exact(p, base.tasks)) return null;
  const processes: CostInput["processes"] = {};
  for (const task of base.tasks) {
    const row = record(p[task]), c = record(row?.cost);
    if (!row || !exact(row, ["timing", "cost", "independent"]) || typeof row.independent !== "boolean" || !c) return null;
    let cost: CostBasis;
    if (c.kind === "unknown" && exact(c, ["kind"])) cost = { kind: "unknown" };
    else if (c.kind === "hourly" && exact(c, ["kind", "hourly"]) && numberField(c.hourly, 0, 1_000_000)) cost = { kind: "hourly", hourly: c.hourly as number };
    else if (c.kind === "monthly" && exact(c, ["kind", "monthly", "hours", "hoursAssumption"]) && numberField(c.monthly, 0, 10_000_000) && numberField(c.hours, 1, 744) && typeof c.hoursAssumption === "boolean" && (c.monthly as number) / (c.hours as number) <= 1_000_000) cost = { kind: "monthly", monthly: c.monthly as number, hours: c.hours as number, hoursAssumption: c.hoursAssumption };
    else return null;
    let timing: Timing | null = null;
    if (row.timing !== null) {
      const t = record(row.timing);
      if (!t || !exact(t, ["employees", "frequency", "repetitions", "minutes", "periodsPerMonth", "periodAssumption"]) || typeof t.periodAssumption !== "boolean" || (t.frequency === "month" && t.periodAssumption)) return null;
      const check = parseGuided({ ...base, tasks: [task], measurements: { [task]: { ...t, hourlyCost: hourlyRate(cost), independent: row.independent } } });
      if (!check) return null;
      const m = check.measurements[task]!;
      timing = { employees: m.employees, frequency: m.frequency, repetitions: m.repetitions, minutes: m.minutes, periodsPerMonth: m.periodsPerMonth, periodAssumption: t.periodAssumption };
    }
    processes[task] = { timing, cost, independent: row.independent };
  }
  return { tasks: base.tasks, employees: base.employees, systems: base.systems, impact: base.impact, processes };
}

/** Stable v2 boundary for existing formulas and the separate PR #9. No free text. */
export function costToGuided(input: CostInput): GuidedInput {
  const measurements: GuidedInput["measurements"] = {};
  for (const task of input.tasks) {
    const p = input.processes[task];
    if (p?.timing) {
      const { periodAssumption: _assumption, ...timing } = p.timing;
      void _assumption;
      measurements[task] = { ...timing, hourlyCost: hourlyRate(p.cost), independent: p.independent };
    }
  }
  return { ...initialGuided(), tasks: [...input.tasks], employees: input.employees, systems: [...input.systems], impact: input.impact, measurements };
}
export function calculateCostWhy(raw: CostInput) {
  const input = parseCostInput(raw);
  if (!input) throw new RangeError("Некорректные исходные данные");
  const old = calculateGuided(costToGuided(input));
  const rows = old.rows.map(row => {
    const p = input.processes[row.task]!;
    const operations = p.timing ? p.timing.employees * p.timing.repetitions * p.timing.periodsPerMonth : null;
    const rate = hourlyRate(p.cost);
    return { ...row, annualCost: row.cost === null ? null : round2(row.cost * 12), operations, costPerOperation: p.timing && rate !== null ? round2(p.timing.minutes / 60 * rate) : null, hourlyRate: rate };
  });
  const complete = rows.every(row => row.hours !== null);
  const independent = rows.length === 1 || rows.every(row => row.independent);
  const canSum = complete && independent && !old.overCapacity && !rows.some(row => row.warning);
  const totalHours = canSum ? round2(rows.reduce((sum, row) => sum + row.hours!, 0)) : null;
  const totalCost = canSum && rows.every(row => row.cost !== null) ? round2(rows.reduce((sum, row) => sum + row.cost!, 0)) : null;
  return { rows, complete, independent, overCapacity: old.overCapacity, canSum, totalHours, totalCost, totalAnnualCost: totalCost === null ? null : round2(totalCost * 12), freedHours: null, cashSavings: null };
}

const review: Record<Task, { possibility: string; questions: [string, string] }> = {
  reporting: { possibility: "Если показатели собираются из разных источников, часть времени может уходить на сверку. Сам расчёт не подтверждает ошибки или дублирование.", questions: ["Откуда берутся данные и приходится ли вводить их повторно?", "Какая часть отчёта требует решения человека?"] },
  transfer: { possibility: "Если одна запись переносится несколько раз, стоит проверить необходимость каждого переноса. Повторный ввод здесь не подтверждён.", questions: ["Есть ли единый источник записи?", "Где информация меняется и какие различия действительно нужны?"] },
  crm: { possibility: "Распределение обращений может требовать повторных проверок. Потерянные заявки или пропущенные ответы нельзя установить по времени работы.", questions: ["Кто отвечает за заявку на каждом этапе?", "Какие сведения приходится проверять повторно?"] },
  documents: { possibility: "В типовых документах могут повторяться одни и те же действия. Проверка содержания и ответственность за документ могут остаться у человека.", questions: ["Какие поля повторяются, а какие требуют проверки?", "Когда и почему документ возвращается на исправление?"] },
  answers: { possibility: "Если вопросы повторяются, стоит проверить доступность согласованных ответов. Мы не знаем, какая доля обращений требует индивидуального решения.", questions: ["Какие вопросы действительно повторяются?", "Кто подтверждает ответ в нестандартной ситуации?"] },
  training: { possibility: "Повторные объяснения могут занимать время наставника. Важно отделить поиск материалов от обучения, где нужен личный разбор.", questions: ["Что новичку объясняют повторно?", "Как проверяется понимание, а не только просмотр материала?"] },
  control: { possibility: "Если статус проверяют вручную, стоит выяснить, откуда берутся сведения и кто реагирует на отклонение. Просрочки вводом не подтверждены.", questions: ["Какие изменения действительно требуют внимания?", "Кто отвечает за реакцию и как виден результат?"] },
  calls: { possibility: "Разбор разговоров может требовать заметного внимания. Время проверки нельзя целиком считать потерями; законность и качество анализа нужно выяснить отдельно.", questions: ["На каком основании доступны записи разговоров?", "Какие выводы обязательно должен проверять человек?"] },
  other: { possibility: "Сначала стоит определить границы повторяющейся работы. Нестандартность задачи сама по себе не означает, что нужна разработка или автоматизация.", questions: ["Что поступает на вход и какой результат нужен?", "Что повторяется, а какие исключения требуют решения человека?"] },
};
export function whyReview(task: Task, input: CostInput) {
  const p = input.processes[task]!;
  const timing = p.timing;
  const reason = !timing ? "Пока время не измерено. До вывода о значимости процесса нужно выяснить частоту и длительность работы."
    : timing.repetitions === 0 || timing.minutes === 0 ? "По введённым данным трудозатраты равны нулю. Проверьте, отражает ли это текущую работу; оснований обещать улучшение нет."
    : timing.repetitions <= 1 && timing.frequency === "month" ? "Вы указали редкую операцию. Сам по себе небольшой объём не обосновывает автоматизацию; сначала важны её качество и последствия."
    : "Небольшие операции повторяются и вместе занимают время команды. Это повод проверить процесс, а не доказательство, что всю работу можно убрать.";
  return { ...review[task], reason, title: taskLabels[task] };
}
