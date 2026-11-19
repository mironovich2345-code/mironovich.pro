import { notFound } from "next/navigation";
import CareerV3App from "@/components/career-v3/CareerV3App";
import { sandboxVisible } from "@/lib/server/career/config";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "AI Career 3.0 — тестовый кабинет",
  robots: { index: false, follow: false },
};
export default function Page() {
  if (!sandboxVisible()) notFound();
  return <CareerV3App />;
}
