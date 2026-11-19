"use client";
// AI Career 3.0 cabinet (pilot: sales manager). Synthetic sandbox only. Tester admission, sign-in and
// the test order reuse the existing v2 endpoints unchanged; everything else talks to the v3 engine.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Diagnostic from "./Diagnostic";
import TaskMapView from "./TaskMapView";
import RouteView from "./RouteView";
import LessonView from "./LessonView";
import { ApiError, Badge, Button, Notice, card, field, muted, v2, v3 } from "./primitives";

type Session = { authenticated?: boolean; active?: boolean; paymentMode?: string; account?: { email: string; access_until: string | null } };
type CabinetState = { libraryMode: "content" | "synthetic_fixture"; previewEnabled: boolean; publishedLessons: number };
type View = "diagnostic" | "map" | "route" | "lessons" | "lesson";
const VIEWS: { id: Exclude<View, "lesson">; label: string }[] = [
  { id: "diagnostic", label: "Диагностика" }, { id: "map", label: "Моя карта" }, { id: "route", label: "Мой маршрут" }, { id: "lessons", label: "Уроки" },
];

function readHash(): { view: View; lesson?: string; preview?: boolean } {
  if (typeof window === "undefined") return { view: "diagnostic" };
  const h = window.location.hash.slice(1);
  const m = /^(lesson|preview)=([A-Z0-9-]+)$/.exec(h);
  if (m) return { view: "lesson", lesson: m[2], preview: m[1] === "preview" };
  return { view: (VIEWS.some((v) => v.id === h) ? h : "diagnostic") as View };
}

