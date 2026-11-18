import nodemailer from "nodemailer";
import { careerConfig, CareerError } from "./config.ts";
export async function sendCareerMail(
  to: string,
  subject: string,
  text: string,
) {
  const { local } = careerConfig();
  const host = process.env.CAREER_SMTP_HOST,
    port = Number(process.env.CAREER_SMTP_PORT || 587);
  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    process.env.CAREER_SMTP_READY !== "true"
  )
    throw new CareerError(503, "Тестовая почта ещё не настроена");
  const sink = local && host === "127.0.0.1";
  const recipient = sink ? to : process.env.CAREER_SMTP_TEST_RECIPIENT;
  if (
    !recipient ||
    (!sink &&
      (!process.env.CAREER_SMTP_USER || !process.env.CAREER_SMTP_PASSWORD))
  )
    throw new CareerError(503, "Не настроен контролируемый тестовый inbox");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: !sink && port === 465,
    requireTLS: !sink,
    auth: sink
      ? undefined
      : {
          user: process.env.CAREER_SMTP_USER,
          pass: process.env.CAREER_SMTP_PASSWORD,
        },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });
  await transport.sendMail({
    from: "support@mironovich.pro",
    to: recipient,
    subject: "[СИНТЕТИЧЕСКИЙ ТЕСТ] " + subject,
    text:
      "Только учебные данные. Это не сообщение о реальной покупке.\n\n" + text,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export async function queueCareerMail(
  accountId: string,
  orderId: string,
  kind: "order_created" | "access_ready" | "refund_done",
  db: Pick<import("pg").PoolClient, "query">,
) {
  const { randomUUID } = await import("node:crypto");
  await db.query(
    "INSERT INTO career_mail_outbox(id,account_id,order_id,kind,dedupe_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(dedupe_key) DO NOTHING",
    [randomUUID(), accountId, orderId, kind, orderId + ":" + kind],
  );
}
export async function flushCareerMail() {
  const { transaction } = await import("./db.ts");
  for (let i = 0; i < 5; i++) {
    const found = await transaction(async (tx) => {
      const r = await tx.query(
        "SELECT m.*,a.email FROM career_mail_outbox m JOIN career_accounts a ON a.id=m.account_id WHERE m.sent_at IS NULL AND m.attempts<5 AND m.next_attempt_at<=now() ORDER BY m.created_at LIMIT 1 FOR UPDATE OF m SKIP LOCKED",
      );
      if (!r.rowCount) return false;
      const m = r.rows[0];
      const copy = {
        order_created: [
          "Создан тестовый заказ",
          "Учебный заказ создан. Это не подтверждение оплаты или выдачи доступа.",
        ],
        access_ready: [
          "Учебный доступ открыт",
          "Тестовый платёж независимо проверен. Учебный доступ предоставлен в кабинете.",
        ],
        refund_done: [
          "Тестовый возврат подтверждён",
          "Независимая проверка подтвердила возврат синтетического платежа. Доступ пересчитан.",
        ],
      } as const;
      try {
        await sendCareerMail(
          m.email,
          copy[m.kind as keyof typeof copy][0],
          copy[m.kind as keyof typeof copy][1],
        );
        await tx.query(
          "UPDATE career_mail_outbox SET sent_at=now(),attempts=attempts+1 WHERE id=$1",
          [m.id],
        );
      } catch {
        await tx.query(
          "UPDATE career_mail_outbox SET attempts=attempts+1,next_attempt_at=now()+interval '1 minute' WHERE id=$1",
          [m.id],
        );
      }
      return true;
    });
    if (!found) break;
  }
}
