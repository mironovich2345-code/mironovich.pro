// Closed cloud demo — account API: session | register | login | logout | recover | delete-account.
// 404 unless lib/server/career-demo/config.ts validates the whole demo configuration (fail closed).
import { NextRequest } from "next/server";
import { CareerError } from "@/lib/server/career/config";
import {
  deleteDemoAccount, demoSessionUser, loginDemoUser, logoutDemo, recoverDemoPassword, registerDemoUser, PASSWORD_MIN,
} from "@/lib/server/career-demo/auth";
import { clearLoginCookie, clearSessionCookie, clientIp, guardDemoRequest, json, readJson, setLoginCookie, setSessionCookie } from "@/lib/server/career-demo/http";
import { completeSignup, resendOtp, startOtp, verifyOtp } from "@/lib/server/career-demo/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const c = guardDemoRequest(req);
    const { action } = await ctx.params;
    const token = req.cookies.get(c.cookieName)?.value;
    if (req.method === "GET" && action === "session") {
      const user = await demoSessionUser(token);
      const modes = { otp: !!(c.otpSecret && c.mail), password: c.passwordLogin, profile: c.profile, banner: c.banner, shop: !!c.commerce, signup: c.signup };
      return json(user
        ? { authenticated: true, ...modes, account: {
            email: user.email, emailVerified: user.emailVerified, accessUntil: user.accessUntil, hasAccess: user.hasAccess, createdAt: user.createdAt,
            isAdmin: user.isAdmin, hasPassword: user.authMethod === "password" } }
        : { authenticated: false, passwordMin: PASSWORD_MIN, ...modes });
    }
    if (req.method !== "POST") throw new CareerError(404, "Страница не найдена");
    if (action === "otp-start") {
      const b = await readJson(req, ["email"]);
      const r = await startOtp(b.email, clientIp(req));
      const res = json({ ok: true, maskedEmail: r.maskedEmail, resendSeconds: r.resendSeconds, expiresAt: r.expiresAt.toISOString() });
      setLoginCookie(res, c, r.token, r.expiresAt);
      return res;
    }
    if (action === "otp-resend") {
      await readJson(req, []);
      const challenge = req.cookies.get(c.loginCookieName)?.value;
      const r = await resendOtp(challenge, clientIp(req));
      const res = json({ ok: true, maskedEmail: r.maskedEmail, resendSeconds: r.resendSeconds, expiresAt: r.expiresAt.toISOString() });
      if (challenge) setLoginCookie(res, c, challenge, r.expiresAt);
      return res;
    }
    if (action === "otp-verify") {
      const b = await readJson(req, ["code"]);
      const r = await verifyOtp(req.cookies.get(c.loginCookieName)?.value, b.code, clientIp(req));
      if ("needInvite" in r) return json({ ok: false, needInvite: true, maskedEmail: r.maskedEmail });
      const res = json({ ok: true });
      clearLoginCookie(res, c);
      setSessionCookie(res, c, r.session);
      return res;
    }
    if (action === "otp-signup") {
      const b = await readJson(req, ["invite"]);
      const r = await completeSignup(req.cookies.get(c.loginCookieName)?.value, b.invite, clientIp(req));
      const res = json({ ok: true }, 201);
      clearLoginCookie(res, c);
      setSessionCookie(res, c, r.session);
      return res;
    }
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
      const b = await readJson(req, ["password", "emailConfirm"]);
      const user = await demoSessionUser(token);
      if (!user) throw new CareerError(401, "Войдите в кабинет");
      await deleteDemoAccount(user, b.password, b.emailConfirm);
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
