import { notFound } from "next/navigation";
import CareerSandbox from "@/components/CareerSandbox";
import { sandboxVisible } from "@/lib/server/career/config";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Закрытый учебный кабинет",
  robots: { index: false, follow: false },
};
export default function Page() {
  if (!sandboxVisible()) notFound();
  return <CareerSandbox />;
}
