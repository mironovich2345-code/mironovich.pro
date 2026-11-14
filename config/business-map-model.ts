/** Initial assumptions [Г]. Change version whenever any rule changes. */
export const businessMapModel = {
  version: "business-map-v1.1", salaryLoad: 1.3, monthlyHours: 165,
  periods: { day: [21, 1], week: [52, 12], month: [1, 1] },
  mechanical: { under25: [0, 0.125, 0.25], from25to50: [0.25, 0.375, 0.5], from50to75: [0.5, 0.625, 0.75], over75: [0.75, 0.875, 1] },
  exceptions: { under10: [0, 0.05, 0.1], from10to30: [0.1, 0.2, 0.3], from30to50: [0.3, 0.4, 0.5] },
  review: [0.3, 0.2, 0.1], durationRangeSelection: ["lower", "point", "upper"], confidence: { measuredUnknownMax: 0, estimatedUnknownMax: 1 }, valueFTE: [0.1, 0.3], longPaybackMonths: 24, lowRepeatMonthly: 2,
  complexity: { access: { available: 0, unknown: 1, manual: 2 }, systemCount: [0, 1, 2], mixedOffline: 2, regulation: { yes: 0, partial: 1, no: 2 }, exceptions: { under10: 0, from10to30: 1, from30to50: 2 }, judgment: { rare: 0, sometimes: 1, mostly: 2 }, thresholds: [4, 7] },
  risk: { error: { minor: 0, noticeable: 1, serious: 2, critical: 2 }, judgmentMostly: 1, personalData: 1, thresholds: [2, 3] },
  matrix: { high: ["first", "first", "later"], medium: ["first", "later", "not-now"], low: ["later", "not-now", "not-now"] },
  groupOrder: ["first", "preliminary", "later", "prepare", "not-now", "insufficient", "excluded"], confidenceOrder: ["high", "medium", "low"],
  sortLocale: "ru",
  display: { hourlyRateStep: 0.01, hoursStep: 0.1, rublesStep: 100, largeRublesStep: 1000, largeRublesFrom: 100000, fteStep: 0.001, monthsStep: 1 },
  limits: { processes: 5, employees: 50, monthlyOperations: 10000, minutes: [1, 600], money: 1e9, hourlyRate: 1e6, monthlyHours: [1, 744], salaryLoad: [1, 3] },
} as const;
type Widen<T> = T extends string ? string : T extends number ? number : { readonly [K in keyof T]: Widen<T[K]> };
// Keep categorical rules type safe while permitting numeric calibration.
export type BusinessMapModel = Omit<Widen<typeof businessMapModel>, "matrix" | "groupOrder" | "confidenceOrder"> & Pick<typeof businessMapModel, "matrix" | "groupOrder" | "confidenceOrder">;
