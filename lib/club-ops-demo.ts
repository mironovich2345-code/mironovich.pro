/**
 * Standalone, synthetic CLUB OPS demonstration.
 * This is NOT connected to the CLUB OPS app, its database or any client.
 */
export type ExpenseLine = { key: "payroll" | "rent" | "marketing"; label: string; plan: number; fact: number };

export const BASE_EXPENSES: ExpenseLine[] = [
  { key: "payroll", label: "Фонд оплаты труда", plan: 280_000, fact: 330_000 },
  { key: "rent", label: "Аренда", plan: 140_000, fact: 140_000 },
  { key: "marketing", label: "Маркетинг", plan: 80_000, fact: 140_000 },
];

export const BASE_CASH = {
  opening: 200_000,
  receipts: 1_600_000,
  payments: 2_050_000,
} as const;

export const BASE_CHANNELS = [
  { key: "direct", label: "Директ", spend: 120_000, sales: 12 },
  { key: "vk", label: "VK", spend: 90_000, sales: 5 },
] as const;

export function summarizeExpenses(lines: readonly ExpenseLine[]) {
  const plan = lines.reduce((sum, line) => sum + line.plan, 0);
  const fact = lines.reduce((sum, line) => sum + line.fact, 0);
  return { plan, fact, difference: fact - plan };
}

export function forecastCash(input: { opening: number; receipts: number; payments: number }) {
  return input.opening + input.receipts - input.payments;
}

export function costPerSale(spend: number, sales: number): number | null {
  return sales > 0 ? spend / sales : null;
}

export function formatRub(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}
