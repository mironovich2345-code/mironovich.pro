"use client";

import { useState } from "react";
import {
  BASE_CASH, BASE_CHANNELS, BASE_EXPENSES,
  costPerSale, forecastCash, formatRub, summarizeExpenses,
  type ExpenseLine,
} from "@/lib/club-ops-demo";

type View = "expenses" | "cash" | "channels";
const tabs: { key: View; label: string; hint: string }[] = [
  { key: "expenses", label: "План / факт", hint: "Расходы и отклонения" },
  { key: "cash", label: "Кассовый разрыв", hint: "Остаток денег" },
  { key: "channels", label: "Рекламные каналы", hint: "Цена одной продажи" },
];

function Metric({ label, value, detail, negative = false }: { label: string; value: string; detail?: string; negative?: boolean }) {
  return (
    <div className="min-w-0 border border-graphite/15 bg-white p-5">
      <p className="m-0 text-[12px] uppercase tracking-[0.08em] text-graphite/65">{label}</p>
      <p className={"mb-0 mt-3 break-words font-display text-[clamp(22px,3vw,33px)] font-bold " + (negative ? "text-maroon" : "text-graphite")}>{value}</p>
      {detail && <p className="mb-0 mt-2 text-[13px] leading-relaxed text-graphite/65">{detail}</p>}
    </div>
  );
}

function RangeField({ id, label, value, min, max, step, onChange, count = false }: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  onChange: (value: number) => void; count?: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[14px] font-medium text-graphite">{label}</label>
        <output htmlFor={id} className="font-display text-[18px] font-bold tabular-nums text-graphite">{count ? value + " продаж" : formatRub(value)}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="w-full cursor-pointer accent-[#b82323]" />
      <div className="mt-1 flex justify-between text-[11px] text-graphite/55">
        <span>{count ? min : formatRub(min)}</span>
        <span>{count ? max : formatRub(max)}</span>
      </div>
    </div>
  );
}

