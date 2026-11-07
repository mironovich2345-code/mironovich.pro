/** Fail closed until the owner and legal review approve the external-processing notice.
 * This is not flipped by an environment variable or a production deploy. */
export const aiRecommendationsPolicy = {
  externalProcessingApproved: false,
  maxDailyRequestsPerInstance: 30,
  timeoutMs: 12000,
  maxOutputTokens: 1200,
  maxRequestCharacters: 3000,
} as const;
