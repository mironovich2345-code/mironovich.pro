"use client";
// AI Career 3.0 cabinet (pilot: sales manager). Synthetic sandbox only. Tester admission, sign-in and
// the test order reuse the existing v2 endpoints unchanged; everything else talks to the v3 engine.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Diagnostic from "./Diagnostic";
import TaskMapView from "./TaskMapView";
import RouteView from "./RouteView";
import LessonView from "./LessonView";
import StepView from "./StepView";
import ResultsView from "./ResultsView";
import LessonPlayer from "./LessonPlayer";
import LessonMaterials from "./LessonMaterials";
import { ApiError, Badge, Button, Notice, card, field, muted, v2, v3 } from "./primitives";

type Session = { authenticated?: boolean; active?: boolean; paymentMode?: string; account?: { email: string; access_until: string | null } };
type CabinetState = { libraryMode: "content" | "synthetic_fixture" | "demo_review_preview"; previewEnabled: boolean; publishedLessons: number };
/** Closed cloud demo: the demo shell (components/career-demo) owns sign-in, sign-out and the account screen. */
export type DemoHooks = { onLogout: () => Promise<void>; onSessionLost: () => void; account: ReactNode };
type View = "diagnostic" | "map" | "route" | "results" | "lessons" | "lesson" | "step" | "account" | "play" | "materials";
type Category = { id: string; title: string; status: "ready" | "future"; lessons: { id: string; title: string; player: boolean }[] };
const VIEWS: { id: Exclude<View, "lesson" | "step" | "account" | "play" | "materials">; label: string }[] = [
  { id: "diagnostic", label: "Диагностика" }, { id: "map", label: "Моя карта" }, { id: "route", label: "Мой маршрут" }, { id: "results", label: "Мои результаты" }, { id: "lessons", label: "Уроки" },
];

type Route = { view: View; lesson?: string; preview?: boolean; step?: number; implicit?: boolean };
const playHash = (lesson: string, step?: number, view = "play") => `${view}=${lesson}${step ? `&step=${step}` : ""}`;
function readHash(): Route {
  if (typeof window === "undefined") return { view: "diagnostic", implicit: true };
  const h = window.location.hash.slice(1);
  const m = /^(lesson|preview)=([A-Z0-9-]+)$/.exec(h);
  if (m) return { view: "lesson", lesson: m[2], preview: m[1] === "preview" };
  const pl = /^(play|materials)=([A-Z]{2,5}-[0-9]{2,3})(?:&step=([0-9]{1,2}))?$/.exec(h);
  if (pl) return { view: pl[1] as View, lesson: pl[2], step: pl[3] ? Number(pl[3]) : undefined };
  const st = /^step=([0-9]{1,2})$/.exec(h);
  if (st && Number(st[1]) >= 1 && Number(st[1]) <= 30) return { view: "step", step: Number(st[1]) };
  if (VIEWS.some((v) => v.id === h) || h === "account") return { view: h as View };
  return { view: "diagnostic", implicit: true };
}

