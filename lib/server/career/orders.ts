import { randomUUID } from "node:crypto";
import { careerPool, transaction, event } from "./db.ts";
import {
  careerConfig,
  CareerError,
  TERMS_VERSION,
  UUID_PATTERN,
} from "./config.ts";
import { addCalendarMonths } from "../../career-diagnostic.ts";
import {
  createSandboxPayment,
  verifySandboxPayment,
  createSandboxRefund,
  verifySandboxRefund,
} from "../commerce/yookassa-sandbox.ts";
import { careerFetcher, completeLocalFixture } from "./payments.ts";
import { queueCareerMail, flushCareerMail } from "./mail.ts";
export type OrderKind = "initial" | "extension";
export async function createOrder(
  accountId: string,
  kind: unknown,
  adult: unknown,
  offer: unknown,
) {
  if (
    typeof kind !== "string" ||
    !["initial", "extension"].includes(kind) ||
    adult !== true ||
    offer !== true
  )
    throw new CareerError(
      400,
      "Отдельно подтвердите 18+ и принятие проекта условий тестовой покупки",
    );
  const k = kind as OrderKind;
  const order = await transaction(async (tx) => {
    const ar = await tx.query(
      "SELECT * FROM career_accounts WHERE id=$1 FOR UPDATE",
      [accountId],
    );
    const a = ar.rows[0];
    if (!a) throw new CareerError(401, "Требуется вход");
    if (
      (
        await tx.query(
          "SELECT 1 FROM career_orders WHERE account_id=$1 AND refund_started_at IS NOT NULL AND status<>'refunded'",
          [accountId],
        )
      ).rowCount
    )
      throw new CareerError(
        409,
        "Сначала дождитесь завершения ранее начатого тестового возврата",
      );
    if (
      k === "initial" &&
      (
        await tx.query(
          "SELECT 1 FROM career_orders WHERE account_id=$1 AND kind='initial' AND status IN ('paid','refunded')",
          [accountId],
        )
      ).rowCount
    )
      throw new CareerError(
        409,
        "Первоначальный доступ уже приобретён; новый анализ не включён",
      );
    if (
      k === "extension" &&
      !(
        await tx.query(
          "SELECT 1 FROM career_orders WHERE account_id=$1 AND kind='initial' AND status='paid'",
          [accountId],
        )
      ).rowCount
    )
      throw new CareerError(
        409,
        "Первоначальный доступ возвращён; дополнительный доступ не может его заменить",
      );
    if (
      k === "extension" &&
      (!a.analysis_consumed ||
        !a.access_until ||
        new Date(a.access_until).getTime() + 30 * 86400000 <= Date.now() ||
        !(
          await tx.query("SELECT 1 FROM career_reports WHERE account_id=$1", [
            accountId,
          ])
        ).rowCount)
    )
      throw new CareerError(
        409,
        "Нет сохранённого отчёта для дополнительного доступа",
      );
    const pending = await tx.query(
      "SELECT * FROM career_orders WHERE account_id=$1 AND kind=$2 AND status='pending'",
      [accountId, k],
    );
    if (pending.rowCount) return pending.rows[0];
    const r = await tx.query(
      "INSERT INTO career_orders(id,account_id,kind,amount_kopeks,idempotence_key,refund_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
      [
        randomUUID(),
        accountId,
        k,
        k === "initial" ? 199000 : 149000,
        randomUUID(),
        randomUUID(),
      ],
    );
    for (const name of ["adult", "offer"])
      await tx.query(
        "INSERT INTO career_confirmations(order_id,kind,accepted,version) VALUES($1,$2,true,$3)",
        [r.rows[0].id, name, TERMS_VERSION],
      );
    await event("order_created", accountId, r.rows[0].id, tx);
    await queueCareerMail(accountId, r.rows[0].id, "order_created", tx);
    return r.rows[0];
  });
  if (!order.payment_id) {
    const c = careerConfig();
    const p = await createSandboxPayment(
      {
        orderId: order.id,
        idempotenceKey: order.idempotence_key,
        returnOrigin: c.origin,
        kind: k,
      },
      c.keys,
      careerFetcher,
    );
    await careerPool().query(
      "UPDATE career_orders SET payment_id=$2,confirmation_url=$3 WHERE id=$1 AND (payment_id IS NULL OR payment_id=$2)",
      [order.id, p.paymentId, p.confirmationUrl],
    );
  }
  await flushCareerMail();
  return publicOrder(
    (
      await careerPool().query("SELECT * FROM career_orders WHERE id=$1", [
        order.id,
      ])
    ).rows[0],
  );
}
export function publicOrder(o: Record<string, unknown>) {
  return {
    id: o.id,
    kind: o.kind,
    amountKopeks: o.amount_kopeks,
    status: o.status,
    paidAt: o.paid_at,
    createdAt: o.created_at,
    confirmationUrl:
      careerConfig().mode === "fixture" ? null : o.confirmation_url,
    synthetic: true,
  };
}
export async function refreshOrder(accountId: string, orderId: unknown) {
  if (typeof orderId !== "string" || !UUID_PATTERN.test(orderId))
    throw new CareerError(400, "Неверный заказ");
  const r = await careerPool().query(
    "SELECT * FROM career_orders WHERE id=$1 AND account_id=$2",
    [orderId, accountId],
  );
  const order = r.rows[0];
  if (!order) throw new CareerError(404, "Заказ не найден");
  if (!order.payment_id)
    throw new CareerError(409, "Тестовый платёж ещё не создан");
  const c = careerConfig();
  const verified = await verifySandboxPayment(
    order.payment_id,
    order.id,
    c.keys,
    careerFetcher,
    order.kind,
  );
  await transaction(async (tx) => {
    await tx.query("SELECT id FROM career_accounts WHERE id=$1 FOR UPDATE", [
      accountId,
    ]);
    const current = (
      await tx.query("SELECT * FROM career_orders WHERE id=$1 FOR UPDATE", [
        order.id,
      ])
    ).rows[0];
    if (
      current.status === "paid" ||
      current.status === "refunded" ||
      current.status === "refund_required"
    )
      return false;
    if (verified.eligibleForTestOrderMarking) {
      if (
        (
          await tx.query(
            "SELECT 1 FROM career_orders WHERE account_id=$1 AND refund_started_at IS NOT NULL AND status<>'refunded'",
            [accountId],
          )
        ).rowCount
      ) {
        await tx.query(
          "UPDATE career_orders SET status='refund_required',paid_at=now() WHERE id=$1",
          [order.id],
        );
        return false;
      }
      const now = new Date(),
        paidAt = new Date(verified.capturedAt!),
        start = order.kind === "initial" ? now : paidAt,
        until =
          order.kind === "initial"
            ? new Date(now.getTime() + 90 * 86400000)
            : addCalendarMonths(paidAt, 12);
      if (order.kind === "extension") {
        const a = (
          await tx.query(
            "SELECT access_until FROM career_accounts WHERE id=$1",
            [accountId],
          )
        ).rows[0];
        if (
          !a.access_until ||
          new Date(a.access_until).getTime() + 30 * 86400000 <= Date.now() ||
          !(
            await tx.query(
              "SELECT 1 FROM career_orders WHERE account_id=$1 AND kind='initial' AND status='paid'",
              [accountId],
            )
          ).rowCount ||
          !(
            await tx.query("SELECT 1 FROM career_reports WHERE account_id=$1", [
              accountId,
            ])
          ).rowCount
        ) {
          await tx.query(
            "UPDATE career_orders SET status='refund_required',paid_at=now() WHERE id=$1",
            [order.id],
          );
          await event(
            "test_access_unavailable_refund_required",
            accountId,
            order.id,
            tx,
          );
          return false;
        }
      }
      await tx.query(
        "UPDATE career_orders SET status='paid',paid_at=$2 WHERE id=$1",
        [order.id, paidAt],
      );
      await tx.query(
        "INSERT INTO career_grants(order_id,account_id,starts_at,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [order.id, accountId, start, until],
      );
      await tx.query(
        "UPDATE career_accounts SET access_started_at=$2,access_until=$3,grant_order_id=$4 WHERE id=$1",
        [accountId, start, until, order.id],
      );
      await event("test_access_granted", accountId, order.id, tx);
      await queueCareerMail(accountId, order.id, "access_ready", tx);
      return true;
    }
    if (verified.status === "canceled")
      await tx.query("UPDATE career_orders SET status='canceled' WHERE id=$1", [
        order.id,
      ]);
    return false;
  });
  await flushCareerMail();
  return publicOrder(
    (
      await careerPool().query("SELECT * FROM career_orders WHERE id=$1", [
        order.id,
      ])
    ).rows[0],
  );
}
export async function webhookPayment(paymentId: unknown) {
  if (typeof paymentId !== "string" || !UUID_PATTERN.test(paymentId))
    throw new CareerError(400, "Неверное уведомление");
  const o = await careerPool().query(
    "SELECT id,account_id FROM career_orders WHERE payment_id=$1",
    [paymentId],
  );
  if (!o.rowCount) return { accepted: true, matched: false };
  await refreshOrder(o.rows[0].account_id, o.rows[0].id);
  return { accepted: true };
}
export async function simulatePayment(accountId: string, orderId: unknown) {
  if (typeof orderId !== "string" || !UUID_PATTERN.test(orderId))
    throw new CareerError(400, "Неверный заказ");
  const o = await careerPool().query(
    "SELECT payment_id FROM career_orders WHERE id=$1 AND account_id=$2",
    [orderId, accountId],
  );
  if (!o.rowCount || !o.rows[0].payment_id)
    throw new CareerError(404, "Заказ не найден");
  await completeLocalFixture(o.rows[0].payment_id);
  return refreshOrder(accountId, orderId);
}

