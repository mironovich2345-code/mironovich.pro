import { createChatHandler } from "@/lib/business-map/dialog/chat-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const POST=createChatHandler({env:()=>({
  NODE_ENV:process.env.NODE_ENV,RAILWAY_ENVIRONMENT_NAME:process.env.RAILWAY_ENVIRONMENT_NAME,
  BUSINESS_MAP_PROTOTYPE:process.env.BUSINESS_MAP_PROTOTYPE,SITE_NOINDEX:process.env.SITE_NOINDEX,
  BUSINESS_MAP_PREVIEW_USERNAME:process.env.BUSINESS_MAP_PREVIEW_USERNAME,BUSINESS_MAP_PREVIEW_PASSWORD:process.env.BUSINESS_MAP_PREVIEW_PASSWORD,
  BUSINESS_MAP_AI_ENABLED:process.env.BUSINESS_MAP_AI_ENABLED,BUSINESS_MAP_AI_MODEL:process.env.BUSINESS_MAP_AI_MODEL,OPENAI_API_KEY:process.env.OPENAI_API_KEY,
})});
