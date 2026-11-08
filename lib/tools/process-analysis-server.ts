import "server-only";
import { headers } from "next/headers";
import { liveAnalysisAvailable, mockAnalysisAvailable } from "./process-analysis-policy";
export async function processAnalysisAvailability(): Promise<"off" | "mock" | "live"> {
  const requestHeaders = await headers();
  if (mockAnalysisAvailable(process.env, requestHeaders.get("host") ?? "")) return "mock";
  return liveAnalysisAvailable(process.env) ? "live" : "off";
}
