// Outgoing mail for AI Career 3.0 sign-in codes. Two transports, both selected and validated in config.ts:
//  - smtp            — the real mailbox info@mironovich.pro (VK WorkSpace / Mail.ru SMTP); credentials only from env;
//  - preview-outbox  — stage-1 preview without SMTP: the message is kept for one hour in a key-protected preview
//                      mailbox page. Refused by config.ts everywhere else, so production can never drop mail into it.
// Never logs the code, the full recipient, credentials or provider responses.
import nodemailer, { type Transporter } from "nodemailer";
import { randomUUID } from "node:crypto";
import { careerPool } from "../career/db.ts";
import type { DemoConfig } from "./config.ts";

export type SendResult = { ok: true } | { ok: false; errorCode: string };
let transport: Transporter | undefined;

export function buildCodeEmail(code: string, minutes: number) {
  const subject = "Код входа в AI Career 3.0";
  const text =
    `AI Career 3.0 · mironovich.pro\n\n` +
    `Код для входа: ${code}\n` +
    `Код действует ${minutes} минут. Никому его не сообщайте.\n\n` +
    `Если вы не запрашивали вход, просто проигнорируйте это письмо.`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:480px;color:#0E0E11">` +
    `<p style="margin:0 0 8px;font-weight:700">AI Career 3.0 · mironovich.pro</p>` +
    `<p>Код для входа:</p><p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:8px 0">${code}</p>` +
    `<p>Код действует ${minutes} минут. Никому его не сообщайте.</p>` +
    `<p style="color:#555;font-size:13px">Если вы не запрашивали вход, просто проигнорируйте это письмо.</p></div>`;
  return { subject, text, html };
}

const domain = (to: string) => to.slice(to.lastIndexOf("@") + 1) || "unknown";

export async function sendCodeEmail(c: DemoConfig, to: string, code: string, minutes: number): Promise<SendResult> {
  const { subject, text, html } = buildCodeEmail(code, minutes);
  const mail = c.mail;
  if (!mail) return { ok: false, errorCode: "mail_not_configured" };
  try {
    if (mail.mode === "preview-outbox") {
      await careerPool().query(
        "INSERT INTO career_mail_preview(id,to_email,subject,body,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')",
        [randomUUID(), to, subject, text]);
      return { ok: true };
    }
    transport ??= nodemailer.createTransport({
      host: mail.host, port: mail.port, secure: mail.secure, requireTLS: !mail.secure, auth: { user: mail.user, pass: mail.password },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
    });
    await transport.sendMail({ from: mail.from, to, subject, text, html });
    return { ok: true };
  } catch (e) {
    const errorCode = String((e as { code?: string }).code ?? (e as Error).name ?? "send_failed").slice(0, 40);
    console.error(JSON.stringify({ event: "career.mail.failed", recipientDomain: domain(to), errorCode }));
    return { ok: false, errorCode };
  }
}

/** Preview mailbox (stage-1 preview only): the latest unexpired messages, newest first. */
export async function previewMessages(limit = 20) {
  await careerPool().query("DELETE FROM career_mail_preview WHERE expires_at < now()");
  const r = await careerPool().query("SELECT to_email,subject,body,created_at FROM career_mail_preview ORDER BY created_at DESC LIMIT $1", [limit]);
  return r.rows.map((m) => ({ to: m.to_email as string, subject: m.subject as string, body: m.body as string, at: new Date(m.created_at).toISOString() }));
}
