"use client";
// Admin cabinet forms: price mode/price (radio buttons, reason, explicit confirmation) and refund records.
// The server re-checks the role and every value; these forms only collect the decision.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALLOWED_PRICES_RUB, autoPriceFor, rubles, type AllowedPriceRub } from "@/config/ai-career-pricing";

async function post(action: string, body: unknown) {
  const r = await fetch("/api/career/admin/" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const v = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String(v.error ?? "Не удалось сохранить"));
  return v as { message: string };
}

type Choice = "auto" | AllowedPriceRub;

export function PriceForm({ mode, manualPriceRub, currentPriceRub, paidSales }: { mode: "auto" | "manual"; manualPriceRub: number | null; currentPriceRub: number; nextSale: number | null; paidSales: number; reserved: number }) {
  const router = useRouter();
  const initial: Choice = mode === "auto" ? "auto" : (manualPriceRub as AllowedPriceRub);
  const [choice, setChoice] = useState<Choice>(initial);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // AUTO after switching back: the tier follows confirmed sales (reservations are re-counted on the server).
  const autoPrice = autoPriceFor(paidSales + 1);
  const newPrice = choice === "auto" ? autoPrice : choice;
  const unchanged = choice === initial;
  const option = (value: Choice, title: string, note: string) => (
    <label className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 ${choice === value ? "border-graphite bg-white" : "border-graphite/20 bg-white/60"}`}>
      <input type="radio" name="price-mode" className="mt-1 h-5 w-5 accent-[#0E0E11]" checked={choice === value} onChange={() => { setChoice(value); setConfirm(false); setResult(null); }} />
      <span><span className="block font-semibold">{title}</span><span className="block text-[13px] text-graphite/65">{note}</span></span>
    </label>
  );
  return (
    <form className="mt-6 rounded-lg border border-graphite/15 bg-[#FBF9F4] p-4 sm:p-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setResult(null);
      try {
        const r = await post("price", { mode: choice === "auto" ? "auto" : "manual", ...(choice === "auto" ? {} : { priceRub: choice }), reason, confirm });
        setResult({ ok: true, text: r.message }); setReason(""); setConfirm(false); router.refresh();
      } catch (x) { setResult({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
    }}>
      <fieldset>
        <legend className="text-[19px] font-bold">Режим и цена</legend>
        <div className="mt-3 grid gap-2.5 md:grid-cols-2">
          {option("auto", "AUTO — по числу подтверждённых продаж", `№ 1–10: 1 993 ₽ · № 11–20: 3 990 ₽ · № 21–40 и далее: 5 900 ₽. Сейчас продаж: ${paidSales}`)}
          {ALLOWED_PRICES_RUB.map((p) => option(p, `MANUAL — ${rubles(p)}`, "для всех новых заказов и публичных страниц"))}
        </div>
      </fieldset>
      <label className="mt-4 block">
        <span className="block text-[15px] font-semibold">Причина изменения</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} required minLength={3}
          className="mt-1.5 w-full rounded-md border border-graphite/30 bg-white px-3 py-2 text-[16px]" placeholder="Например: старт продаж, решение после 40-й продажи" />
      </label>
      <p className="mt-3 rounded-md bg-white p-3 text-[15px]" aria-live="polite">
        Сейчас: <b>{rubles(currentPriceRub)}</b>. После изменения для новых заказов: <b>{rubles(newPrice)}</b>{choice === "auto" ? " (AUTO, ступень пересчитается по подтверждённым продажам)" : " (MANUAL)"}. Уже созданные заказы не меняются.
      </p>
      <label className="mt-3 flex items-start gap-3 text-[15px]">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#0E0E11]" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} disabled={unchanged} />
        <span>Подтверждаю изменение цены</span>
      </label>
      {result && <p role={result.ok ? "status" : "alert"} className={`mt-3 rounded-md p-3 text-[15px] ${result.ok ? "bg-[#EAF4EC]" : "bg-[#FBEDEB] text-[#8E1F17]"}`}>{result.text}</p>}
      <button type="submit" disabled={busy || unchanged || !confirm || reason.trim().length < 3}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-graphite px-5 font-semibold text-cream disabled:opacity-40 sm:w-auto">
        {busy ? "Сохраняем…" : "Применить"}
      </button>
    </form>
  );
}

export function RefundButton({ orderId, invId }: { orderId: string; invId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-md border border-graphite/30 px-3 text-[14px] font-semibold">Записать возврат</button>;
  return (
    <form className="grid min-w-[220px] gap-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      try { await post("refund", { orderId, reason, confirm: true }); router.refresh(); } catch (x) { setError((x as Error).message); } finally { setBusy(false); }
    }}>
      <label className="text-[13px] font-semibold">Причина возврата по заказу № {invId}
        <input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} className="mt-1 block min-h-10 w-full rounded-md border border-graphite/30 px-2 text-[15px] font-normal" />
      </label>
      {error && <p role="alert" className="text-[13px] text-[#8E1F17]">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy || reason.trim().length < 3} className="min-h-10 rounded-md bg-graphite px-3 text-[14px] font-semibold text-cream disabled:opacity-40">Подтвердить</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-md border border-graphite/30 px-3 text-[14px]">Отмена</button>
      </div>
    </form>
  );
}
