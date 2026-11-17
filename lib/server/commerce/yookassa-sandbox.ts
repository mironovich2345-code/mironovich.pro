/**
 * ЮKassa sandbox adapter for Railway-only staging with synthetic test orders.
 *
 * Used only by the separately gated synthetic sandbox API; real sales stay off.
 * No buyer PII enters this module. Test-only credentials are injected at runtime.
 * Never grant access on redirect or notification alone. Persist an order and verify
 * payment status via GET /payments/{id} before updating the order in a transaction.
 */
import { aiCareerCommerce } from "../../../config/ai-career-commerce.ts";

const API_ORIGIN = "https://api.yookassa.ru";
const price = (kind: "initial" | "extension" = "initial") =>
  (kind === "initial"
    ? aiCareerCommerce.priceRub
    : aiCareerCommerce.extensionPriceRub
  ).toFixed(2);
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

export type SandboxKeys = { shopId: string; secretKey: string };
export type SandboxOrder = {
  /** Random internal order UUID, never customer email/name. */
  orderId: string;
  /** Persist once with the pending order; reuse on HTTP retries. */
  idempotenceKey: string;
  /** Dedicated Railway-hosted sandbox origin: https://mironovich.pro */
  returnOrigin: string;
  kind?: "initial" | "extension";
};
export type SandboxPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  captured_at?: string;
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
  capturedAt?: string;
};
type Fetch = typeof fetch;

function credentials(keys: SandboxKeys): string {
  if (
    !/^\d{5,20}$/.test(keys.shopId) ||
    !/^test_[A-Za-z0-9_-]{16,}$/.test(keys.secretKey)
  ) {
    throw new Error(
      "Only a valid sandbox shop ID and a TEST key are supported",
    );
  }
  return (
    "Basic " +
    Buffer.from(keys.shopId + ":" + keys.secretKey, "utf8").toString("base64")
  );
}
function assertUUID(value: string, name: string): void {
  if (!UUID.test(value)) throw new Error("Invalid " + name + ": expected UUID");
}
function returnUrl(origin: string): string {
  const url = new URL(origin);
  const localTest = url.protocol === "http:" && url.hostname === "127.0.0.1";
  const hostedTest =
    url.protocol === "https:" &&
    (url.hostname === "mironovich.pro" ||
      url.hostname.endsWith(".up.railway.app"));
  if (
    (!localTest && !hostedTest) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("Unsupported return origin for the Railway sandbox");
  }
  return new URL("/payment/result", url.origin).toString();
}
function assertPayment(
  response: unknown,
  expectedOrder: string,
  kind: "initial" | "extension" = "initial",
): SandboxPayment {
  if (!response || typeof response !== "object")
    throw new Error("Invalid ЮKassa response");
  const p = response as Partial<SandboxPayment>;
  if (
    typeof p.id !== "string" ||
    !UUID.test(p.id) ||
    !["pending", "waiting_for_capture", "succeeded", "canceled"].includes(
      p.status ?? "",
    ) ||
    typeof p.paid !== "boolean" ||
    p.test !== true ||
    p.amount?.value !== price(kind) ||
    p.amount?.currency !== "RUB" ||
    p.metadata?.order_id !== expectedOrder
  )
    throw new Error(
      "Sandbox payment does not match the expected order, price, currency or mode",
    );
  return p as SandboxPayment;
}
async function apiRequest(
  path: string,
  keys: SandboxKeys,
  init: RequestInit,
  fetcher: Fetch,
): Promise<unknown> {
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
    throw new Error(
      "ЮKassa sandbox request failed with HTTP " + response.status,
    );
  }
  return response.json();
}

