import { openAiAvailable } from "@/lib/tools/server-availability";
import GuidedCalculator from "./GuidedCalculator";
export default function AutomationCalculator() { return <GuidedCalculator mode="automation-cost" openAiAvailable={openAiAvailable()} />; }
