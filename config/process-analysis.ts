/** Independent gates: the legacy publication exception does not approve OpenAI.
 * Change only after owner/legal, provider/pricing and durable-budget staging review. */
export const processAnalysisPolicy = {
  externalProcessingApproved: false,
  providerAndPricingVerified: false,
  model: "gpt-5.4-mini-2026-03-17",
  // Candidate pricing inherited from v2; must be reverified before enabling.
  inputMicroUsdPerMillion: 750_000,
  outputMicroUsdPerMillion: 4_500_000,
  maxModelContextTokens: 400_000,
  maxOutputTokens: 1800,
  // Reserve the entire candidate model context plus capped output, without refunds.
  reservationMicroUsd: 308_100,
  timeoutMs: 15_000,
  maxRequestCharacters: 4000,
  maxResponseCharacters: 50_000,
} as const;