export default function ClubOpsSandbox() {
  const [view, setView] = useState<View>("expenses");
  const [expenses, setExpenses] = useState<ExpenseLine[]>(BASE_EXPENSES.map((line) => ({ ...line })));
  const [receipts, setReceipts] = useState<number>(BASE_CASH.receipts);
  const [payments, setPayments] = useState<number>(BASE_CASH.payments);
  const [directSales, setDirectSales] = useState<number>(BASE_CHANNELS[0].sales);
  const [vkSales, setVkSales] = useState<number>(BASE_CHANNELS[1].sales);
  const expense = summarizeExpenses(expenses);
  const cash = forecastCash({ opening: BASE_CASH.opening, receipts, payments });
  const channels = [
    { ...BASE_CHANNELS[0], sales: directSales },
    { ...BASE_CHANNELS[1], sales: vkSales },
  ];

  function reset() {
    setExpenses(BASE_EXPENSES.map((line) => ({ ...line })));
    setReceipts(BASE_CASH.receipts);
    setPayments(BASE_CASH.payments);
    setDirectSales(BASE_CHANNELS[0].sales);
    setVkSales(BASE_CHANNELS[1].sales);
  }

  function updateExpense(key: ExpenseLine["key"], fact: number) {
    setExpenses((current) => current.map((line) => line.key === key ? { ...line, fact } : line));
  }

  return (
    <div className="border border-graphite/15 bg-cream p-4 min-[560px]:p-8">
      <div className="flex flex-col gap-5 border-b border-graphite/20 pb-6 min-[780px]:flex-row min-[780px]:items-center min-[780px]:justify-between">
        <div>
          <p className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-maroon">CLUB OPS / Синтетическая модель</p>
          <h2 className="mb-0 mt-2 font-display text-[clamp(24px,4vw,38px)] font-extrabold uppercase text-graphite">Финансовая панель</h2>
          <p className="mb-0 mt-2 text-[14px] leading-relaxed text-graphite/70">Выберите сценарий и измените показатели. Все расчёты обновляются сразу, без сохранения данных.</p>
        </div>
        <button type="button" onClick={reset} className="min-h-[44px] shrink-0 border border-graphite/30 px-5 text-[12px] font-medium uppercase tracking-[0.07em] text-graphite hover:border-maroon hover:text-maroon">
          Сбросить примеры
        </button>
      </div>

      <div className="mt-6 grid gap-2 min-[650px]:grid-cols-3" aria-label="Сценарии демонстрации">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" aria-pressed={view === tab.key}
            onClick={() => setView(tab.key)}
            className={"min-h-[72px] border px-4 py-3 text-left transition-colors " +
              (view === tab.key ? "border-maroon bg-graphite text-cream" : "border-graphite/20 bg-white text-graphite hover:border-maroon")}>
            <span className="block text-[14px] font-semibold">{tab.label}</span>
            <span className={"mt-1 block text-[12px] " + (view === tab.key ? "text-cream/70" : "text-graphite/60")}>{tab.hint}</span>
          </button>
        ))}
      </div>

      {view === "expenses" && (
        <section className="mt-8" aria-labelledby="expenses-heading">
          <h3 id="expenses-heading" className="m-0 font-display text-[26px] font-bold uppercase text-graphite">Расходы: план против факта</h3>
          <p className="mb-6 mt-2 max-w-[70ch] text-[14px] leading-relaxed text-graphite/75">
            Пример: бюджет {formatRub(500000)}, фактически {formatRub(610000)}. Измените суммы по статьям, чтобы увидеть перерасход или экономию.
          </p>
          <div className="grid gap-3 min-[660px]:grid-cols-3" aria-live="polite" aria-atomic="true">
            <Metric label="План расходов" value={formatRub(expense.plan)} />
            <Metric label="Факт расходов" value={formatRub(expense.fact)} />
            <Metric label={expense.difference > 0 ? "Перерасход" : expense.difference < 0 ? "Экономия" : "Отклонение"} value={formatRub(Math.abs(expense.difference))} negative={expense.difference > 0} detail="Разница между фактом и планом" />
          </div>
          <div className="mt-7 grid gap-6 min-[720px]:grid-cols-3">
            {expenses.map((line) => (
              <div className="border-t border-graphite/20 pt-5" key={line.key}>
                <RangeField id={"expense-" + line.key} label={line.label} value={line.fact} min={line.key === "marketing" ? 20000 : line.key === "rent" ? 80000 : 200000} max={line.key === "marketing" ? 220000 : line.key === "rent" ? 230000 : 460000} step={10000} onChange={(n) => updateExpense(line.key, n)} />
                <p className="mb-0 mt-2 text-[12px] text-graphite/65">План: {formatRub(line.plan)}</p>
              </div>
            ))}
          </div>
          <p className="mb-0 mt-8 border-l-2 border-maroon pl-4 text-[14px] leading-relaxed text-graphite/80">
            {expense.difference > 0 ? "Факт выше плана. Проверьте статьи с наибольшим отклонением и причины перерасхода." : expense.difference < 0 ? "Факт ниже плана. Проверьте, является ли экономия устойчивой и не отложены ли обязательные платежи." : "Расходы совпадают с планом. Следующий шаг — проверить сроки платежей и структуру расходов."}
          </p>
        </section>
      )}

      {view === "cash" && (
        <section className="mt-8" aria-labelledby="cash-heading">
          <h3 id="cash-heading" className="m-0 font-display text-[26px] font-bold uppercase text-graphite">Прогноз кассового остатка</h3>
          <p className="mb-6 mt-2 max-w-[70ch] text-[14px] leading-relaxed text-graphite/75">
            Базовая модель: начальный остаток {formatRub(BASE_CASH.opening)} + поступления {formatRub(BASE_CASH.receipts)} − платежи {formatRub(BASE_CASH.payments)}.
          </p>
          <div className="grid gap-3 min-[660px]:grid-cols-3" aria-live="polite" aria-atomic="true">
            <Metric label="На начало периода" value={formatRub(BASE_CASH.opening)} />
            <Metric label="Ожидаемые поступления" value={formatRub(receipts)} />
            <Metric label={cash < 0 ? "Прогнозируемый дефицит" : "Прогнозируемый остаток"} value={formatRub(Math.abs(cash))} negative={cash < 0} />
          </div>
          <div className="mt-8 grid gap-7 min-[720px]:grid-cols-2">
            <RangeField id="cash-receipts" label="Поступления" value={receipts} min={800000} max={2600000} step={50000} onChange={setReceipts} />
            <RangeField id="cash-payments" label="Платежи" value={payments} min={1000000} max={2700000} step={50000} onChange={setPayments} />
          </div>
          <p className="mb-0 mt-8 border-l-2 border-maroon pl-4 text-[14px] leading-relaxed text-graphite/80">
            {cash < 0 ? "При таких допущениях денег недостаточно. Сопоставьте даты поступлений и обязательных платежей до принятия решений." : "На конец периода остаётся положительный расчётный остаток. Это ещё не подтверждает отсутствие кассового разрыва внутри периода."}
          </p>
        </section>
      )}

      {view === "channels" && (
        <section className="mt-8" aria-labelledby="channels-heading">
          <h3 id="channels-heading" className="m-0 font-display text-[26px] font-bold uppercase text-graphite">Стоимость одной продажи</h3>
          <p className="mb-6 mt-2 max-w-[70ch] text-[14px] leading-relaxed text-graphite/75">
            Бюджеты на рекламу фиксированы в учебном примере. Изменяйте число продаж: стоимость одной продажи = расходы на канал / количество продаж.
          </p>
          <div className="grid gap-5 min-[720px]:grid-cols-2" aria-live="polite" aria-atomic="true">
            {channels.map((channel) => (
              <div key={channel.key} className="border border-graphite/15 bg-white p-5">
                <h4 className="m-0 font-display text-[23px] font-bold uppercase text-graphite">{channel.label}</h4>
                <p className="mb-5 mt-2 text-[13px] text-graphite/65">Рекламные расходы: {formatRub(channel.spend)}</p>
                <RangeField id={"sales-" + channel.key} label="Количество продаж" count min={0} max={25} step={1} value={channel.sales}
                  onChange={channel.key === "direct" ? setDirectSales : setVkSales} />
                <p className="mb-0 mt-5 border-t border-graphite/15 pt-4 text-[12px] uppercase tracking-[0.1em] text-graphite/65">Расход на продажу</p>
                <p className="mb-0 mt-1 font-display text-[30px] font-bold text-maroon">{channel.sales > 0 ? formatRub(costPerSale(channel.spend, channel.sales)!) : "Нет продаж"}</p>
              </div>
            ))}
          </div>
          <p className="mb-0 mt-8 border-l-2 border-maroon pl-4 text-[14px] leading-relaxed text-graphite/80">
            Это упрощённая стоимость одной продажи, а не ROI или доказанная эффективность рекламы. Для решений нужны маржинальность, качество лидов, атрибуция и период окупаемости.
          </p>
        </section>
      )}
      <div className="mt-8 border-t border-graphite/20 pt-5 text-[12px] leading-relaxed text-graphite/65">
        Данные и ситуации вымышлены. Демонстрация не имеет доступа к банковским счетам, зарплатам, CRM, рекламным кабинетам или базам клиентов. Расчёты выполняются только в браузере и не сохраняются.
      </div>
    </div>
  );
}
