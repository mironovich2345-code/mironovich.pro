"use client";
// Closed cloud demo shell: the notice on every screen, invite-only registration, email + password sign-in,
// password recovery with a one-time code, the account screen (data and deletion), and the v3 cabinet.
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import CareerV3App from "@/components/career-v3/CareerV3App";
import { ApiError, Button, Notice, card, field, muted } from "@/components/career-v3/primitives";

const DEFAULT_BANNER = "Демонстрационная версия. Учебные материалы находятся на проверке. Используйте только вымышленные данные";
type Account = { email: string; emailVerified: boolean; accessUntil: string | null; hasAccess: boolean; createdAt: string; isAdmin: boolean; hasPassword: boolean };
type Modes = { otp: boolean; password: boolean; profile: "closed-demo" | "stage1"; banner: string; shop: boolean };
type Screen = "loading" | "welcome" | "login" | "code" | "register" | "recover" | "recovery-code" | "cabinet" | "purchase";

async function demoApi<T = Record<string, unknown>>(action: string, body?: unknown): Promise<T> {
  const r = await fetch("/api/career/demo/" + action, body === undefined
    ? { cache: "no-store" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let value: Record<string, unknown> = {};
  try { value = await r.json(); } catch { /* empty */ }
  if (!r.ok) throw new ApiError(r.status, String(value.error ?? "Сервис временно недоступен"));
  return value as T;
}
const ru = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export default function DemoApp() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [account, setAccount] = useState<Account | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<{ code: string; next: Screen } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modes, setModes] = useState<Modes>({ otp: false, password: true, profile: "closed-demo", banner: DEFAULT_BANNER, shop: false });

  // Lesson player = focus mode: the product line is hidden (the demo notice above always stays).
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const on = () => setPlaying(window.location.hash.startsWith("#play="));
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await demoApi<{ authenticated: boolean; account?: Account } & Modes>("session");
      setModes({ otp: s.otp, password: s.password, profile: s.profile, banner: s.banner, shop: s.shop });
      const query = new URLSearchParams(window.location.search);
      const payment = query.get("payment");
      if (payment) {
        window.history.replaceState(null, "", window.location.pathname + window.location.hash);
        setNotice(payment === "success"
          ? (s.account?.hasAccess ? "Оплата подтверждена, доступ открыт." : "Robokassa сообщила об успешной оплате. Доступ откроется, как только придёт серверное подтверждение — обновите страницу через минуту.")
          : "Оплата не завершена. Можно попробовать ещё раз.");
      }
      if (s.authenticated && s.account) { setAccount(s.account); setScreen(s.account.hasAccess ? "cabinet" : "purchase"); }
      else { setAccount(null); const openLogin = query.get("login") === "1"; setScreen((x) => (x === "loading" || x === "cabinet" || x === "purchase" ? (openLogin ? "login" : "welcome") : x)); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сервис временно недоступен");
      setScreen("welcome");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const signedOut = (message: string | null) => { setAccount(null); setNotice(message); setScreen("login"); window.scrollTo({ top: 0 }); };
  const go = (s: Screen) => { setError(null); setNotice(null); setScreen(s); window.scrollTo({ top: 0 }); };

  return (
    <div className="min-h-screen bg-cream text-graphite [color-scheme:light]">
      <div role="note" className="border-b border-signal/40 bg-[#FBF6EC] px-3 py-2 text-center text-[13px] font-semibold leading-snug sm:px-4 sm:py-2.5 sm:text-[15px]">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-signal align-middle" aria-hidden="true" />{modes.banner}
      </div>
      <header className={`mx-auto max-w-4xl items-center justify-between gap-3 px-4 pt-5 sm:px-6 ${playing && screen === "cabinet" ? "hidden" : "flex"}`}>
        <p className="font-display text-lg font-bold tracking-tight">AI Career 3.0 <span className={`font-sans text-sm font-semibold ${muted}`}>· {modes.profile === "stage1" ? "закрытое превью" : "закрытая демоверсия"}</span></p>
        <span className="flex items-center gap-3 text-sm">
          {account?.isAdmin && <Link href="/admin" className="font-semibold underline">Админ-кабинет</Link>}
          {account && <span className={`hidden truncate sm:inline ${muted}`}>{account.email}</span>}
        </span>
      </header>
      {screen === "cabinet" && account && notice && !playing && (
        <div className="mx-auto max-w-4xl px-4 pt-4 sm:px-6"><Notice>{notice}</Notice></div>
      )}
      {screen === "cabinet" && account ? (
        <CareerV3App demo={{
          onLogout: async () => { await demoApi("logout", {}).catch(() => undefined); signedOut("Вы вышли. Прогресс сохранён — войдите снова, чтобы продолжить."); },
          onSessionLost: () => signedOut("Сессия завершена. Войдите снова."),
          account: <AccountView account={account} onDeleted={() => { setAccount(null); setNotice("Аккаунт и все его данные удалены."); setScreen("welcome"); }} />,
        }} />
      ) : (
        <main id="main" className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
          {error && <div className="mb-5"><Notice tone="error">{error}</Notice></div>}
          {notice && <div className="mb-5"><Notice>{notice}</Notice></div>}
          {screen === "loading" && <p role="status">Загрузка…</p>}
          {screen === "welcome" && <Welcome modes={modes} onCode={() => go("code")} onLogin={() => go("login")} onRegister={() => go("register")} />}
          {screen === "code" && <CodeLogin onDone={() => { setNotice(null); void load(); }} onPassword={modes.password ? () => go("login") : undefined} />}
          {screen === "login" && (modes.password
            ? <LoginForm onDone={() => { setNotice(null); void load(); }} onRegister={() => go("register")} onRecover={() => go("recover")} onCode={modes.otp ? () => go("code") : undefined} />
            : <CodeLogin onDone={() => { setNotice(null); void load(); }} />)}
          {screen === "purchase" && account && <Purchase account={account} shop={modes.shop}
            onLogout={async () => { await demoApi("logout", {}).catch(() => undefined); signedOut("Вы вышли."); }} />}
          {screen === "register" && <RegisterForm onLogin={() => go("login")} onDone={(code) => { setRecoveryCode({ code, next: "cabinet" }); setScreen("recovery-code"); }} />}
          {screen === "recover" && <RecoverForm onLogin={() => go("login")} onDone={(code) => { setRecoveryCode({ code, next: "login" }); setScreen("recovery-code"); }} />}
          {screen === "recovery-code" && recoveryCode && (
            <RecoveryCode code={recoveryCode.code} after={recoveryCode.next === "cabinet" ? "Перейти в кабинет" : "Перейти ко входу"} onDone={() => {
              const next = recoveryCode.next; setRecoveryCode(null);
              if (next === "cabinet") void load(); else { setNotice("Пароль изменён. Войдите с новым паролем."); setScreen("login"); }
            }} />
          )}
        </main>
      )}
      <footer className={`mx-auto max-w-4xl px-4 pb-10 pt-4 text-[13px] leading-relaxed sm:px-6 ${muted}`}>
        {modes.profile === "stage1"
          ? <>Закрытое превью этапа 1 для приёмки. Не является публичным продуктом и офертой: оплата только тестовая (Robokassa IsTest=1 или эмулятор), внешние ИИ-сервисы отключены. Данные аккаунта удаляются по кнопке в разделе «Аккаунт».</>
          : <>Закрытая демонстрационная версия для приглашённых тестировщиков. Не является публичным продуктом и офертой: оплаты и внешние ИИ-сервисы отключены.
            Данные аккаунта удаляются через 7 дней после окончания демо-доступа или сразу — по кнопке в разделе «Аккаунт».</>}
      </footer>
    </div>
  );
}

function Form({ title, intro, submit, onSubmit, children, footer }: { title: string; intro?: ReactNode; submit: string; onSubmit: () => Promise<void>; children: ReactNode; footer?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className={card} noValidate={false} onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      try { await onSubmit(); } catch (x) { setError(x instanceof Error ? x.message : "Не удалось выполнить действие"); } finally { setBusy(false); }
    }}>
      <h1 className="font-display text-[clamp(26px,6vw,36px)] font-bold leading-tight">{title}</h1>
      {intro && <div className={`mt-2 text-[15px] leading-relaxed ${muted}`}>{intro}</div>}
      <div className="mt-5 space-y-4">{children}</div>
      {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
      <button type="submit" disabled={busy} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-graphite bg-graphite px-4 text-[16px] font-semibold text-cream hover:bg-[#2a2a30] disabled:opacity-50">
        {busy ? "Подождите…" : submit}
      </button>
      {footer && <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[15px]">{footer}</div>}
    </form>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[15px] font-semibold">{label}</span>
      {hint && <span className={`mt-0.5 block text-[13px] ${muted}`}>{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
const inputClass = field + " text-[16px]"; // 16px: iOS Safari does not zoom into the field

function Welcome({ modes, onCode, onLogin, onRegister }: { modes: Modes; onCode: () => void; onLogin: () => void; onRegister: () => void }) {
  if (!modes.password) return (
    <section className={card} aria-labelledby="welcome-title">
      <h1 id="welcome-title" className="font-display text-[clamp(28px,7vw,42px)] font-bold leading-tight">Карьерный маршрут менеджера по продажам</h1>
      <p className="mt-3 text-[16px] leading-relaxed">Диагностика из 18 вопросов, карта задач, маршрут из 30 шагов с уроками и упражнениями, замеры «до и после» и учебные отчёты.</p>
      <p className={`mt-3 text-[15px] leading-relaxed ${muted}`}>Вход без пароля: введите email и код из письма. Все данные в кабинете должны быть вымышленными.</p>
      <button type="button" onClick={onCode} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-graphite bg-graphite px-4 text-[16px] font-semibold text-cream">Войти по коду из письма</button>
    </section>
  );
  return (
    <section className={card} aria-labelledby="welcome-title">
      <h1 id="welcome-title" className="font-display text-[clamp(28px,7vw,42px)] font-bold leading-tight">Карьерный маршрут менеджера по продажам</h1>
      <p className="mt-3 text-[16px] leading-relaxed">Диагностика из 18 вопросов, карта задач, маршрут из 30 шагов с уроками и упражнениями, замеры «до и после» и учебные отчёты.</p>
      <p className={`mt-3 text-[15px] leading-relaxed ${muted}`}>Регистрация — только по пригласительному коду. Все данные в кабинете должны быть вымышленными: не вводите сведения о реальных клиентах, работодателе и сделках.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onRegister} className="inline-flex min-h-12 items-center justify-center rounded-md border border-graphite bg-graphite px-4 text-[16px] font-semibold text-cream">Зарегистрироваться</button>
        <button type="button" onClick={onLogin} className="inline-flex min-h-12 items-center justify-center rounded-md border border-graphite/60 px-4 text-[16px] font-semibold hover:border-signal">Войти</button>
      </div>
    </section>
  );
}

function LoginForm({ onDone, onRegister, onRecover, onCode }: { onDone: () => void; onRegister: () => void; onRecover: () => void; onCode?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <Form title="Вход" submit="Войти" onSubmit={async () => { await demoApi("login", { email, password }); setPassword(""); onDone(); }}
      footer={<><Button variant="quiet" onClick={onRecover}>Забыли пароль?</Button><Button variant="quiet" onClick={onRegister}>Регистрация по приглашению</Button>{onCode && <Button variant="quiet" onClick={onCode}>Войти по коду из письма</Button>}</>}>
      <Field label="Email"><input className={inputClass} type="email" name="email" autoComplete="username" inputMode="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Пароль"><input className={inputClass} type="password" name="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
    </Form>
  );
}

function RegisterForm({ onDone, onLogin }: { onDone: (recoveryCode: string) => void; onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setConfirm] = useState("");
  const [invite, setInvite] = useState("");
  return (
    <Form title="Регистрация" submit="Создать аккаунт"
      intro={<>Email станет логином. Он не подтверждается: письма в демоверсии не отправляются. Пароль — не короче 10 символов.</>}
      onSubmit={async () => {
        if (password !== passwordConfirm) throw new Error("Пароль и подтверждение не совпадают");
        const r = await demoApi<{ recoveryCode: string }>("register", { email, password, passwordConfirm, invite });
        setPassword(""); setConfirm(""); setInvite("");
        onDone(r.recoveryCode);
      }}
      footer={<Button variant="quiet" onClick={onLogin}>Уже есть аккаунт — войти</Button>}>
      <Field label="Email"><input className={inputClass} type="email" name="email" autoComplete="username" inputMode="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Пароль"><input className={inputClass} type="password" name="new-password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Field label="Повторите пароль"><input className={inputClass} type="password" name="confirm-password" autoComplete="new-password" required minLength={10} maxLength={128} value={passwordConfirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
      <Field label="Пригласительный код" hint="Одноразовый код от организатора демо. Нужен только при регистрации.">
        <input className={inputClass + " font-mono uppercase tracking-wider"} type="text" name="invite" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={32} value={invite} onChange={(e) => setInvite(e.target.value)} />
      </Field>
    </Form>
  );
}

function RecoverForm({ onDone, onLogin }: { onDone: (recoveryCode: string) => void; onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setConfirm] = useState("");
  return (
    <Form title="Восстановление пароля" submit="Сменить пароль"
      intro={<>Введите код восстановления, который был показан при регистрации. Если код утерян, попросите у организатора демо одноразовый код сброса — он действует 1 час. Все открытые сессии будут завершены.</>}
      onSubmit={async () => {
        if (password !== passwordConfirm) throw new Error("Пароль и подтверждение не совпадают");
        const r = await demoApi<{ recoveryCode: string }>("recover", { email, code, password, passwordConfirm });
        setPassword(""); setConfirm(""); setCode("");
        onDone(r.recoveryCode);
      }}
      footer={<Button variant="quiet" onClick={onLogin}>Вернуться ко входу</Button>}>
      <Field label="Email"><input className={inputClass} type="email" name="email" autoComplete="username" inputMode="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Код восстановления или сброса"><input className={inputClass + " font-mono uppercase tracking-wider"} type="text" name="recovery-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={40} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
      <Field label="Новый пароль"><input className={inputClass} type="password" name="new-password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Field label="Повторите новый пароль"><input className={inputClass} type="password" name="confirm-password" autoComplete="new-password" required minLength={10} maxLength={128} value={passwordConfirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
    </Form>
  );
}

function RecoveryCode({ code, after, onDone }: { code: string; after: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <section className={card} aria-labelledby="rc-title">
      <h1 id="rc-title" className="font-display text-[clamp(26px,6vw,36px)] font-bold leading-tight">Код восстановления</h1>
      <p className="mt-2 text-[15px] leading-relaxed">Сохраните код в надёжном месте. Он нужен, чтобы сменить забытый пароль, и показывается только один раз. После использования выдаётся новый.</p>
      <p className="mt-4 select-all break-all rounded-md border border-graphite/30 bg-white px-4 py-3 text-center font-mono text-[18px] font-bold tracking-wider" data-recovery-code>{code}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { setCopied(false); } }}>Скопировать</Button>
        <span role="status" className="text-sm">{copied ? "Скопировано" : ""}</span>
      </div>
      <label className="mt-5 flex items-start gap-3 text-[15px]"><input type="checkbox" className="mt-1 h-5 w-5" checked={saved} onChange={(e) => setSaved(e.target.checked)} /><span>Я сохранил(а) код восстановления</span></label>
      <button type="button" disabled={!saved} onClick={onDone} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-graphite bg-graphite px-4 text-[16px] font-semibold text-cream disabled:opacity-50">{after}</button>
    </section>
  );
}

function AccountView({ account, onDeleted }: { account: Account; onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <article aria-labelledby="account-title">
      <h1 id="account-title" className="font-display text-[clamp(28px,6vw,44px)] font-bold leading-tight">Аккаунт</h1>
      <dl className={`${card} mt-5 grid gap-3 text-[15px] sm:grid-cols-[auto,1fr] sm:gap-x-6`}>
        <dt className="font-semibold">Email (логин)</dt><dd className="break-all">{account.email} <span className={muted}>— {account.emailVerified ? "подтверждён кодом из письма" : "не подтверждён"}</span></dd>
        <dt className="font-semibold">Аккаунт создан</dt><dd>{ru(account.createdAt)}</dd>
        <dt className="font-semibold">Доступ до</dt><dd>{account.accessUntil ? ru(account.accessUntil) : "—"}</dd>
      </dl>
      <section className="mt-8" aria-labelledby="data-title">
        <h2 id="data-title" className="text-xl font-bold">Какие данные хранятся</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
          <li>email{account.hasPassword ? " и хеш пароля (сам пароль не хранится)" : " (вход по одноразовому коду, пароль не используется)"};</li>
          <li>ответы диагностики, карта задач, маршрут, отметки по шагам и мини-тестам;</li>
          <li>учебные замеры «до и после» — только числа и даты.</li>
        </ul>
        <p className={`mt-3 text-[15px] leading-relaxed ${muted}`}>Аналитика и рекламные cookie не используются. Хранится только cookie сессии. Через 7 дней после окончания демо-доступа аккаунт удаляется автоматически.</p>
      </section>
      <section className={`${card} mt-8`} aria-labelledby="delete-title">
        <h2 id="delete-title" className="text-xl font-bold">Удалить аккаунт</h2>
        <p className="mt-2 text-[15px] leading-relaxed">Будут удалены аккаунт, диагностика, маршрут, прогресс, замеры и отчёты. Восстановить их нельзя.</p>
        <form className="mt-4 space-y-4" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setError(null);
          try { await demoApi("delete-account", account.hasPassword ? { password } : { emailConfirm }); onDeleted(); } catch (x) { setError(x instanceof Error ? x.message : "Не удалось удалить"); } finally { setBusy(false); }
        }}>
          {account.hasPassword
            ? <Field label="Пароль для подтверждения"><input className={inputClass} type="password" name="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            : <Field label="Введите свой email для подтверждения"><input className={inputClass} type="email" name="email-confirm" autoComplete="off" required maxLength={254} value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} /></Field>}
          <label className="flex items-start gap-3 text-[15px]"><input type="checkbox" className="mt-1 h-5 w-5" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /><span>Я понимаю, что данные будут удалены без возможности восстановления</span></label>
          {error && <Notice tone="error">{error}</Notice>}
          <button type="submit" disabled={!confirm || busy} className="inline-flex min-h-11 items-center rounded-md border border-signal px-4 text-[15px] font-semibold text-signal disabled:opacity-50">Удалить аккаунт и данные</button>
        </form>
      </section>
    </article>
  );
}

/** Passwordless sign-in: email → six-digit code from info@mironovich.pro → (new email in a closed contour) invite. */
function CodeLogin({ onDone, onPassword }: { onDone: () => void; onPassword?: () => void }) {
  const [step, setStep] = useState<"email" | "code" | "invite">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState("");
  const [masked, setMasked] = useState("");
  const [wait, setWait] = useState(0);
  const [info, setInfo] = useState<string | null>(null);
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);
  if (step === "email") return (
    <Form title="Вход" submit="Получить код" intro={<>Отправим шестизначный код на ваш email с адреса info@mironovich.pro. Пароль не нужен.</>}
      onSubmit={async () => { const r = await demoApi<{ maskedEmail: string; resendSeconds: number }>("otp-start", { email }); setMasked(r.maskedEmail); setWait(r.resendSeconds); setInfo(null); setStep("code"); }}
      footer={onPassword && <Button variant="quiet" onClick={onPassword}>Войти по паролю (старые аккаунты демо)</Button>}>
      <Field label="Email"><input className={inputClass} type="email" name="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
    </Form>
  );
  if (step === "code") return (
    <Form title="Код из письма" submit="Войти"
      intro={<>Если адрес {masked} можно использовать для входа, на него отправлен код. Он действует 10 минут, неверно ввести можно не больше 5 раз. Проверьте папку «Спам».</>}
      onSubmit={async () => {
        const r = await demoApi<{ ok: boolean; needInvite?: boolean }>("otp-verify", { code });
        setCode("");
        if (r.needInvite) { setStep("invite"); return; }
        onDone();
      }}
      footer={<>
        <Button variant="quiet" disabled={wait > 0} onClick={async () => {
          try { const r = await demoApi<{ resendSeconds: number }>("otp-resend", {}); setWait(r.resendSeconds); setInfo("Новый код отправлен. Предыдущий больше не действует."); }
          catch (x) { setInfo(x instanceof Error ? x.message : "Не удалось отправить код"); }
        }}>{wait > 0 ? `Отправить код ещё раз через ${wait} с` : "Отправить код ещё раз"}</Button>
        <Button variant="quiet" onClick={() => { setStep("email"); setInfo(null); }}>Другой email</Button>
      </>}>
      <Field label="Шестизначный код">
        <input className={inputClass + " font-mono text-[22px] tracking-[0.4em]"} type="text" name="one-time-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9 ]{6,7}" required maxLength={7}
          value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} autoFocus />
      </Field>
      {info && <p role="status" className="text-[14px]">{info}</p>}
    </Form>
  );
  return (
    <Form title="Нужно приглашение" submit="Создать аккаунт"
      intro={<>Email {masked} подтверждён, но аккаунта для него пока нет. Закрытое превью открыто только по пригласительному коду.</>}
      onSubmit={async () => { await demoApi("otp-signup", { invite }); setInvite(""); onDone(); }}>
      <Field label="Пригласительный код" hint="Одноразовый код от организатора.">
        <input className={inputClass + " font-mono uppercase tracking-wider"} type="text" name="invite" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={32} value={invite} onChange={(e) => setInvite(e.target.value)} />
      </Field>
    </Form>
  );
}

