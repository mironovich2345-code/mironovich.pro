// Stage-1 shop API (TEST payments only): quote | order (GET current, POST create → Robokassa test URL) | cancel.
// 404 outside the stage-1 profile; the amount comes from shop.quote() and is fixed in the order before payment.
import { NextRequest } from "next/server";
import { CareerError } from "@/lib/server/career/config";
import { transaction, careerPool } from "@/lib/server/career/db";
import { demoLimit, demoSessionUser } from "@/lib/server/career-demo/auth";
import { guardDemoRequest, json, readJson } from "@/lib/server/career-demo/http";
import { cancelOrder, createOrder, orderForAccount, quote, ShopError } from "@/lib/server/commerce/shop";
import { paymentRequest } from "@/lib/server/commerce/robokassa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const c = guardDemoRequest(req);
    if (!c.commerce) throw new CareerError(404, "Страница не найдена");
    // The one price for public pages (the public site reads it through its proxy; no session, no personal data).
    if (req.method === "GET" && (await ctx.params).action === "public-quote") {
      const q = await quote(careerPool());
      return json({ priceRub: q.priceRub, mode: q.mode, salesOpen: false });
    }
    const user = await demoSessionUser(req.cookies.get(c.cookieName)?.value);
    if (!user) throw new CareerError(401, "Войдите в кабинет");
    await demoLimit(c, "shop:" + user.accountId, 30, 60);
    const { action } = await ctx.params;
    const rk = c.commerce.robokassa;
    if (req.method === "GET" && (action === "quote" || action === "order")) {
      const q = await quote(careerPool());
      const order = action === "order" ? await orderForAccount(careerPool(), user.accountId) : null;
      return json({
        priceRub: q.priceRub, hasAccess: user.hasAccess, accessUntil: user.accessUntil, paymentsReady: !!rk, paymentMode: rk?.mode ?? null,
        order: order && { id: order.id, invId: order.invId, priceRub: order.priceRub, status: order.status, reservedUntil: order.reservedUntil, paidAt: order.paidAt },
      });
    }
    if (req.method === "POST" && action === "order") {
      const b = await readJson(req, ["adultConfirmed", "offerAccepted"]);
      if (!rk) throw new CareerError(503, "Тестовая оплата ещё не подключена");
      if (user.hasAccess) throw new CareerError(409, "Доступ уже открыт");
      const order = await transaction((tx) => createOrder(tx, user.accountId, {
        adultConfirmed: b.adultConfirmed === true, offerAccepted: b.offerAccepted === true, providerMode: rk.mode, reservationMinutes: c.commerce!.reservationMinutes,
      }));
      const pay = paymentRequest(rk, { id: order.id, invId: order.invId, priceKopeks: order.priceRub * 100 }, { email: user.email, emulatorOrigin: c.origin });
      return json({ order: { id: order.id, invId: order.invId, priceRub: order.priceRub, status: order.status, reservedUntil: order.reservedUntil }, payUrl: pay.url, test: true }, 201);
    }
    if (req.method === "POST" && action === "cancel") {
      const b = await readJson(req, ["orderId"]);
      if (typeof b.orderId !== "string" || !/^[0-9a-f-]{36}$/.test(b.orderId)) throw new CareerError(400, "Неверный заказ");
      await transaction((tx) => cancelOrder(tx, user.accountId, b.orderId as string));
      return json({ ok: true });
    }
    throw new CareerError(404, "Страница не найдена");
  } catch (e) {
    if (e instanceof CareerError || e instanceof ShopError) return json({ error: e.message }, e.status);
    console.error("career shop route failed", (e as Error).name);
    return json({ error: "Сервис временно недоступен" }, 500);
  }
}
export const GET = handle;
export const POST = handle;
