// Admin API (stage-1 preview): price | refund. Rights are checked on the server only: an email-code session for an
// active staff email (career_staff). Anyone else gets 404, indistinguishable from an absent route.
import { NextRequest } from "next/server";
import { CareerError } from "@/lib/server/career/config";
import { transaction } from "@/lib/server/career/db";
import { demoLimit, demoSessionUser } from "@/lib/server/career-demo/auth";
import { guardDemoRequest, json, readJson } from "@/lib/server/career-demo/http";
import { recordRefund, setPrice, ShopError } from "@/lib/server/commerce/shop";
import { rubles } from "@/config/ai-career-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const c = guardDemoRequest(req);
    const user = await demoSessionUser(req.cookies.get(c.cookieName)?.value);
    if (!c.commerce || !user?.isAdmin) throw new CareerError(404, "Страница не найдена");
    await demoLimit(c, "admin:" + user.userId, 30, 60);
    const { action } = await ctx.params;
    if (action === "price") {
      const b = await readJson(req, ["mode", "priceRub", "reason", "confirm"]);
      const r = await transaction((tx) => setPrice(tx, user.email, { mode: b.mode, priceRub: b.priceRub, reason: b.reason, confirm: b.confirm }));
      return json({ ok: true, message: `Цена для новых заказов: ${rubles(r.after.priceRub)} (${r.after.mode === "auto" ? "AUTO" : "MANUAL"})`, priceRub: r.after.priceRub, mode: r.after.mode });
    }
    if (action === "refund") {
      const b = await readJson(req, ["orderId", "reason", "confirm"]);
      if (b.confirm !== true) throw new CareerError(400, "Подтвердите возврат");
      if (typeof b.orderId !== "string" || !/^[0-9a-f-]{36}$/.test(b.orderId)) throw new CareerError(400, "Неверный заказ");
      await transaction((tx) => recordRefund(tx, b.orderId as string, String(b.reason ?? "")));
      return json({ ok: true, message: "Возврат записан, доступ по заказу отозван. Деньги возвращаются через личный кабинет или API возвратов Robokassa." });
    }
    throw new CareerError(404, "Страница не найдена");
  } catch (e) {
    if (e instanceof CareerError || e instanceof ShopError) return json({ error: e.message }, e.status);
    console.error("career admin route failed", (e as Error).name);
    return json({ error: "Сервис временно недоступен" }, 500);
  }
}