type ShopState = { priceRub: number; paymentsReady: boolean; paymentMode: "test" | "emulator" | null; order: { id: string; invId: number; priceRub: number; status: string; reservedUntil: string } | null };
const rub = (n: number) => n.toLocaleString("ru-RU").replace(/\s/g, "\u00a0") + "\u00a0₽";

/** Signed in without access: the one current price, an order with a fixed amount, then the (test) payment page. */
function Purchase({ account, shop, onLogout }: { account: Account; shop: boolean; onLogout: () => void }) {
  const [state, setState] = useState<ShopState | null>(null);
  const [adult, setAdult] = useState(false);
  const [offer, setOffer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!shop) return;
    try { setState(await (await fetch("/api/career/shop/order", { cache: "no-store" })).json()); } catch { setError("Не удалось загрузить данные заказа"); }
  }, [shop]);
  useEffect(() => { void refresh(); }, [refresh]);
  const pending = state?.order?.status === "pending" ? state.order : null;
  const shopPost = async (action: string, body: unknown) => {
    const r = await fetch("/api/career/shop/" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const v = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(String(v.error ?? "Сервис временно недоступен"));
    return v;
  };
  return (
    <section className={card} aria-labelledby="buy-title">
      <h1 id="buy-title" className="font-display text-[clamp(26px,6vw,36px)] font-bold leading-tight">{account.accessUntil ? "Доступ закончился" : "Доступ к программе"}</h1>
      <p className="mt-2 text-[15px] leading-relaxed">Вы вошли как {account.email}. Диагностика из 18 вопросов, маршрут из 30 шагов и PDF откроются после оплаты; доступ — 90 дней.</p>
      {!shop ? <p className={`mt-4 ${muted}`}>Покупка в этой версии недоступна.</p> : !state ? <p role="status" className="mt-4">Загрузка…</p> : (
        <>
          <p className="mt-5 text-[14px] font-semibold uppercase tracking-wide text-signal">Цена</p>
          <p className="font-display text-[44px] font-bold leading-none" data-testid="shop-price">{rub(pending ? pending.priceRub : state.priceRub)}</p>
          {pending && <p className="mt-2 text-[15px]">Заказ № {pending.invId} ожидает оплаты. Сумма зафиксирована до {new Date(pending.reservedUntil).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}.</p>}
          <p className={`mt-2 text-[14px] ${muted}`}>Тестовая оплата: деньги не списываются. Сумма фиксируется в заказе и показывается до оплаты.</p>
          {!pending && <div className="mt-4 space-y-3">
            <label className="flex items-start gap-3 text-[15px]"><input type="checkbox" className="mt-1 h-5 w-5" checked={adult} onChange={(e) => setAdult(e.target.checked)} /><span>Мне исполнилось 18 лет</span></label>
            <label className="flex items-start gap-3 text-[15px]"><input type="checkbox" className="mt-1 h-5 w-5" checked={offer} onChange={(e) => setOffer(e.target.checked)} /><span>Принимаю <a className="underline" href="/offer/ai-career" target="_blank" rel="noreferrer">условия оферты</a> (проект, тестовый режим)</span></label>
          </div>}
          {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={busy || !state.paymentsReady || (!pending && (!adult || !offer))} onClick={async () => {
              setBusy(true); setError(null);
              try { const r = await shopPost("order", { adultConfirmed: pending ? true : adult, offerAccepted: pending ? true : offer }); window.location.assign(r.payUrl); }
              catch (x) { setError(x instanceof Error ? x.message : "Не удалось создать заказ"); setBusy(false); }
            }} className="inline-flex min-h-12 items-center justify-center rounded-md border border-graphite bg-graphite px-4 text-[16px] font-semibold text-cream disabled:opacity-40">
              {state.paymentsReady ? (pending ? "Перейти к оплате" : "Перейти к тестовой оплате") : "Оплата ещё не подключена"}
            </button>
            {pending && <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await shopPost("cancel", { orderId: pending.id }); await refresh(); } catch (x) { setError((x as Error).message); } finally { setBusy(false); } }}
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-graphite/50 px-4 text-[16px] font-semibold">Отменить заказ</button>}
          </div>
        </>
      )}
      <div className="mt-6 text-[15px]"><Button variant="quiet" onClick={onLogout}>Выйти</Button></div>
    </section>
  );
}
