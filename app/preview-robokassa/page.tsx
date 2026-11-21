// Stage-1 preview only: an emulator of the Robokassa TEST payment page, used while the shop's Robokassa account is not
// connected. It shows exactly what the shop sent (amount, invoice, signature check) and never touches real money.
import { notFound } from "next/navigation";
import { demoConfig } from "@/lib/server/career-demo/config";
import { verifyRequest } from "@/lib/server/commerce/robokassa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Эмулятор тестовой оплаты", robots: { index: false, follow: false } };

export default async function PreviewRobokassa({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = demoConfig();
  const rk = c?.commerce?.robokassa;
  if (!c || rk?.mode !== "emulator") notFound();
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") p.set(k, v);
  const valid = verifyRequest(rk, p);
  return (
    <main className="min-h-screen bg-[#F2EFE8] px-4 py-10 text-[#0E0E11]">
      <div className="mx-auto max-w-md rounded-lg border border-[#0E0E11]/15 bg-white p-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[#B3261E]">Эмулятор Robokassa · тестовый режим · без списаний</p>
        <h1 className="mt-2 text-2xl font-bold">Оплата заказа № {p.get("InvId")}</h1>
        {valid ? (
          <>
            <p className="mt-4 text-[15px]">{p.get("Description")}</p>
            <p className="mt-3 text-4xl font-bold" data-testid="emulator-sum">{p.get("OutSum")} ₽</p>
            <p className="mt-2 text-[13px] text-[#555]">Подпись запроса проверена (Пароль #1, IsTest=1). Настоящая страница Robokassa подключится после активации магазина.</p>
            <form method="post" action="/api/career/pay/emulator" className="mt-6 grid gap-3">
              {[...p.entries()].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <button name="decision" value="pay" className="min-h-12 rounded-md bg-[#0E0E11] px-4 font-semibold text-white">Оплатить (тест)</button>
              <button name="decision" value="cancel" className="min-h-12 rounded-md border border-[#0E0E11]/30 px-4 font-semibold">Отказаться от оплаты</button>
            </form>
          </>
        ) : (
          <p className="mt-4 rounded-md border border-[#B3261E]/40 bg-[#FBEDEB] p-3 text-[15px]">Ошибка 29: неверная подпись запроса. Оплата невозможна.</p>
        )}
      </div>
    </main>
  );
}
