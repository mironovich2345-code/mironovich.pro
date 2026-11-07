import { createRecommendationHandler } from "@/lib/tools/recommendation-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createRecommendationHandler();
