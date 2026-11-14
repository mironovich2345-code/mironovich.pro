import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { authorizePrototype } from "@/lib/business-map/preview-access";
import { aiConfigured } from "@/lib/business-map/dialog/ai-orchestrator";
import { prototypeMode } from "@/lib/business-map/prototype-policy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business Map · закрытый прототип", robots: { index: false, follow: false } };

export default async function BusinessMapPrototypePage() {
  // Recheck at the renderer; never trust a client-supplied middleware "grant" header.
  const access = await authorizePrototype({
    NODE_ENV: process.env.NODE_ENV,
    RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
    BUSINESS_MAP_PROTOTYPE: process.env.BUSINESS_MAP_PROTOTYPE,
    SITE_NOINDEX: process.env.SITE_NOINDEX,
    BUSINESS_MAP_PREVIEW_USERNAME: process.env.BUSINESS_MAP_PREVIEW_USERNAME,
    BUSINESS_MAP_PREVIEW_PASSWORD: process.env.BUSINESS_MAP_PREVIEW_PASSWORD,
  }, (await headers()).get("authorization"));
  if (access !== "allow") notFound();
  const { default: DialogPrototype } = await import("@/components/business-map/dialog/DialogPrototype");
  const preview = prototypeMode(process.env.NODE_ENV, process.env.BUSINESS_MAP_PROTOTYPE, process.env.RAILWAY_ENVIRONMENT_NAME, process.env.SITE_NOINDEX) === "preview";
  return <DialogPrototype aiReady={preview && aiConfigured({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    BUSINESS_MAP_AI_MODEL: process.env.BUSINESS_MAP_AI_MODEL,
    BUSINESS_MAP_AI_ENABLED: process.env.BUSINESS_MAP_AI_ENABLED,
  })} />;
}
