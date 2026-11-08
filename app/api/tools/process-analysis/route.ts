import { createProcessAnalysisHandler } from "@/lib/tools/process-analysis-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createProcessAnalysisHandler();
