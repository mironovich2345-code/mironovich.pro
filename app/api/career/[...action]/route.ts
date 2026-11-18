import { NextRequest, NextResponse } from "next/server";
import {
  careerConfig,
  CareerError,
  GATE_COOKIE,
  SESSION_COOKIE,
} from "@/lib/server/career/config";
import {
  admitTester,
  validGate,
  requestOtp,
  verifyOtp,
  sessionAccount,
  logout,
  limit,
} from "@/lib/server/career/auth";
import {
  createOrder,
  refreshOrder,
  simulatePayment,
  webhookPayment,
  refundOrder,
  webhookRefund,
} from "@/lib/server/career/orders";
import {
  dashboard,
  saveDiagnostic,
  createAnalysis,
  readPdf,
  updateProgress,
} from "@/lib/server/career/analysis";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
function fields(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some((k) => !allowed.includes(k)))
    throw new CareerError(400, "Неожиданные данные запроса");
}
async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ action: string[] }> },
) {
  try {
    const config = careerConfig(),
      action = (await ctx.params).action.join("/");
    if (req.headers.get("host") !== new URL(config.origin).host)
      throw new CareerError(403, "Неверный host");
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      if (action !== "webhook" && req.headers.get("origin") !== config.origin)
        throw new CareerError(403, "Неверный источник запроса");
      if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
        throw new CareerError(415, "Требуется JSON");
      if (Number(req.headers.get("content-length") || 0) > 16384)
        throw new CareerError(413, "Запрос слишком большой");
      const reader = req.body?.getReader();
      let raw = "",
        size = 0;
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 16384) {
            await reader.cancel();
            throw new CareerError(413, "Запрос слишком большой");
          }
          raw += decoder.decode(part.value, { stream: true });
        }
        raw += decoder.decode();
      }
      try {
        const b = JSON.parse(raw);
        if (!b || typeof b !== "object" || Array.isArray(b)) throw Error();
        body = b;
      } catch {
        throw new CareerError(400, "Неверный JSON");
      }
    }
    if (req.method === "POST" && action === "webhook") {
      await limit("webhook", 120, 60);
      const object = body.object as Record<string, unknown> | undefined;
      if (body.event === "refund.succeeded")
        return json(await webhookRefund(object?.id));
      if (
        body.event !== "payment.succeeded" &&
        body.event !== "payment.canceled" &&
        body.event !== "payment.waiting_for_capture"
      )
        return json({ accepted: true, ignored: true });
      return json(await webhookPayment(object?.id));
    }
    if (req.method === "POST" && action === "tester") {
      fields(body, ["accessCode", "onlySynthetic"]);
      const gate = await admitTester(body.accessCode, body.onlySynthetic);
      const r = json({ ok: true, synthetic: true });
      r.cookies.set(GATE_COOKIE, gate, {
        httpOnly: true,
        sameSite: "lax",
        secure: !config.local,
        path: "/",
        maxAge: 3600,
      });
      return r;
    }
    if (req.method === "POST" && action === "auth/logout") {
      fields(body, []);
      await logout(req.cookies.get(SESSION_COOKIE)?.value);
      const r = json({ ok: true });
      r.cookies.delete(SESSION_COOKIE);
      r.cookies.delete(GATE_COOKIE);
      return r;
    }
    if (!validGate(req.cookies.get(GATE_COOKIE)?.value))
      throw new CareerError(
        403,
        "Требуется допуск тестировщика; реальные данные запрещены",
      );
    if (req.method === "POST" && action === "auth/request") {
      fields(body, ["email"]);
      return json(await requestOtp(body.email));
    }
    if (req.method === "POST" && action === "auth/verify") {
      fields(body, ["challengeId", "code"]);
      const token = await verifyOtp(body.challengeId, body.code);
      const r = json({ ok: true });
      r.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: !config.local,
        path: "/",
        maxAge: 12 * 3600,
      });
      return r;
    }
    const accountId = await sessionAccount(
      req.cookies.get(SESSION_COOKIE)?.value,
    );
    if (req.method === "GET" && action === "session")
      return json(
        accountId
          ? { ...(await dashboard(accountId)), paymentMode: config.mode }
          : { authenticated: false, synthetic: true },
      );
    if (!accountId)
      throw new CareerError(401, "Требуется вход по учебному email-коду");
    await limit("account:" + accountId, 120, 60);
    if (req.method === "POST" && action === "orders") {
      fields(body, ["kind", "adult", "offer"]);
      return json(
        await createOrder(accountId, body.kind, body.adult, body.offer),
      );
    }
    if (req.method === "POST" && action === "orders/refresh") {
      fields(body, ["orderId"]);
      return json(await refreshOrder(accountId, body.orderId));
    }
    if (req.method === "POST" && action === "orders/fixture-complete") {
      fields(body, ["orderId"]);
      return json(await simulatePayment(accountId, body.orderId));
    }
    if (req.method === "POST" && action === "orders/refund") {
      fields(body, ["orderId"]);
      return json(await refundOrder(accountId, body.orderId));
    }
    if (req.method === "POST" && action === "diagnostic") {
      fields(body, ["answers"]);
      return json(await saveDiagnostic(accountId, body.answers));
    }
    if (req.method === "POST" && action === "analysis") {
      fields(body, []);
      const result = await createAnalysis(accountId);
      return json(result, result.status === "running" ? 202 : 200);
    }
    if (req.method === "POST" && action === "progress") {
      fields(body, ["day", "done"]);
      return json(await updateProgress(accountId, body.day, body.done));
    }
    if (req.method === "GET" && action === "report") {
      const pdf = await readPdf(accountId);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="career-synthetic-report.pdf"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }
    throw new CareerError(404, "Маршрут не найден");
  } catch (error) {
    if (error instanceof CareerError)
      return json({ error: error.message }, error.status);
    console.error("[career-sandbox] operation_failed");
    return json(
      {
        error:
          "Тестовый сервис недоступен. Обратитесь к администратору стенда.",
      },
      503,
    );
  }
}
export const GET = handle;
export const POST = handle;
