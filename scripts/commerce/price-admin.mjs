#!/usr/bin/env node
// Owner's price control for AI Career 3.0 — no code change, no deploy. Every change is validated and kept as history.
// Needs COMMERCE_DATABASE_URL (the store's database). Times are entered in Moscow time.
//   current                                  the price in force now (what the page shows)
//   list                                     all price periods, including ended and cancelled ones
//   set <1993|3990|5900> [from] [note]       base price from now or from a date: "2026-12-01 00:00"
//   promo <price> <from> <until> [note]      price for a period: from (inclusive) … until (exclusive)
//   stop <id>                                cancel a future period / end a running promotion now
//   report                                   orders, payments, refunds and revenue per price period
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../..", import.meta.url)));
const { Pool } = await import("pg");
const P = await import("../../lib/server/commerce/price-periods.ts");
const { rubles, moscowDateTime } = await import("../../config/ai-career-pricing.ts");
if (!process.env.COMMERCE_DATABASE_URL) { console.error("Не задан COMMERCE_DATABASE_URL"); process.exit(2); }

/** "2026-12-01 00:00" or "2026-12-01" as Moscow time (UTC+3, no daylight saving). */
function msk(s) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(s ?? "");
  if (!m) throw new P.PriceInputError(`Дата в формате "ГГГГ-ММ-ДД ЧЧ:ММ" (МСК): ${s}`);
  return new Date(`${m[1]}T${m[2] ?? "00"}:${m[3] ?? "00"}:00+03:00`);
}
const show = (p) => `${rubles(p.priceRub)} · ${p.kind === "promo" ? "акция" : p.kind === "base" ? "базовая цена" : "стартовая цена"}` +
  (p.startsAt ? ` · с ${moscowDateTime(p.startsAt)}` : "") + (p.endsAt ? ` · до ${moscowDateTime(p.endsAt)}` : "");

const pool = new Pool({ connectionString: process.env.COMMERCE_DATABASE_URL, max: 1 });
const [cmd, a, b, c, d] = process.argv.slice(2);
try {
  if (cmd === "current") console.log("Сейчас:", show((await P.resolvePrice(pool)).price));
  else if (cmd === "list") for (const p of await P.listPeriods(pool)) console.log(`№${p.id} ${show(p)}${p.canceledAt ? " · ОТМЕНЁН" : ""}${p.note ? " · " + p.note : ""}`);
  else if (cmd === "set") { const id = await P.setBasePrice(pool, Number(a), b ? msk(b) : new Date(), c ?? ""); console.log(`Записан период №${id}. Сейчас: ${show((await P.resolvePrice(pool)).price)}`); }
  else if (cmd === "promo") { const id = await P.schedulePromo(pool, Number(a), msk(b), msk(c), d ?? ""); console.log(`Записана акция №${id}. Сейчас: ${show((await P.resolvePrice(pool)).price)}`); }
  else if (cmd === "stop") console.log({ canceled: "Период отменён", ended: "Акция завершена сейчас" }[await P.stopPeriod(pool, Number(a))]);
  else if (cmd === "report") console.table((await P.periodReport(pool)).map((r) => ({
    период: r.periodId ?? "старт", цена: rubles(r.priceRub), вид: r.kind, с: r.startsAt ? moscowDateTime(r.startsAt) : "—", до: r.endsAt ? moscowDateTime(r.endsAt) : "—",
    заказов: r.ordersCreated, оплачено: r.ordersPaid, "доля оплат, %": r.paidShare ?? "—", возвратов: r.ordersRefunded, "выручка, ₽": r.revenueRub })));
  else { console.error("Команды: current | list | set <цена> [с] [заметка] | promo <цена> <с> <до> [заметка] | stop <№> | report"); process.exitCode = 1; }
} catch (e) {
  if (e instanceof P.PriceInputError) { console.error("Отклонено:", e.message); process.exitCode = 1; } else throw e;
} finally {
  await pool.end();
}