export default function CareerV3App({ demo }: { demo?: DemoHooks } = {}) {
  const [phase, setPhase] = useState<"loading" | "gate" | "login" | "access" | "cabinet">("loading");
  const [session, setSession] = useState<Session>({});
  const [state, setState] = useState<CabinetState | null>(null);
  const [route, setRoute] = useState<Route>(readHash());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (demo) {
        setState(await v3<CabinetState>("state"));
        if (readHash().implicit) {
          const p = await v3<{ plan: unknown }>("progress").catch(() => ({ plan: null }));
          if (p.plan) { window.location.hash = "route"; setRoute({ view: "route" }); }
        }
        setPhase("cabinet");
        return;
      }
      const s = await v2<Session>("session");
      setSession(s);
      // v2 returns { authenticated: false } without a session and the dashboard (with account) with one.
      if (!s.account) { setPhase("login"); return; }
      if (!s.active) { setPhase("access"); return; }
      setState(await v3<CabinetState>("state"));
      // Coming back without a specific address: resume the saved route instead of the questionnaire.
      if (readHash().implicit) {
        const p = await v3<{ plan: unknown }>("progress").catch(() => ({ plan: null }));
        if (p.plan) { window.location.hash = "route"; setRoute({ view: "route" }); }
      }
      setPhase("cabinet");
    } catch (e) {
      if (demo && e instanceof ApiError && e.status === 401) demo.onSessionLost();
      else if (!demo && e instanceof ApiError && e.status === 403) setPhase("gate");
      else setError(e instanceof Error ? e.message : "Тестовый контур недоступен");
    }
  }, [demo]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const [catalogue, setCatalogue] = useState<Category[] | null>(null);
  useEffect(() => {
    if (phase === "cabinet") void v3<{ categories: Category[] }>("catalogue").then((r) => setCatalogue(r.categories)).catch(() => setCatalogue([]));
  }, [phase]);
  const hasPlayer = (id: string) => !!catalogue?.some((c) => c.lessons.some((l) => l.id === id && l.player));
  const go = (view: View, lesson?: string, preview = false, step?: number) => {
    window.location.hash = (view === "play" || view === "materials") && lesson ? playHash(lesson, step, view) : view === "lesson" && lesson ? `${preview ? "preview" : "lesson"}=${lesson}` : view === "step" && step ? `step=${step}` : view;
    setRoute({ view, lesson, preview, step });
    window.scrollTo({ top: 0 });
  };
  const logout = async () => {
    if (demo) { window.location.hash = ""; await demo.onLogout(); return; }
    await v2("auth/logout", {}).catch(() => undefined);
    window.location.hash = "";
    setRoute({ view: "diagnostic", implicit: true });
    setState(null);
    await load();
  };

  return (
    // The site root uses color-scheme: dark; the cream cabinet needs light native controls, otherwise an
    // unchecked checkbox renders as a dark filled square that looks almost checked.
    <div className="bg-cream text-graphite [color-scheme:light]">
      <main id="main" className={`mx-auto min-h-[70vh] max-w-4xl px-4 sm:px-6 ${route.view === "play" ? "pb-0 pt-2 sm:pt-6" : "py-8 sm:py-12"}`}>
        {!demo && (
          <p className="mb-5 flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Badge>Тестовый контур</Badge>
            <span className={muted}>Пилот «Менеджер по продажам». Только вымышленные данные, без реальных оплат.</span>
          </p>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {phase === "loading" && <p role="status">Загрузка…</p>}
        {phase === "gate" && <Gate onDone={load} />}
        {phase === "login" && <Login onDone={load} />}
        {phase === "access" && <Access paymentMode={session.paymentMode} onDone={load} />}
        {phase === "cabinet" && state && (
          <>
            {route.view !== "play" && <nav aria-label="Разделы кабинета" className="mb-8 overflow-x-auto">
              <ul className="flex min-w-0 flex-wrap gap-2">
                {VIEWS.map((v) => {
                  const active = route.view === v.id || (v.id === "lessons" && route.view === "lesson") || (v.id === "route" && route.view === "step");
                  return (
                    <li key={v.id}>
                      <a href={`#${v.id}`} aria-current={active ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(v.id); }}
                        className={`inline-flex min-h-11 items-center rounded-md border px-4 text-[15px] font-semibold ${active ? "border-graphite bg-graphite text-cream" : "border-graphite/30 bg-white/60 hover:border-signal"}`}>
                        {v.label}
                      </a>
                    </li>
                  );
                })}
                {demo && (
                  <li>
                    <a href="#account" aria-current={route.view === "account" ? "page" : undefined} onClick={(e) => { e.preventDefault(); go("account"); }}
                      className={`inline-flex min-h-11 items-center rounded-md border px-4 text-[15px] font-semibold ${route.view === "account" ? "border-graphite bg-graphite text-cream" : "border-graphite/30 bg-white/60 hover:border-signal"}`}>
                      Аккаунт
                    </a>
                  </li>
                )}
                <li className="sm:ml-auto">
                  <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center rounded-md border border-graphite/30 bg-white/60 px-4 text-[15px] font-semibold hover:border-signal">Выйти</button>
                </li>
              </ul>
            </nav>}
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
            {route.view === "route" && <RouteView fixtureMode={state.libraryMode === "synthetic_fixture"} onRetake={() => go("diagnostic")} onOpenLesson={(id) => go("lesson", id)} onOpenStep={(n) => go("step", undefined, false, n)} />}
            {route.view === "results" && <ResultsView onRoute={() => go("route")} />}
            {route.view === "step" && route.step && <StepView key={route.step} position={route.step} onBack={() => go("route")} onOpenLesson={(id) => go("lesson", id)} onOpenStep={(n) => go("step", undefined, false, n)} hasPlayer={hasPlayer} onPlay={(id, n) => go("play", id, false, n)} />}
            {route.view === "lessons" && <Lessons state={state} catalogue={catalogue} open={(id, preview) => go(!preview && hasPlayer(id) ? "play" : "lesson", id, preview)} />}
            {route.view === "play" && route.lesson && (
              <LessonPlayer key={`${route.lesson}-${route.step ?? ""}`} lessonId={route.lesson} step={route.step}
                onExit={() => (route.step ? go("step", undefined, false, route.step) : go("lessons"))}
                onMaterials={() => go("materials", route.lesson, false, route.step)} onOpenLesson={(id) => go(hasPlayer(id) ? "play" : "lesson", id)}
                onBackToStep={(n) => go("step", undefined, false, n)} onPlayStep={(id, n) => go("play", id, false, n)} />
            )}
            {route.view === "materials" && route.lesson && (
              <LessonMaterials key={route.lesson} lessonId={route.lesson}
                onBack={() => (hasPlayer(route.lesson!) ? go("play", route.lesson, false, route.step) : go("lesson", route.lesson))}
                onFullLesson={() => go("lesson", route.lesson)} />
            )}
            {route.view === "account" && demo && demo.account}
            {route.view === "lesson" && route.lesson && (
              <>
                {!route.preview && hasPlayer(route.lesson) && <div className="mb-5"><Button onClick={() => go("play", route.lesson)}>Пройти урок короткими экранами</Button></div>}
                <LessonView lessonId={route.lesson} preview={!!route.preview} onBack={() => go("lessons")} />
              </>
            )}
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

function Lessons({ state, catalogue, open }: { state: CabinetState; catalogue: Category[] | null; open: (id: string, preview: boolean) => void }) {
  const [drafts, setDrafts] = useState<{ id: string; title: string; moduleId: string }[]>([]);
  useEffect(() => {
    if (state.previewEnabled) void v3<{ lessons: { id: string; title: string; moduleId: string }[] }>("preview/lessons").then((r) => setDrafts(r.lessons)).catch(() => setDrafts([]));
  }, [state.previewEnabled]);
  const ready = catalogue?.filter((c) => c.status === "ready") ?? [];
  const future = catalogue?.filter((c) => c.status === "future") ?? [];
  return (
    <article aria-labelledby="lessons-title">
      <h1 id="lessons-title" className="font-display text-[clamp(28px,6vw,44px)] font-bold leading-tight">Уроки</h1>
      {catalogue === null ? <p role="status">Загружаем…</p> : ready.length === 0 ? (
        <div className="mt-5"><Notice>Опубликованных уроков пока нет: материалы проходят редакционную и правовую проверку.</Notice></div>
      ) : (
        <>
          {ready.map((c) => (
            <section key={c.id} aria-labelledby={`cat-${c.id}`} className="mt-8">
              <h2 id={`cat-${c.id}`} className="text-xl font-bold">{c.title}</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {c.lessons.map((l) => (
                  <li key={l.id}><button type="button" onClick={() => open(l.id, false)} className={`${card} w-full text-left hover:border-signal`}>
                    <span className="block font-bold">{l.title.replace("[SYNTHETIC FIXTURE] ", "")}</span>
                    <span className={`mt-2 block text-[14px] ${muted}`}>{l.player ? "Короткие экраны · практика · мини-тест" : "Полный текст урока"}</span>
                    {state.libraryMode === "synthetic_fixture" && <span className="mt-2 inline-block"><Badge>Тестовая заглушка</Badge></span>}
                    {state.libraryMode === "demo_review_preview" && <span className="mt-2 inline-block"><Badge>На проверке</Badge></span>}
                  </button></li>
                ))}
              </ul>
            </section>
          ))}
          {future.length > 0 && (
            <section aria-labelledby="cat-future" className="mt-10">
              <h2 id="cat-future" className="text-xl font-bold">Готовятся</h2>
              <p className={`mt-1 ${muted}`}>Уроков в этих разделах пока нет — они появятся позже.</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {future.map((c) => <li key={c.id} className="rounded-md border border-dashed border-graphite/30 px-3 py-2 text-[15px]">{c.title}</li>)}
              </ul>
            </section>
          )}
        </>
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
