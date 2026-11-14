import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { authorizePrototype } from "@/lib/business-map/preview-access";

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
  const { default: Prototype } = await import("@/components/business-map/Prototype");
  return <Prototype />;
}
