/**
 * Sales must remain disabled until the platform, payments, tax receipts and legal
 * documents have passed the launch checklist.
 * This file only describes the intended offer; it does not enable checkout.
 */
export const aiCareerCommerce = {
  title: "Как стать ценнее для компании с помощью ИИ",
  priceRub: 1990,
  extensionPriceRub: 1490,
  accessDays: 90,
  retentionDaysAfterExpiry: 30,
  extensionMonths: 12,
  analysesIncluded: 1,
  minimumBuyerAge: 18,
  planDays: 30,
  refundWindowDays: 7,
  refundProcessingDays: 10,
  supportEmail: "damironovich@mail.ru",
  salesEnabled: false,
  legalApproved: false,
} as const;

/** Shared proposed terms, never a statement that checkout or hosting is live. */
export const commerceCopy = {
  initialPurchase: "1 990 ₽: одна диагностика, один персональный анализ, план на 30 дней, PDF и 90 дней доступа с момента фактической выдачи.",
  refundWindow: "Полный возврат при отказе в течение семи дней, не считая дня оплаты; прохождение анализа и скачивание PDF не уменьшают сумму возврата.",
  age: "Покупатели продукта — только совершеннолетние лица 18+.",
  edition: "Проект к утверждению от 17 ноября 2026 года; дата начала действия не назначена.",
} as const;

export const seller = {
  name: "Миронович Данила Юрьевич",
  taxId: "700802400242",
  taxRegime: "Налог на профессиональный доход (НПД)",
  postalAddress: "г. Нижний Новгород, ул. Минеева, д. 25, кв. 3",
  email: "damironovich@mail.ru",
  phone: "+7 952 754-14-98",
  phoneHref: "tel:+79527541498",
  telegram: "https://t.me/mironovich_pro",
} as const;
