/** Pure server policy shared by rendering and the API. Never serialize env/config to the client. */
export function recommendationAvailable(
  env: Readonly<Record<string, string | undefined>>,
  legalApproved: boolean,
): boolean {
  return legalApproved === true
    && env.AI_RECOMMENDATIONS_ENABLED === "true"
    && Boolean(env.OPENAI_API_KEY?.trim())
    && ["gpt-5.4-mini", "gpt-5.4-mini-2026-03-17"].includes(env.OPENAI_MODEL ?? "");
}
