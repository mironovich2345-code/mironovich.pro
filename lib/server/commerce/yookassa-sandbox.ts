/**
 * ЮKassa sandbox adapter for the *future Yandex Cloud customer app*.
 *
 * Not imported by any public Railway route. Not wired to checkout or access.
 * No buyer PII enters this module. Test-only credentials are injected at runtime.
 * Never grant access on redirect or notification alone. Persist an order and verify
 * payment status via GET /payments/{id} before updating the order in a transaction.
 */
import { aiCareerCommerce } from "../../../config/ai-career-commerce.ts";

const API_ORIGIN = "https://api.yookassa.ru";
const PRICE = aiCareerCommerce.priceRub.toFixed(2);
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

export type SandboxKeys = { shopId: string; secretKey: string };
export type SandboxOrder = {
  /** Random internal order UUID, never customer email/name. */
  orderId: string;
  /** Persist once with the pending order; reuse on HTTP retries. */
  idempotenceKey: string;
  /** Future dedicated app: https://app.mironovich.pro */
  returnOrigin: string;
};
export type SandboxPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  test: boolean;
  amount: { value: string; currency: string };
  metadata?: { order_id?: string };
  confirmation?: { confirmation_url?: string };
};
export type SandboxStatus = {
  paymentId: string;
  orderId: string;
  status: SandboxPayment["status"];
  verifiedTestPayment: true;
  eligibleForTestOrderMarking: boolean;
};
type Fetch = typeof fetch;

function credentials(keys: SandboxKeys): string {
  if (!/^\d{5,20}$/.test(keys.shopId) || !/^test_[A-Za-z0-9_-]{16,}$/.test(keys.secretKey)) {
    throw new Error("Only a valid sandbox shop ID and a TEST key are supported");
  }
  return "Basic " + Buffer.from(keys.shopId + ":" + keys.secretKey, "utf8").toString("base64");
}
function assertUUID(value: string, name: string): void {
  if (!UUID.test(value)) throw new Error("Invalid " + name + ": expected UUID");
}
function returnUrl(origin: string, orderId: string): string {
  const url = new URL(origin);
  const localTest = url.protocol === "http:" && url.hostname === "127.0.0.1";
  const hostedTest = url.protocol === "https:" && url.hostname === "app.mironovich.pro";
  if ((!localTest && !hostedTest) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Unsupported return origin for the dedicated account app");
  }
  return new URL("/payment/result", url.origin).toString();
}
function assertPayment(response: unknown, expectedOrder: string): SandboxPayment {
  if (!response || typeof response !== "object") throw new Error("Invalid ЮKassa response");
  const p = response as Partial<SandboxPayment>;
  if (
    typeof p.id !== "string" || !UUID.test(p.id) ||
    !["pending", "waiting_for_capture", "succeeded", "canceled"].includes(p.status ?? "") ||
    typeof p.paid !== "boolean" || p.test !== true ||
    p.amount?.value !== PRICE || p.amount?.currency !== "RUB" ||
    p.metadata?.order_id !== expectedOrder
  ) throw new Error("Sandbox payment does not match the expected order, price, currency or mode");
  return p as SandboxPayment;
}
async function apiRequest(path: string, keys: SandboxKeys, init: RequestInit, fetcher: Fetch): Promise<unknown> {
  const response = await fetcher(API_ORIGIN + path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: credentials(keys),
      "Content-Type": "application/json",
    },
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) {
    // Avoid including a potentially sensitive provider response in logs or errors.
    throw new Error("ЮKassa sandbox request failed with HTTP " + response.status);
  }
  return response.json();
}

/** Create one TEST payment. Caller owns durable order/idempotence storage. */
export async function createSandboxPayment(order: SandboxOrder, keys: SandboxKeys, fetcher: Fetch = fetch) {
  assertUUID(order.orderId, "orderId");
  assertUUID(order.idempotenceKey, "idempotenceKey");
  const url = returnUrl(order.returnOrigin, order.orderId);
  const payload = {
    amount: { value: PRICE, currency: "RUB" },
    capture: true,
    confirmation: { type: "redirect", return_url: url },
    description: "Доступ к ИИ-диагностике MIRONOVICH.PRO",
    metadata: { order_id: order.orderId },
  };
  const data = await apiRequest("/v3/payments", keys, {
    method: "POST",
    headers: { "Idempotence-Key": order.idempotenceKey },
    body: JSON.stringify(payload),
  }, fetcher);
  const payment = assertPayment(data, order.orderId);
  if (typeof payment.confirmation?.confirmation_url !== "string" ||
      !payment.confirmation.confirmation_url.startsWith("https://")) {
    throw new Error("Missing secure sandbox confirmation URL");
  }
  return {
    paymentId: payment.id,
    confirmationUrl: payment.confirmation.confirmation_url,
    status: payment.status,
    sandbox: true as const,
  };
}

/**
 * Verify by an independently authenticated GET call. A browser return or webhook
 * is untrusted and must never directly create access. For test orders, this
 * can mark ONLY a sandbox order; never activate a real customer account.
 */
export async function verifySandboxPayment(
  paymentId: string, expectedOrderId: string, keys: SandboxKeys, fetcher: Fetch = fetch,
): Promise<SandboxStatus> {
  assertUUID(paymentId, "paymentId");
  assertUUID(expectedOrderId, "expectedOrderId");
  const data = await apiRequest("/v3/payments/" + paymentId, keys, { method: "GET" }, fetcher);
  const payment = assertPayment(data, expectedOrderId);
  if (payment.id !== paymentId) throw new Error("Payment ID mismatch");
  return {
    paymentId,
    orderId: expectedOrderId,
    status: payment.status,
    verifiedTestPayment: true,
    eligibleForTestOrderMarking: payment.status === "succeeded" && payment.paid === true,
  };
}