export default function CareerV3App() {
  const [phase, setPhase] = useState<"loading" | "gate" | "login" | "access" | "cabinet">("loading");
  const [session, setSession] = useState<Session>({});
  const [state, setState] = useState<CabinetState | null>(null);
  const [route, setRoute] = useState(readHash());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await v2<Session>("session");
      setSession(s);
      // v2 returns { authenticated: false } without a session and the dashboard (with account) with one.
      if (!s.account) { setPhase("login"); return; }
      if (!s.active) { setPhase("access"); return; }
      setState(await v3<CabinetState>("state"));
      setPhase("cabinet");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setPhase("gate");
      else setError(e instanceof Error ? e.message : "Тестовый контур недоступен");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (view: View, lesson?: string, preview = false) => {
    window.location.hash = view === "lesson" && lesson ? `${preview ? "preview" : "lesson"}=${lesson}` : view;
    setRoute({ view, lesson, preview });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="bg-cream text-graphite">
      <main id="main" className="mx-auto min-h-[70vh] max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="mb-5 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Badge>Тестовый контур</Badge>
          <span className={muted}>Пилот «Менеджер по продажам». Только вымышленные данные, без реальных оплат.</span>
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {phase === "loading" && <p role="status">Загрузка…</p>}
        {phase === "gate" && <Gate onDone={load} />}
        {phase === "login" && <Login onDone={load} />}
        {phase === "access" && <Access paymentMode={session.paymentMode} onDone={load} />}
        {phase === "cabinet" && state && (
          <>
            <nav aria-label="Разделы кабинета" className="mb-8 overflow-x-auto">
              <ul className="flex min-w-0 flex-wrap gap-2">
                {VIEWS.map((v) => {
                  const active = route.view === v.id || (v.id === "lessons" && route.view === "lesson");
                  return (
                    <li key={v.id}>
                      <a href={`#${v.id}`} aria-current={active ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(v.id); }}
                        className={`inline-flex min-h-11 items-center rounded-md border px-4 text-[15px] font-semibold ${active ? "border-graphite bg-graphite text-cream" : "border-graphite/30 bg-white/60 hover:border-signal"}`}>
                        {v.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {state.libraryMode === "synthetic_fixture" && route.view !== "lesson" && (
              <div className="mb-6"><Notice tone="warn">Включена синтетическая тестовая библиотека для проверки интерфейса. Её уроки — заглушки, а не учебные материалы.</Notice></div>
            )}
            {route.view === "diagnostic" && (
              <>
                <h1 className="mb-5 font-display text-[clamp(28px,6vw,44px)] font-bold leading-tight">Диагностика</h1>
                <Diagnostic onSaved={() => go("map")} />
              </>
            )}
            {route.view === "map" && <TaskMapView onRetake={() => go("diagnostic")} onRoute={() => go("route")} />}
            {route.view === "route" && <RouteView fixtureMode={state.libraryMode === "synthetic_fixture"} onRetake={() => go("diagnostic")} onOpenLesson={(id) => go("lesson", id)} />}
            {route.view === "lessons" && <Lessons state={state} open={(id, preview) => go("lesson", id, preview)} />}
            {route.view === "lesson" && route.lesson && <LessonView lessonId={route.lesson} preview={!!route.preview} onBack={() => go("lessons")} />}
          </>
        )}
      </main>
    </div>
  );
}

function Form({ title, children, onSubmit }: { title: string; children: ReactNode; onSubmit: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await onSubmit(); } catch (x) { setError(x instanceof Error ? x.message : "Ошибка"); } finally { setBusy(false); }
  };
  return (
    <form className={`${card} max-w-xl space-y-4`} onSubmit={submit}>
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={busy}>{busy ? "Подождите…" : "Продолжить"}</Button>
    </form>
  );
}

function Gate({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [synthetic, setSynthetic] = useState(false);
  return (
    <Form title="Допуск тестировщика" onSubmit={async () => { await v2("tester", { accessCode: code, onlySynthetic: synthetic }); onDone(); }}>
      <label className="block font-semibold">Код доступа тестировщика
        <input type="password" required autoComplete="off" className={`${field} mt-1`} value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4" required checked={synthetic} onChange={(e) => setSynthetic(e.target.checked)} />Работаю только с синтетическими данными</label>
    </Form>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => { setEmail("demo-" + crypto.randomUUID().slice(0, 8) + "@example.invalid"); }, []);
  return challenge ? (
    <Form title="Код из письма" onSubmit={async () => { await v2("auth/verify", { challengeId: challenge, code }); onDone(); }}>
      <p className={muted}>Код отправлен в контролируемый тестовый почтовый стенд и действует 5 минут.</p>
      <label className="block font-semibold">Одноразовый код
        <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" className={`${field} mt-1`} value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
    </Form>
  ) : (
    <Form title="Вход по учебному email" onSubmit={async () => { const r = await v2<{ challengeId: string }>("auth/request", { email }); setChallenge(r.challengeId); }}>
      <label className="block font-semibold">Учебный email
        <input type="email" required autoComplete="off" className={`${field} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby="email-help" />
      </label>
      <p id="email-help" className={`text-sm ${muted}`}>Принимаются только адреса вида demo-…@example.invalid. Настоящие адреса сервер не примет.</p>
    </Form>
  );
}

function Access({ paymentMode, onDone }: { paymentMode?: string; onDone: () => void }) {
  const [adult, setAdult] = useState(false);
  const [offer, setOffer] = useState(false);
  if (paymentMode !== "fixture") {
    return <Notice>Для учебного доступа оформите тестовый заказ в <a className="underline" href="/career/sandbox">тестовом кабинете</a>, затем вернитесь сюда.</Notice>;
  }
  return (
    <Form title="Учебный доступ" onSubmit={async () => {
      const o = await v2<{ id: string }>("orders", { kind: "initial", adult, offer });
      await v2("orders/fixture-complete", { orderId: o.id });
      onDone();
    }}>
      <p className={muted}>Это тестовая операция в симуляторе: деньги не списываются, реальные продажи выключены.</p>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4" required checked={adult} onChange={(e) => setAdult(e.target.checked)} />Мне исполнилось 18 лет</label>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4" required checked={offer} onChange={(e) => setOffer(e.target.checked)} />
        <span>Я ознакомился(лась) и принимаю <a href="/offer/ai-career" target="_blank" rel="noopener noreferrer" className="underline">проект условий</a> для тестовой операции. Документы не утверждены для реальных продаж.</span>
      </label>
    </Form>
  );
}

function Lessons({ state, open }: { state: CabinetState; open: (id: string, preview: boolean) => void }) {
  const [published, setPublished] = useState<{ id: string; title: string; moduleId: string }[] | null>(null);
  const [drafts, setDrafts] = useState<{ id: string; title: string; moduleId: string }[]>([]);
  useEffect(() => {
    void v3<{ lessons: { id: string; title: string; moduleId: string }[] }>("library").then((r) => setPublished(r.lessons)).catch(() => setPublished([]));
    if (state.previewEnabled) void v3<{ lessons: { id: string; title: string; moduleId: string }[] }>("preview/lessons").then((r) => setDrafts(r.lessons)).catch(() => setDrafts([]));
  }, [state.previewEnabled]);
  return (
    <article aria-labelledby="lessons-title">
      <h1 id="lessons-title" className="font-display text-[clamp(28px,6vw,44px)] font-bold leading-tight">Уроки</h1>
      {published === null ? <p role="status">Загружаем…</p> : published.length === 0 ? (
        <div className="mt-5"><Notice>Опубликованных уроков пока нет: материалы проходят редакционную и правовую проверку.</Notice></div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {published.map((l) => (
            <li key={l.id}><button type="button" onClick={() => open(l.id, false)} className={`${card} w-full text-left hover:border-signal`}>
              <span className="block font-bold">{l.title.replace("[SYNTHETIC FIXTURE] ", "")}</span>
              {state.libraryMode === "synthetic_fixture" && <span className="mt-2 inline-block"><Badge>Тестовая заглушка</Badge></span>}
            </button></li>
          ))}
        </ul>
      )}
      {state.previewEnabled && (
        <section aria-labelledby="drafts-title" className="mt-10">
          <h2 id="drafts-title" className="text-xl font-bold">Черновики на проверке</h2>
          <p className={`mt-1 ${muted}`}>Внутренний предпросмотр для тестировщика. Эти материалы не опубликованы и не попадают в маршрут.</p>
          {drafts.length === 0 ? <p className="mt-3">Черновиков нет.</p> : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {drafts.map((l) => (
                <li key={l.id}><button type="button" onClick={() => open(l.id, true)} className={`${card} w-full text-left hover:border-signal`}>
                  <span className="block font-bold">{l.title}</span>
                  <span className="mt-2 inline-block"><Badge>Черновик на проверке</Badge></span>
                </button></li>
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
