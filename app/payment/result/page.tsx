import { notFound } from "next/navigation";
import CareerSandbox from "@/components/CareerSandbox";
import { sandboxVisible } from "@/lib/server/career/config";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Проверка тестового заказа",
  robots: { index: false, follow: false },
};
export default function Page() {
  if (!sandboxVisible()) notFound();
  return (
    <>
      <p className="mx-auto max-w-5xl px-[22px] pt-8 text-cream">
        Возврат с платёжной страницы не подтверждает оплату. Войдите и нажмите
        независимую проверку заказа; доступ выдаётся только после серверной
        проверки.
      </p>
      <CareerSandbox />
    </>
  );
}
