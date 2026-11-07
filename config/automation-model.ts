/** Initial engineering hypotheses, not market research or a commercial offer.
 * Owner approval AND explicit public enablement are required to show money.
 * Change version/date whenever hours, coefficients or prices change.
 * See docs/tools/model.md for assumptions and approval checklist.
 */
export const automationModel = {
  version: "automation-2026-11-07-draft-1",
  date: "2026-11-07",
  approvedByOwner: false,
  publicPricingEnabled: false,
  hourlyRate: 3000,
  stages: {
    requirements: [4, 8], design: [4, 12], integration: [6, 16],
    backend: [8, 24], frontend: [12, 32], documents: [8, 24], ai: [16, 48], deployment: [4, 8],
  },
  testingFraction: [0.2, 0.35],
  dataFactor: { clean: 1, mixed: 1.25, poor: 1.6 },
  loadFactor: { low: 1, medium: 1.25, high: 1.5 },
  noApiFactor: 2,
  monthly: {
    infrastructure: [1000, 4000], servicesPerIntegration: [0, 1500],
    ai: { low: [500, 3000], medium: [3000, 15000], high: [15000, 60000] },
    supportHours: [2, 6],
  },
} as const;
