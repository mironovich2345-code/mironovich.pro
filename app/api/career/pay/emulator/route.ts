// Stage-1 preview only: the "Pay (test)" button of the Robokassa emulator page. It checks the payment request the way
// Robokassa does (Password#1, IsTest=1), then sends a real HTTP ResultURL notification to this service signed with
// Password#2 — the same code path a Robokassa test payment takes — and redirects like Robokassa (Success/Fail URL).
import { NextRequest, NextResponse } from "next/server";
import { demoConfig } from "@/lib/server/career-demo/config";
import { signResult, signature, verifyRequest } from "@/lib/server/commerce/robokassa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const c = demoConfig();
  const rk = c?.commerce?.robokassa;
  // Form navigations under "Referrer-Policy: no-referrer" send "Origin: null"; Sec-Fetch-Site (set only by the browser) proves same origin.
  const sameOrigin = req.headers.get("sec-fetch-site") === "same-origin" ? ["null", c?.origin].includes(req.headers.get("origin") ?? "null") : req.headers.get("origin") === c?.origin;
  if (!c || rk?.mode !== "emulator" || req.headers.get("host") !== c.host || !sameOrigin) return new NextResponse("Not found", { status: 404 });
  if (req.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") return new NextResponse("Bad request", { status: 400 });
  const raw = await req.text();
  if (raw.length > 8192) return new NextResponse("Bad request", { status: 400 });
  const p = new URLSearchParams(raw);
  const decision = p.get("decision");
  p.delete("decision");
  if (!verifyRequest(rk, p)) return new NextResponse("Ошибка 29: неверная подпись запроса", { status: 400 });
  const outSum = p.get("OutSum")!, invId = Number(p.get("InvId")), shp: Record<string, string> = {};
  for (const [k, v] of p) if (k.startsWith("Shp_")) shp[k] = v;
  const back = new URLSearchParams({ OutSum: outSum, InvId: String(invId), Culture: "ru", ...shp });
  if (decision !== "pay") return NextResponse.redirect(new URL("/api/career/pay/robokassa/fail?" + back, c.origin), 303);
  const body = new URLSearchParams({ OutSum: outSum, InvId: String(invId), SignatureValue: signResult(rk, outSum, invId, shp), PaymentMethod: "BankCard", IncCurrLabel: "BankCardPSR", ...shp });
  const r = await fetch(new URL("/api/career/pay/robokassa/result", c.origin), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, redirect: "manual" });
  const answer = (await r.text()).trim();
  if (answer !== "OK" + invId) return NextResponse.redirect(new URL("/api/career/pay/robokassa/fail?" + back, c.origin), 303);
  back.set("SignatureValue", signature(rk.hash, [outSum, String(invId), rk.password1, ...Object.keys(shp).sort().map((k) => `${k}=${shp[k]}`)].join(":")));
  return NextResponse.redirect(new URL("/api/career/pay/robokassa/success?" + back, c.origin), 303);
}
