import { openAiAvailable } from "@/lib/tools/server-availability";
import GuidedCalculator from "./GuidedCalculator";
export default function LaborCalculator() { return <GuidedCalculator mode="labor-cost" openAiAvailable={openAiAvailable()} />; }
