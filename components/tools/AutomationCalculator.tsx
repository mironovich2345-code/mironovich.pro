import { openAiAvailable } from "@/lib/tools/server-availability";
import GuidedCalculator from "./GuidedCalculator";
import { processAnalysisAvailability } from "@/lib/tools/process-analysis-server";
export default async function AutomationCalculator() { return <GuidedCalculator mode="automation-cost" openAiAvailable={openAiAvailable()} processAnalysisMode={await processAnalysisAvailability()} />; }
