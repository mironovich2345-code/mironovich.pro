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
  supportEmail: "damironovich@mail.ru",
  salesEnabled: false,
  legalApproved: false,
} as const;

export const seller = {
  name: "Миронович Данила Юрьевич",
  taxId: "700802400242",
  taxRegime: "Налог на профессиональный доход (НПД)",
  postalAddress: "г. Нижний Новгород, ул. Минеева, д. 25, кв. 3",
  email: "damironovich@mail.ru",
  telegram: "https://t.me/mironovich_pro",
} as const;
