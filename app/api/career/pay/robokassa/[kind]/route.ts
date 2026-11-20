// Robokassa callbacks for the stage-1 TEST shop.
//   result  — ResultURL: the ONLY place that confirms a payment and grants access (signature with Password#2,
//             amount must equal the order's fixed amount, idempotent; answers "OK{InvId}" as the docs require);
//   success — SuccessURL: shows the result page only (signature with Password#1 checked, nothing is granted);
//   fail    — FailURL: back to the cabinet.
// Docs: https://docs.robokassa.ru/ru/notifications-and-redirects
import { NextRequest, NextResponse } from "next/server";
import { careerPool, transaction } from "@/lib/server/career/db";
import { demoConfig } from "@/lib/server/career-demo/config";
import { confirmPayment } from "@/lib/server/commerce/shop";
import { parseNotification, verifyResult, verifySuccess } from "@/lib/server/commerce/robokassa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const text = (body: string, status = 200) => new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

async function params(req: NextRequest): Promise<URLSearchParams> {
  if (req.method === "GET") return req.nextUrl.searchParams;
  const type = req.headers.get("content-type")?.split(";")[0] ?? "";
  if (type !== "application/x-www-form-urlencoded") return new URLSearchParams();
  const raw = await req.text();
  return raw.length > 8192 ? new URLSearchParams() : new URLSearchParams(raw);
}

async function record(outcome: string, invId: number | null, orderId: string | null, outSum: string | null) {
  await careerPool().query("INSERT INTO career_shop_notifications(inv_id,order_id,outcome,out_sum) VALUES($1,$2,$3,$4)", [invId, orderId, outcome, outSum?.slice(0, 20) ?? null]);
}

async function handle(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const c = demoConfig();
  const rk = c?.commerce?.robokassa;
  if (!c || !rk || req.headers.get("host") !== c.host) return text("Not found", 404);
  const { kind } = await ctx.params;
  const p = await params(req);
  const n = parseNotification(p);
  if (kind === "result") {
    if (!n) { await record("malformed", null, null, null); return text("bad request", 400); }
    if (!verifyResult(rk, n)) { await record("bad_signature", n.invId, null, n.outSum); return text("bad sign", 400); }
    const r = await transaction((tx) => confirmPayment(tx, n.invId, n.outSum, c.commerce!.paidAccessDays, n.shp.Shp_order ?? null));
    await record(r.outcome, n.invId, r.orderId, n.outSum);
    if (r.outcome === "paid" || r.outcome === "duplicate" || r.outcome === "refund_required") return text("OK" + n.invId);
    return text(r.outcome, 400);
  }
  if (kind === "success" || kind === "fail") {
    const ok = kind === "success" && !!n && verifySuccess(rk, n);
    return NextResponse.redirect(new URL("/?payment=" + (ok ? "success" : "fail"), c.origin), 303);
  }
  return text("Not found", 404);
}
export const GET = handle;
export const POST = handle;