export function ordinaryRefundDeadline(paid: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(paid)
      .filter((p) => ["year", "month", "day"].includes(p.type))
      .map((p) => [p.type, Number(p.value)]),
  );
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 8) - 3 * 3600000,
  );
}
export async function refundOrder(accountId: string, orderId: unknown) {
  if (typeof orderId !== "string" || !UUID_PATTERN.test(orderId))
    throw new CareerError(400, "Неверный заказ");
  const o = await transaction(async (tx) => {
    await tx.query("SELECT id FROM career_accounts WHERE id=$1 FOR UPDATE", [
      accountId,
    ]);
    const r = await tx.query(
      "SELECT o.*,a.grant_order_id FROM career_orders o JOIN career_accounts a ON a.id=o.account_id WHERE o.id=$1 AND o.account_id=$2 FOR UPDATE OF o",
      [orderId, accountId],
    );
    const found = r.rows[0];
    if (!found) throw new CareerError(404, "Заказ не найден");
    if (found.status === "refunded") return found;
    if (!found.refund_started_at) {
      if (
        !["paid", "refund_required"].includes(found.status) ||
        !found.paid_at ||
        Date.now() >= ordinaryRefundDeadline(found.paid_at).getTime()
      )
        throw new CareerError(
          409,
          "Автоматический обычный тестовый возврат недоступен. Специальные требования и реальные права рассматриваются поддержкой отдельно.",
        );
      if (
        found.grant_order_id !== found.id &&
        found.status !== "refund_required"
      )
        throw new CareerError(
          409,
          "В прототипе сначала возвращается последнее учебное продление; специальный случай требует поддержки.",
        );
      await tx.query(
        "UPDATE career_orders SET refund_started_at=now() WHERE id=$1",
        [found.id],
      );
    }
    return found;
  });
  if (o.status === "refunded") return publicOrder(o);
  const c = careerConfig(),
    request = {
      orderId: o.id,
      paymentId: o.payment_id,
      idempotenceKey: o.refund_key,
      kind: o.kind,
    };
  let refundId = o.refund_id;
  if (!refundId) {
    const created = await createSandboxRefund(request, c.keys, careerFetcher);
    refundId = created.id;
    await careerPool().query(
      "UPDATE career_orders SET refund_id=$2 WHERE id=$1 AND (refund_id IS NULL OR refund_id=$2)",
      [o.id, refundId],
    );
  }
  const verified = await verifySandboxRefund(
    refundId,
    request,
    c.keys,
    careerFetcher,
  );
  if (verified.status === "succeeded")
    await transaction(async (tx) => {
      await tx.query("SELECT id FROM career_accounts WHERE id=$1 FOR UPDATE", [
        accountId,
      ]);
      const fresh = (
        await tx.query(
          "SELECT status FROM career_orders WHERE id=$1 FOR UPDATE",
          [o.id],
        )
      ).rows[0];
      if (fresh.status === "refunded") return;
      await tx.query(
        "UPDATE career_orders SET status='refunded',refunded_at=now() WHERE id=$1",
        [o.id],
      );
      await tx.query(
        "UPDATE career_grants SET revoked_at=now() WHERE order_id=$1",
        [o.id],
      );
      const previous = await tx.query(
        "SELECT g.* FROM career_grants g JOIN career_orders p ON p.id=g.order_id WHERE g.account_id=$1 AND g.revoked_at IS NULL AND p.status='paid' ORDER BY g.starts_at DESC LIMIT 1",
        [accountId],
      );
      const g = previous.rows[0];
      await tx.query(
        "UPDATE career_accounts SET access_started_at=$2,access_until=$3,grant_order_id=$4 WHERE id=$1",
        [
          accountId,
          g?.starts_at || null,
          g?.expires_at || new Date(),
          g?.order_id || null,
        ],
      );
      await event("test_refund_confirmed", accountId, o.id, tx);
      await queueCareerMail(accountId, o.id, "refund_done", tx);
    });
  await flushCareerMail();
  return {
    ...publicOrder(
      (
        await careerPool().query("SELECT * FROM career_orders WHERE id=$1", [
          o.id,
        ])
      ).rows[0],
    ),
    refundStatus: verified.status,
  };
}
export async function webhookRefund(refundId: unknown) {
  if (typeof refundId !== "string" || !UUID_PATTERN.test(refundId))
    throw new CareerError(400, "Неверное уведомление");
  const r = await careerPool().query(
    "SELECT id,account_id FROM career_orders WHERE refund_id=$1",
    [refundId],
  );
  if (!r.rowCount) return { accepted: true, matched: false };
  await refundOrder(r.rows[0].account_id, r.rows[0].id);
  return { accepted: true };
}
