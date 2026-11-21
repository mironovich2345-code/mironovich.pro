import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CareerV3App from "@/components/career-v3/CareerV3App";
import DemoApp from "@/components/career-demo/DemoApp";
import { sandboxVisible } from "@/lib/server/career/config";
import { demoConfig, demoRequested } from "@/lib/server/career-demo/config";
export const dynamic = "force-dynamic";
export function generateMetadata(): Metadata {
  return {
    title: demoConfig() ? { absolute: "AI Career 3.0 — закрытая демоверсия" } : "AI Career 3.0 — тестовый кабинет",
    robots: { index: false, follow: false },
  };
}
export default function Page() {
  // Closed cloud demo: only with a fully valid demo configuration. A demo deploy with a broken
  // configuration stays closed (404) instead of falling back to any other mode.
  if (demoConfig()) return <DemoApp />;
  if (demoRequested() || !sandboxVisible()) notFound();
  return <CareerV3App />;
}
