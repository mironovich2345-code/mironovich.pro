// Explicit local test doubles. No real SMTP/provider, no codes printed to logs.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
process.loadEnvFile(".env.career.local");
const { careerConfig } = await import("../../lib/server/career/config.ts");
const config = careerConfig();
if (!config.local || config.mode !== "fixture")
  throw Error("Loopback fixture mode only");
const control = process.env.CAREER_FIXTURE_CONTROL_SECRET;
if (!control || control.length < 32)
  throw Error("Fixture control key required");
let deferRefunds = false;
const mail = new Map(),
  payments = new Map(),
  idempotence = new Map(),
  refunds = new Map();
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["AUTH", "STARTTLS"],
  logger: false,
  onData(stream, session, callback) {
    let raw = "",
      bytes = 0;
    stream.on("data", (b) => {
      bytes += b.length;
      if (bytes < 200000) raw += b.toString();
    });
    stream.on("end", async () => {
      try {
        const parsed = await simpleParser(raw);
        const recipient = session.envelope.rcptTo[0]?.address;
        const code = parsed.text?.match(/OTP_CODE (\d{6})/)?.[1];
        if (recipient && code) mail.set(recipient, code);
        callback();
      } catch {
        callback(new Error("Invalid synthetic mail"));
      }
    });
  },
});
smtp.listen(Number(process.env.CAREER_SMTP_PORT || 2526), "127.0.0.1");
const http = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const reply = (status, value) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  if (url.pathname.startsWith("/fixture/")) {
    if (req.headers["x-fixture-key"] !== control) return reply(403, {});
    if (url.pathname.startsWith("/fixture/mail/"))
      return reply(200, {
        code:
          mail.get(
            decodeURIComponent(url.pathname.slice("/fixture/mail/".length)),
          ) || null,
      });
    if (req.method === "POST" && url.pathname === "/fixture/defer-refunds") {
      deferRefunds = !deferRefunds;
      return reply(200, { pending: deferRefunds });
    }
    if (req.method === "POST" && url.pathname.startsWith("/fixture/refund/")) {
      const r = refunds.get(url.pathname.split("/").pop());
      if (!r) return reply(404, {});
      r.status = "succeeded";
      return reply(200, { ok: true });
    }
    const id = url.pathname.split("/").pop(),
      p = payments.get(id);
    if (
      req.method === "POST" &&
      url.pathname.startsWith("/fixture/complete/") &&
      p
    ) {
      p.status = "succeeded";
      p.paid = true;
      p.captured_at ||= new Date(Date.now() - 5000).toISOString();
      return reply(200, { ok: true });
    }
    return reply(404, {});
  }
  const expected =
    "Basic " +
    Buffer.from(config.keys.shopId + ":" + config.keys.secretKey).toString(
      "base64",
    );
  if (req.headers.authorization !== expected) return reply(401, {});
  if (req.method === "GET" && url.pathname.startsWith("/v3/refunds/")) {
    const r = refunds.get(url.pathname.split("/").pop());
    return reply(r ? 200 : 404, r || {});
  }
  if (req.method === "POST" && url.pathname === "/v3/refunds") {
    let raw = "";
    for await (const b of req) raw += b.toString();
    const body = JSON.parse(raw),
      key = "refund:" + req.headers["idempotence-key"];
    if (idempotence.has(key))
      return reply(200, refunds.get(idempotence.get(key)));
    const r = {
      id: randomUUID(),
      payment_id: body.payment_id,
      status: deferRefunds ? "pending" : "succeeded",
      amount: body.amount,
    };
    refunds.set(r.id, r);
    idempotence.set(key, r.id);
    return reply(200, r);
  }
  if (req.method === "GET" && url.pathname.startsWith("/v3/payments/")) {
    const p = payments.get(url.pathname.split("/").pop());
    return reply(p ? 200 : 404, p || {});
  }
  if (req.method === "POST" && url.pathname === "/v3/payments") {
    let raw = "";
    for await (const b of req) {
      raw += b.toString();
      if (raw.length > 16384) return reply(413, {});
    }
    const body = JSON.parse(raw),
      key = req.headers["idempotence-key"];
    if (!key) return reply(400, {});
    if (idempotence.has(key))
      return reply(200, payments.get(idempotence.get(key)));
    const id = randomUUID(),
      p = {
        id,
        status: "pending",
        paid: false,
        test: true,
        amount: body.amount,
        metadata: body.metadata,
        confirmation: {
          confirmation_url:
            "https://yoomoney.ru/api-pages/v2/payment-confirm/" + id,
        },
      };
    payments.set(id, p);
    idempotence.set(key, id);
    return reply(200, p);
  }
  return reply(404, {});
});
http.listen(
  new URL(process.env.CAREER_PROVIDER_FIXTURE_URL).port,
  "127.0.0.1",
  () => console.log("Local synthetic provider and SMTP fixtures ready"),
);
