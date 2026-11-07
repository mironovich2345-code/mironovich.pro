import "server-only";
import { aiRecommendationsPolicy } from "../../config/ai-recommendations";
import { recommendationAvailable } from "./recommendation-availability";

/** Request-time evaluation; only the boolean crosses the Server/Client Component boundary. */
export function openAiAvailable(): boolean {
  return recommendationAvailable(process.env, aiRecommendationsPolicy.externalProcessingApproved);
}
