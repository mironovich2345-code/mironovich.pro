import { numberField, record, round2, type Parsed } from "./input.ts";

export const LABOR_VERSION = "labor-1.0.0";
export const laborFields = {
  employees: { label: "Количество сотрудников", min: 0, max: 10000, integer: true },
  operationsPerDay: { label: "Операций на сотрудника в день", min: 0, max: 10000, integer: true },
  minutesPerOperation: { label: "Минут на одну операцию", min: 0, max: 1440, integer: false },
  workingDays: { label: "Рабочих дней в месяц", min: 0, max: 31, integer: true },
  hourlyCost: { label: "Полная стоимость часа, ₽", min: 0, max: 1000000, integer: false },
  automationPercent: { label: "Потенциальная доля автоматизации, %", min: 0, max: 100, integer: false },
} as const;
export type LaborInput = { [K in keyof typeof laborFields]: number };
export type LaborResult = {
  monthlyHours: number; monthlyCost: number; annualCost: number;
  freedHours: number; freedTimeValue: number;
};

export function parseLaborInput(raw: unknown): Parsed<LaborInput> {
  const src = record(raw);
  if (!src) return { ok: false, errors: { form: "Нужны исходные параметры расчёта." } };
  const errors: Record<string, string> = {};
  for (const [key, spec] of Object.entries(laborFields)) {
    if (!numberField(src[key], spec.min, spec.max, spec.integer)) {
      errors[key] = `Введите ${spec.integer ? "целое число" : "число"} от ${spec.min} до ${spec.max}.`;
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const input = Object.fromEntries(Object.keys(laborFields).map((k) => [k, src[k]])) as LaborInput;
  const hours = input.employees * input.operationsPerDay * input.minutesPerOperation / 60 * input.workingDays;
  if (hours > 100000000 || hours * input.hourlyCost * 12 > 1000000000000) {
    return { ok: false, errors: { form: "Совокупный объём слишком велик. Разделите расчёт на отдельные процессы." } };
  }
  return { ok: true, value: input };
}

/** No contact or process name is needed to calculate a result. */
export function calculateLabor(raw: LaborInput): LaborResult {
  const parsed = parseLaborInput(raw);
  if (!parsed.ok) throw new RangeError("Invalid labor input");
  const i = parsed.value;
  const hours = i.employees * i.operationsPerDay * i.minutesPerOperation / 60 * i.workingDays;
  const monthlyCost = round2(hours * i.hourlyCost);
  return {
    monthlyHours: round2(hours), monthlyCost, annualCost: round2(monthlyCost * 12),
    freedHours: round2(hours * i.automationPercent / 100),
    freedTimeValue: round2(monthlyCost * i.automationPercent / 100),
  };
}
