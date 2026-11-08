import { processAnalysisPolicy } from "../../config/process-analysis.ts";
export type AnalysisEnv = Readonly<Record<string, string | undefined>>;
export type AnalysisGates = { externalProcessingApproved: boolean; providerAndPricingVerified: boolean };
export function liveAnalysisAvailable(env: AnalysisEnv, gates: AnalysisGates = processAnalysisPolicy): boolean {
  return gates.externalProcessingApproved && gates.providerAndPricingVerified && env.PROCESS_ANALYSIS_ENABLED === "true" && Boolean(env.OPENAI_API_KEY?.trim()) && env.OPENAI_MODEL === processAnalysisPolicy.model && Boolean(env.PROCESS_ANALYSIS_DATABASE_URL?.trim()) && /^[a-z0-9_-]{1,64}$/.test(env.PROCESS_ANALYSIS_BUDGET_ID ?? "");
}
export function mockAnalysisAvailable(env: AnalysisEnv, host: string): boolean {
  return env.PROCESS_ANALYSIS_MODE === "mock" && env.PROCESS_ANALYSIS_ENABLED === "true" && !env.RAILWAY_ENVIRONMENT_NAME && !env.VERCEL_ENV && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
}
