// Closed cloud demo — account API: session | register | login | logout | recover | delete-account.
// 404 unless lib/server/career-demo/config.ts validates the whole demo configuration (fail closed).
import { NextRequest } from "next/server";
import { CareerError } from "@/lib/server/career/config";
import {
  deleteDemoAccount, demoSessionUser, loginDemoUser, logoutDemo, recoverDemoPassword, registerDemoUser, PASSWORD_MIN,
} from "@/lib/server/career-demo/auth";
import { clearSessionCookie, clientIp, guardDemoRequest, json, readJson, setSessionCookie } from "@/lib/server/career-demo/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const c = guardDemoRequest(req);
    const { action } = await ctx.params;
    const token = req.cookies.get(c.cookieName)?.value;
    if (req.method === "GET" && action === "session") {
      const user = await demoSessionUser(token);
      return json(user
        ? { authenticated: true, account: { email: user.email, emailVerified: false, accessUntil: user.accessUntil, createdAt: user.createdAt } }
        : { authenticated: false, passwordMin: PASSWORD_MIN });
    }
    if (req.method !== "POST") throw new CareerError(404, "Страница не найдена");
    if (action === "register") {
      const b = await readJson(req, ["email", "password", "passwordConfirm", "invite"]);
      const r = await registerDemoUser({ email: b.email, password: b.password, passwordConfirm: b.passwordConfirm, invite: b.invite, ip: clientIp(req) });
      const res = json({ ok: true, recoveryCode: r.recoveryCode }, 201);
      setSessionCookie(res, c, r.token);
      return res;
    }
    if (action === "login") {
      const b = await readJson(req, ["email", "password"]);
      const t = await loginDemoUser(b.email, b.password, clientIp(req));
      const res = json({ ok: true });
      setSessionCookie(res, c, t);
      return res;
    }
    if (action === "logout") {
      await readJson(req, []);
      await logoutDemo(token);
      const res = json({ ok: true });
      clearSessionCookie(res, c);
      return res;
    }
    if (action === "recover") {
      const b = await readJson(req, ["email", "code", "password", "passwordConfirm"]);
      const r = await recoverDemoPassword({ email: b.email, code: b.code, password: b.password, passwordConfirm: b.passwordConfirm, ip: clientIp(req) });
      const res = json({ ok: true, recoveryCode: r.recoveryCode });
      clearSessionCookie(res, c);
      return res;
    }
    if (action === "delete-account") {
      const b = await readJson(req, ["password"]);
      const user = await demoSessionUser(token);
      if (!user) throw new CareerError(401, "Войдите в демо-кабинет");
      await deleteDemoAccount(user, b.password);
      const res = json({ ok: true });
      clearSessionCookie(res, c);
      return res;
    }
    throw new CareerError(404, "Страница не найдена");
  } catch (e) {
    if (e instanceof CareerError) return json({ error: e.message }, e.status);
    console.error("career-demo auth route failed", (e as Error).name); // never the request body
    return json({ error: "Сервис временно недоступен" }, 500);
  }
}

export const GET = handle;
export const POST = handle;
