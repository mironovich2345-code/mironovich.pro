import { PRICE_TIERS, rubles, seatsWord, type PriceView } from "@/config/ai-career-pricing";

/**
 * Three price tiers in one row (stacked rows on narrow phones). The current tier carries the red accent.
 * The seat counter appears only with server-confirmed data; otherwise only the tier conditions are shown.
 */
export default function AiCareerPriceTiers({ view }: { view: PriceView }) {
  const { current, remaining } = view;
  return (
    <div>
      <ol className="grid gap-3 min-[640px]:grid-cols-3 min-[640px]:gap-4" aria-label="Ценовые этапы">
        {PRICE_TIERS.map((t, i) => {
          const active = t.id === current.id;
          const past = PRICE_TIERS.findIndex((x) => x.id === current.id) > i;
          return (
            <li
              key={t.id}
              aria-current={active ? "step" : undefined}
              className={
                "relative flex list-none items-center justify-between gap-4 p-4 min-[640px]:flex-col min-[640px]:items-start min-[640px]:justify-start min-[640px]:p-6 " +
                (active ? "border-2 border-signal bg-signal/[0.09]" : "border border-cream/20 bg-cream/[0.03]")
              }
            >
              <div>
                <p className={"m-0 text-xs font-semibold uppercase tracking-[0.14em] " + (active ? "text-signal" : "text-stone")}>
                  {t.label}
                  {active && <span className="mt-1 block text-[13px] normal-case tracking-normal">{remaining ? "Текущий этап" : "Цена на старте продаж"}</span>}
                  {past && <span className="mt-1 block text-[13px] normal-case tracking-normal">Завершён</span>}
                </p>
                <p className="m-0 mt-1.5 text-[14px] leading-snug text-cream/85 min-[640px]:mt-3">{t.condition}</p>
              </div>
              <p
                className={
                  "m-0 shrink-0 font-display font-extrabold leading-none min-[640px]:mt-5 " +
                  (active ? "text-[30px] text-cream min-[640px]:text-[40px]" : "text-[24px] text-cream/75 min-[640px]:text-[32px]")
                }
              >
                {rubles(t.priceRub)}
              </p>
            </li>
          );
        })}
      </ol>

      {remaining ? (
        <div className="mt-5" aria-live="polite">
          <p className="m-0 text-[15px] font-semibold text-cream">
            По цене {rubles(current.priceRub)} осталось {remaining.left} из {remaining.of} {seatsWord(remaining.of)}
          </p>
          <div role="img" aria-label={`Осталось ${remaining.left} из ${remaining.of} ${seatsWord(remaining.of)}`} className="mt-3 grid max-w-[420px] gap-1" style={{ gridTemplateColumns: `repeat(${remaining.of}, minmax(0, 1fr))` }}>
            {Array.from({ length: remaining.of }, (_, i) => (
              <span key={i} className={"h-2.5 " + (i < remaining.of - remaining.left ? "bg-cream/20" : "bg-signal")} />
            ))}
          </div>
          <p className="m-0 mt-2 text-[13px] leading-relaxed text-stone">Счёт ведётся по подтверждённым оплатам и заказам, которые оформляются прямо сейчас.</p>
        </div>
      ) : (
        <p className="m-0 mt-5 max-w-[70ch] text-[13px] leading-relaxed text-stone">
          Оставшееся количество мест появится после запуска продаж: оно будет считаться только по подтверждённым оплатам. Сейчас покупки не принимаются.
        </p>
      )}
    </div>
  );
}
