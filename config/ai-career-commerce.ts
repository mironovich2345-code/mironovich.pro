/**
 * Sales must remain disabled until the platform, payments, tax receipts and legal
 * documents have passed the launch checklist.
 * This file only describes the intended offer; it does not enable checkout.
 */
export const aiCareerCommerce = {
  title: "Как стать ценнее для компании с помощью ИИ",
  /** Launch price. The price in force is set at run time — config/ai-career-pricing.ts, lib/server/commerce/price-periods.ts. */
  priceRub: 1993,
  extensionPriceRub: 1490,
  accessDays: 90,
  retentionDaysAfterExpiry: 30,
  extensionMonths: 12,
  analysesIncluded: 1,
  diagnosticQuestions: 18,
  minimumBuyerAge: 18,
  planSteps: 30,
  refundWindowDays: 7,
  refundProcessingDays: 10,
  supportEmail: "damironovich@mail.ru",
  salesEnabled: false,
  legalApproved: false,
} as const;

/** Shared proposed terms, never a statement that checkout or hosting is live. */
export const commerceCopy = {
  pricePeriods: "Цена может меняться в разные периоды: 1 993 ₽, 3 990 ₽ или 5 900 ₽. Сумма фиксируется в заказе при его оформлении и после этого не меняется.",
  initialPurchase: "Первоначальная покупка: одна диагностика из 18 основных вопросов, один персональный анализ, план из 30 шагов, PDF и 90 дней доступа с момента фактической выдачи.",
  refundWindow: "Полный возврат при отказе в течение семи дней, не считая дня оплаты; прохождение анализа и скачивание PDF не уменьшают сумму возврата.",
  age: "Покупатели продукта — только совершеннолетние лица 18+.",
  edition: "Проект к утверждению от 17 ноября 2026 года; дата начала действия не назначена.",
} as const;

export const seller = {
  name: "Миронович Данила Юрьевич",
  taxId: "700802400242",
  taxRegime: "Налог на профессиональный доход (НПД)",
  taxStatusConfirmedOn: "2026-11-17",
  postalAddress: "г. Нижний Новгород, ул. Минеева, д. 25, кв. 3",
  email: "damironovich@mail.ru",

  telegram: "https://t.me/mironovich_pro",
} as const;