/** Create one TEST payment. Caller owns durable order/idempotence storage. */
export async function createSandboxPayment(
  order: SandboxOrder,
  keys: SandboxKeys,
  fetcher: Fetch = fetch,
) {
  assertUUID(order.orderId, "orderId");
  assertUUID(order.idempotenceKey, "idempotenceKey");
  const url = returnUrl(order.returnOrigin);
  const payload = {
    amount: { value: price(order.kind), currency: "RUB" },
    capture: true,
    confirmation: { type: "redirect", return_url: url },
    description: "Доступ к ИИ-диагностике MIRONOVICH.PRO",
    metadata: { order_id: order.orderId },
  };
  const data = await apiRequest(
    "/v3/payments",
    keys,
    {
      method: "POST",
      headers: { "Idempotence-Key": order.idempotenceKey },
      body: JSON.stringify(payload),
    },
    fetcher,
  );
  const payment = assertPayment(data, order.orderId, order.kind);
  if (
    typeof payment.confirmation?.confirmation_url !== "string" ||
    !/^https:\/\/(?:[a-z0-9-]+\.)?(?:yoomoney\.ru|yookassa\.ru)\//i.test(
      payment.confirmation.confirmation_url,
    )
  ) {
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
  paymentId: string,
  expectedOrderId: string,
  keys: SandboxKeys,
  fetcher: Fetch = fetch,
  kind: "initial" | "extension" = "initial",
): Promise<SandboxStatus> {
  assertUUID(paymentId, "paymentId");
  assertUUID(expectedOrderId, "expectedOrderId");
  const data = await apiRequest(
    "/v3/payments/" + paymentId,
    keys,
    { method: "GET" },
    fetcher,
  );
  const payment = assertPayment(data, expectedOrderId, kind);
  if (payment.id !== paymentId) throw new Error("Payment ID mismatch");
  const eligible = payment.status === "succeeded" && payment.paid === true;
  const captured = payment.captured_at;
  if (
    eligible &&
    (!captured ||
      !/^\d{4}-\d{2}-\d{2}T/.test(captured) ||
      !Number.isFinite(Date.parse(captured)) ||
      Date.parse(captured) > Date.now() + 60000)
  )
    throw new Error("Missing verified payment capture time");
  return {
    paymentId,
    orderId: expectedOrderId,
    status: payment.status,
    verifiedTestPayment: true,
    eligibleForTestOrderMarking: eligible,
    ...(eligible ? { capturedAt: captured } : {}),
  };
}

type SandboxRefundOrder = {
  orderId: string;
  paymentId: string;
  idempotenceKey: string;
  kind: "initial" | "extension";
};
type SandboxRefund = {
  id: string;
  payment_id: string;
  status: "pending" | "succeeded" | "canceled";
  amount: { value: string; currency: string };
};
function assertRefund(data: unknown, order: SandboxRefundOrder): SandboxRefund {
  if (!data || typeof data !== "object")
    throw new Error("Invalid sandbox refund");
  const r = data as Partial<SandboxRefund>;
  if (
    typeof r.id !== "string" ||
    !UUID.test(r.id) ||
    r.payment_id !== order.paymentId ||
    !["pending", "succeeded", "canceled"].includes(r.status || "") ||
    r.amount?.value !== price(order.kind) ||
    r.amount.currency !== "RUB"
  )
    throw new Error("Sandbox refund mismatch");
  return r as SandboxRefund;
}
export async function createSandboxRefund(
  order: SandboxRefundOrder,
  keys: SandboxKeys,
  fetcher: Fetch = fetch,
) {
  assertUUID(order.orderId, "orderId");
  assertUUID(order.paymentId, "paymentId");
  assertUUID(order.idempotenceKey, "idempotenceKey");
  const payment = await verifySandboxPayment(
    order.paymentId,
    order.orderId,
    keys,
    fetcher,
    order.kind,
  );
  if (!payment.eligibleForTestOrderMarking)
    throw new Error("Only a verified paid TEST payment is refundable");
  return assertRefund(
    await apiRequest(
      "/v3/refunds",
      keys,
      {
        method: "POST",
        headers: { "Idempotence-Key": order.idempotenceKey },
        body: JSON.stringify({
          payment_id: order.paymentId,
          amount: { value: price(order.kind), currency: "RUB" },
          description: "Возврат синтетического тестового заказа",
        }),
      },
      fetcher,
    ),
    order,
  );
}
export async function verifySandboxRefund(
  id: string,
  order: SandboxRefundOrder,
  keys: SandboxKeys,
  fetcher: Fetch = fetch,
) {
  assertUUID(id, "refundId");
  const payment = await verifySandboxPayment(
    order.paymentId,
    order.orderId,
    keys,
    fetcher,
    order.kind,
  );
  if (!payment.eligibleForTestOrderMarking)
    throw new Error("Only a verified paid TEST payment is refundable");
  const r = assertRefund(
    await apiRequest("/v3/refunds/" + id, keys, { method: "GET" }, fetcher),
    order,
  );
  if (r.id !== id) throw new Error("Refund ID mismatch");
  return r;
}
