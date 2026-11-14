import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prototypeAvailable } from "@/lib/business-map/prototype-policy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business Map · закрытый прототип", robots: { index: false, follow: false } };

export default async function BusinessMapPrototypePage() {
  if (!prototypeAvailable(process.env.NODE_ENV, process.env.BUSINESS_MAP_PROTOTYPE)) notFound();
  const { default: Prototype } = await import("@/components/business-map/Prototype");
  return <Prototype />;
}
