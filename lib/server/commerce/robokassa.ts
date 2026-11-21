// Robokassa payment interface — TEST mode only at stage 1. Built from the official documentation:
//   https://docs.robokassa.ru/ru/pay-interface              (payment request, SignatureValue, Receipt, Shp_*)
//   https://docs.robokassa.ru/ru/notifications-and-redirects (ResultURL, SuccessURL/FailURL, "OK{InvId}")
//   https://docs.robokassa.ru/ru/testing-mode               (separate test passwords, IsTest=1)
//   https://docs.robokassa.ru/ru/fiscalization              (Receipt JSON)
//   https://docs.robokassa.ru/ru/refund-api                 (refunds: JWT signed with Password#3 — not connected here)
//
// Request signature:   MerchantLogin:OutSum:InvId[:Receipt]:Password#1[:Shp_key=value…]  (Shp_* sorted by name)
// ResultURL signature: OutSum:InvId:Password#2[:Shp_key=value…]
// SuccessURL:          OutSum:InvId:Password#1[:Shp_key=value…]
// Hash: the method set in the shop's technical settings (MD5 by default); hex, compared case-insensitively.
// IsTest=1 is ALWAYS sent: without it Robokassa would create a live payment.
import { createHash, timingSafeEqual } from "node:crypto";
import type { RobokassaConfig } from "../career-demo/config.ts";

export const ROBOKASSA_PAY_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";
export const EMULATOR_PATH = "/preview-robokassa";
export const PRODUCT_DESCRIPTION = "AI Career 3.0: доступ на 90 дней";

export const formatOutSum = (kopeks: number) => `${Math.floor(kopeks / 100)}.${String(kopeks % 100).padStart(2, "0")}`;
export const signature = (algo: RobokassaConfig["hash"], base: string) => createHash(algo).update(base, "utf8").digest("hex");

function shpParts(shp: Record<string, string>): string[] {
  for (const k of Object.keys(shp)) if (!/^Shp_[A-Za-z0-9_]{1,30}$/.test(k)) throw new Error("bad Shp_ name");
  return Object.keys(shp).sort().map((k) => `${k}=${shp[k]}`);
}

/** Receipt (fiscal data) for one digital service, minified JSON, then URL-encoded (that encoded string is signed). */
export function receiptParam(kopeks: number): string {
  const json = JSON.stringify({ items: [{ name: PRODUCT_DESCRIPTION, quantity: 1, sum: kopeks / 100, payment_method: "full_payment", payment_object: "service", tax: "none" }] });
  return encodeURIComponent(json);
}

export interface PaymentRequest { url: string; params: Record<string, string>; signatureBase: string }

/** The redirect to the (test) payment page for an order whose amount is already fixed. */
export function paymentRequest(cfg: RobokassaConfig, order: { id: string; invId: number; priceKopeks: number }, opts: { email?: string; emulatorOrigin?: string }): PaymentRequest {
  const outSum = formatOutSum(order.priceKopeks);
  const shp = { Shp_order: order.id };
  const receipt = cfg.receipt ? receiptParam(order.priceKopeks) : null;
  const base = [cfg.merchantLogin, outSum, String(order.invId), ...(receipt ? [receipt] : []), cfg.password1, ...shpParts(shp)].join(":");
  const params: Record<string, string> = {
    MerchantLogin: cfg.merchantLogin, OutSum: outSum, InvId: String(order.invId), Description: PRODUCT_DESCRIPTION,
    SignatureValue: signature(cfg.hash, base), IsTest: "1", Culture: "ru", Encoding: "utf-8", ...shp,
  };
  if (receipt) params.Receipt = receipt;
  if (opts.email) params.Email = opts.email;
  const target = cfg.mode === "emulator" ? new URL(EMULATOR_PATH, opts.emulatorOrigin) : new URL(ROBOKASSA_PAY_URL);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return { url: target.toString(), params, signatureBase: base.replace(cfg.password1, "<Пароль#1>") };
}

const eqHex = (a: string, b: string) => {
  const x = Buffer.from(a.toLowerCase()), y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
};

export interface Notification { outSum: string; invId: number; signature: string; shp: Record<string, string> }

/** Parses ResultURL / SuccessURL parameters. Returns null when the required ones are missing or malformed. */
export function parseNotification(p: URLSearchParams): Notification | null {
  const outSum = p.get("OutSum") ?? "", invRaw = p.get("InvId") ?? "", sig = p.get("SignatureValue") ?? "";
  if (!/^[0-9]{1,9}([.][0-9]{1,6})?$/.test(outSum) || !/^[0-9]{1,10}$/.test(invRaw) || !/^[A-Fa-f0-9]{32,128}$/.test(sig)) return null;
  const shp: Record<string, string> = {};
  for (const [k, v] of p) if (k.startsWith("Shp_")) { if (!/^Shp_[A-Za-z0-9_]{1,30}$/.test(k) || v.length > 100) return null; shp[k] = v; }
  return { outSum, invId: Number(invRaw), signature: sig, shp };
}

/** ResultURL: signed with Password#2 over the values exactly as received. */
export function verifyResult(cfg: RobokassaConfig, n: Notification): boolean {
  return eqHex(signature(cfg.hash, [n.outSum, String(n.invId), cfg.password2, ...shpParts(n.shp)].join(":")), n.signature);
}
/** SuccessURL: signed with Password#1 (used only to show the result page; access is granted by ResultURL alone). */
export function verifySuccess(cfg: RobokassaConfig, n: Notification): boolean {
  return eqHex(signature(cfg.hash, [n.outSum, String(n.invId), cfg.password1, ...shpParts(n.shp)].join(":")), n.signature);
}
/** What Robokassa itself checks on the payment page (used by the preview emulator). */
export function verifyRequest(cfg: RobokassaConfig, p: URLSearchParams): boolean {
  const shp: Record<string, string> = {};
  for (const [k, v] of p) if (k.startsWith("Shp_")) shp[k] = v;
  const receipt = p.get("Receipt");
  const base = [p.get("MerchantLogin") ?? "", p.get("OutSum") ?? "", p.get("InvId") ?? "", ...(receipt ? [receipt] : []), cfg.password1, ...shpParts(shp)].join(":");
  return p.get("IsTest") === "1" && eqHex(signature(cfg.hash, base), p.get("SignatureValue") ?? "");
}
/** Signs a ResultURL notification the way Robokassa does (emulator and tests). */
export function signResult(cfg: RobokassaConfig, outSum: string, invId: number, shp: Record<string, string>) {
  return signature(cfg.hash, [outSum, String(invId), cfg.password2, ...shpParts(shp)].join(":"));
}
