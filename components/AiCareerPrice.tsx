import { ALLOWED_PRICES_RUB, rubles, type CurrentPrice } from "@/config/ai-career-pricing";

/** The one price in force (the same source as the order and the payment request). No counters, no struck-through prices, no timers. */
export default function AiCareerPrice({ price }: { price: CurrentPrice }) {
  if (!price.known) {
    return (
      <p className="m-0 max-w-[60ch] text-[15px] leading-relaxed text-cream/85">
        Действующая цена — {ALLOWED_PRICES_RUB.map(rubles).join(", ").replace(/, ([^,]*)$/, " или $1")} — будет показана при оформлении заказа до подтверждения оплаты.
      </p>
    );
  }
  return (
    <div>
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-signal">{price.mode === "default" ? "Цена на старте продаж" : "Действующая цена"}</p>
      <p className="m-0 mt-2 font-display text-[clamp(40px,7vw,56px)] font-extrabold leading-none text-cream">{rubles(price.priceRub)}</p>
    </div>
  );
}
