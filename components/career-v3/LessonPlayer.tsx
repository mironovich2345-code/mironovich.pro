"use client";
// Lesson player: one screen — one thought. Theory → practice in small actions → self-check, one criterion per
// screen → mini-test → result → next step. The RESULT comes from the server: «Урок пройден / Теперь я умею» only
// when the mini-test is counted there; in a route step, completion uses the existing server rules.
// Position and choices (option ids, criterion marks) are saved on the server in order; nothing else is collected.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, Button, Notice, v3 } from "./primitives";
import type { PlayerScreen } from "@/lib/career-v3/player";

type Choices = { q: Record<string, string>; checked: string[]; c: (boolean | null)[] };
type Data = {
  lesson: { id: string; title: string; shortTitle: string; category: string; version: string };
  scriptVersion: string; exerciseId: string; screens: PlayerScreen[]; position: number; restarted: boolean; seq: number; choices: Choices;
  result: { quizPassed: boolean; quizCountedIn: "route" | "lesson"; completedAt: string | null };
  step: { position: number; stableId: string; exerciseMatches: boolean; state: string; criteriaMet: boolean[] | null; completionCriteria: string[]; completedAt: string | null } | null;
  nextStep: { position: number; lessonId: string; player: boolean } | null; inRoute: boolean;
};
type QuizReply = { passed: boolean; correct: number; total: number; countedIn: "route" | "lesson" };
const KIND_LABEL: Record<string, string> = { why: "Зачем", idea: "Главная идея", how: "Как это работает", example: "Пример", formula: "Расчёт" };
const muted = "text-[#55524D]";
const label = "m-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-signal";
const h2 = "mt-2 font-display text-[clamp(23px,6.2vw,36px)] font-bold leading-tight outline-none focus:outline-none focus-visible:outline-none";
const body = "mt-3 text-[16px] leading-[1.55] sm:mt-4 sm:text-[17px] sm:leading-relaxed";
let seqBase = 0;
type LocalState = { scriptVersion: string; exerciseId: string; screen: number; seq: number; choices: Choices };
const localKey = (id: string) => `career-player:${id}`;
function readLocal(id: string): LocalState | null {
  try { const v = JSON.parse(sessionStorage.getItem(localKey(id)) ?? "null"); return v && typeof v.seq === "number" && typeof v.screen === "number" ? v : null; } catch { return null; }
}
function writeLocal(id: string, v: LocalState) { try { sessionStorage.setItem(localKey(id), JSON.stringify(v)); } catch { /* storage unavailable: server only */ } }
const nextSeq = () => (seqBase = Math.max(seqBase + 1, Date.now() * 1000));

export default function LessonPlayer({ lessonId, step, onExit, onMaterials, onOpenLesson, onBackToStep, onPlayStep }: {
  lessonId: string; step?: number; onExit: () => void; onMaterials: () => void; onOpenLesson: (id: string) => void;
  onBackToStep: (n: number) => void; onPlayStep: (lessonId: string, step: number) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [choices, setChoices] = useState<Choices>({ q: {}, checked: [], c: [] });
  const [quizReply, setQuizReply] = useState<QuizReply | null>(null);
  const [selfSaved, setSelfSaved] = useState<string | null>(null);
  const [completion, setCompletion] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const pending = useRef<Record<string, unknown> | null>(null);
  const inflight = useRef(false);

  const load = useCallback(async (keepScreen?: number) => {
    const d = await v3<Data>(`player/lessons/${lessonId}${step ? `?step=${step}` : ""}`);
    seqBase = Math.max(seqBase, d.seq);
    // A reload can overtake the last save in flight: a newer local copy of this tab's own state wins and is
    // re-sent to the server, which stays the source of truth (same lesson, script and exercise only).
    let screen = keepScreen ?? d.position, ch = d.choices;
    if (keepScreen === undefined) {
      const local = readLocal(lessonId);
      if (local && local.seq > d.seq && local.scriptVersion === d.scriptVersion && local.exerciseId === d.exerciseId && local.screen < d.screens.length) {
        screen = local.screen; ch = local.choices;
        seqBase = Math.max(seqBase, local.seq);
        void v3(`player/lessons/${lessonId}/position`, { ...local, seq: nextSeq() }).catch(() => undefined);
      }
    }
    setData(d);
    setChoices(ch);
    setCompletion(d.step ? d.step.completionCriteria.map(() => false) : []);
    setI(screen);
    return d;
  }, [lessonId, step]);

  useEffect(() => { load().catch((e) => setError(e instanceof ApiError ? e.message : "Урок не загрузился")); }, [load]);

  // Ordered saving: one request at a time, the latest state wins; flushed with keepalive when the page is hidden.
  const flush = useCallback(async () => {
    if (inflight.current || !pending.current) return;
    inflight.current = true;
    const payload = pending.current; pending.current = null;
    try { await v3(`player/lessons/${lessonId}/position`, payload); } catch { /* the next save retries the latest state */ }
    inflight.current = false;
    if (pending.current) void flush();
  }, [lessonId]);
  const save = useCallback((screen: number, ch: Choices) => {
    if (!data) return;
    pending.current = { scriptVersion: data.scriptVersion, exerciseId: data.exerciseId, screen, seq: nextSeq(), choices: ch };
    writeLocal(lessonId, pending.current as LocalState);
    void flush();
  }, [data, flush, lessonId]);
  useEffect(() => {
    const onHide = () => {
      if (!pending.current) return;
      void fetch(`/api/career/v3/sales_manager/player/lessons/${lessonId}/position`, {
        method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending.current),
      }).catch(() => undefined);
      pending.current = null;
    };
    window.addEventListener("pagehide", onHide);
    // Keyboard focus: a focused control is scrolled above the sticky navigation, never left underneath it.
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      const nav = document.querySelector('nav[aria-label="Навигация по уроку"]');
      if (!t || !nav || !t.closest("[data-player-screen]")) return;
      const r = t.getBoundingClientRect(), n = nav.getBoundingClientRect();
      if (r.bottom > n.top - 8) window.scrollBy({ top: r.bottom - n.top + 16, behavior: "instant" });
      else if (r.top < 0) window.scrollBy({ top: r.top - 16, behavior: "instant" });
    };
    document.addEventListener("focusin", onFocus);
    const prev = document.documentElement.style.scrollPaddingBottom;
    document.documentElement.style.scrollPaddingBottom = "96px"; // focused controls are never hidden under the navigation
    return () => { window.removeEventListener("pagehide", onHide); document.removeEventListener("focusin", onFocus); document.documentElement.style.scrollPaddingBottom = prev; };
  }, [lessonId]);

  useEffect(() => {
    if (!data) return;
    if (first.current) { first.current = false; return; }
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [i, data]);

  if (error) return <div className="py-6"><Notice tone="error">{error}</Notice><div className="mt-4"><Button variant="secondary" onClick={onExit}>К урокам</Button></div></div>;
  if (!data) return <p role="status" className="py-6">Открываем урок…</p>;

  const screens = data.screens;
  const s = screens[i];
  const total = screens.length;
  const quizScreens = screens.filter((x): x is Extract<PlayerScreen, { type: "quiz" }> => x.type === "quiz");
  const task = screens.find((x): x is Extract<PlayerScreen, { type: "task" }> => x.type === "task");
  const firstQuiz = screens.findIndex((x) => x.type === "quiz");
  const firstCriterion = screens.findIndex((x) => x.type === "criterion");
  const resultIndex = total - 1;

  const update = (ch: Choices, screen = i) => { setChoices(ch); save(screen, ch); };
  const go = async (n: number) => {
    const k = Math.max(0, Math.min(total - 1, n));
    // Leaving the self-check in a route step: the marks go into that step (existing server rules decide the state).
    if (s.type === "criterion" && screens[k]?.type === "summary" && data.step?.exerciseMatches && data.step.state !== "done") {
      const marks = (screens.filter((x) => x.type === "criterion") as Extract<PlayerScreen, { type: "criterion" }>[]).map((_, j) => choices.c[j] === true);
      try {
        await v3(`progress/steps/${data.step.position}/self-check`, { stableId: data.step.stableId, criteriaMet: marks });
        setSelfSaved(`Отметки сохранены в шаге ${data.step.position}.`);
      } catch (e) { setSelfSaved(e instanceof ApiError ? e.message : "Не удалось сохранить отметки в шаг"); }
    }
    setNote(null);
    setI(k);
    save(k, choices);
    if (k === resultIndex) { try { await load(k); } catch { /* keep the local view */ } }
  };

  const checkQuiz = async () => {
    if (s.type !== "quiz" || !choices.q[s.id]) return;
    const ch = { ...choices, checked: [...new Set([...choices.checked, s.id])] };
    update(ch);
    if (s.index === s.of - 1) {
      const answers = Object.fromEntries(quizScreens.map((q) => [q.id, ch.q[q.id]]));
      if (quizScreens.some((q) => !answers[q.id])) { setNote("Ответьте на все вопросы теста."); return; }
      try {
        const r = await v3<QuizReply>(`player/lessons/${lessonId}/quiz`, { answers, exerciseId: data.exerciseId });
        await load(i).catch(() => undefined); // refresh the server result first, then show the message
        setQuizReply(r);
      } catch (e) { setNote(e instanceof ApiError ? e.message : "Не удалось проверить тест на сервере"); }
    }
  };
  const retryQuiz = () => {
    const ch = { ...choices, q: {}, checked: [] };
    setQuizReply(null);
    update(ch, firstQuiz);
    setI(firstQuiz);
  };
  const completeStep = async () => {
    if (!data.step) return;
    setBusy(true); setNote(null);
    try {
      await v3(`progress/steps/${data.step.position}/complete`, { stableId: data.step.stableId, completionMet: completion });
      await load(i);
    } catch (e) { setNote(e instanceof ApiError ? e.message : "Не удалось завершить шаг"); }
    finally { setBusy(false); }
  };

  const answered = s.type === "quiz" && choices.checked.includes(s.id);
  const nextDisabled = (s.type === "criterion" && typeof choices.c[s.index] !== "boolean") || (s.type === "quiz" && !answered);

  return (
    <section aria-labelledby="player-title" className="flex min-h-[calc(100dvh-100px)] flex-col">
      <header className="border-b border-graphite/15 pb-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.12em] text-signal">{data.lesson.category}</p>
            <h1 id="player-title" className="m-0 mt-0.5 text-[16px] font-bold leading-snug">{data.lesson.shortTitle}</h1>
          </div>
          <button type="button" onClick={onExit} className="-mt-1 inline-flex min-h-11 shrink-0 items-center px-1 text-[14px] font-semibold underline decoration-graphite/40 underline-offset-4">Выйти</button>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div role="progressbar" aria-label="Прогресс урока" aria-valuemin={1} aria-valuemax={total} aria-valuenow={i + 1} className="h-1.5 flex-1 overflow-hidden rounded-full bg-graphite/15">
            <div className="h-full rounded-full bg-signal transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((i + 1) / total) * 100}%` }} />
          </div>
          <p aria-live="polite" className={`m-0 shrink-0 text-[13px] font-semibold ${muted}`}>Экран {i + 1} из {total}</p>
        </div>
      </header>

      {data.restarted && <div className="mt-4"><Notice>Урок обновился с прошлого раза. Мы вернули вас к самопроверке — пройденная теория и практика сохранены, отметки в маршруте тоже.</Notice></div>}

      <div key={i} data-player-screen className="flex-1 pb-4 pt-4 motion-safe:animate-[playerIn_200ms_ease-out]">
        {s.type === "text" && (
          <>
            <p className={label}>{KIND_LABEL[s.kind]}</p>
            <h2 ref={heading} tabIndex={-1} className={h2}>{s.title}</h2>
            {s.quote && <blockquote className="mt-4 border-l-4 border-graphite/30 bg-white/70 px-4 py-3 text-[16px] leading-relaxed">{s.quote}</blockquote>}
            {s.formula && <div className="mt-4 space-y-1 rounded-md border border-graphite/20 bg-white px-4 py-3 font-mono text-[15px] leading-relaxed">{s.formula.map((f) => <p key={f} className="m-0">{f}</p>)}</div>}
            {s.text?.map((t) => <p key={t} className={body}>{t}</p>)}
            {s.list && <ul className="mt-3 space-y-1.5 pl-5 text-[16px] leading-[1.5] [list-style:disc] sm:mt-4 sm:space-y-2 sm:text-[17px] sm:leading-relaxed">{s.list.map((t) => <li key={t}>{t}</li>)}</ul>}
            {(s.bad || s.good) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {s.bad && <div className="rounded-md border border-signal/60 bg-white/70 p-4"><p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-signal">Так не надо</p><p className="m-0 mt-1 text-[16px] leading-relaxed">{s.bad}</p></div>}
                {s.good && <div className="rounded-md border border-graphite/40 bg-white p-4"><p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em]">Так правильно</p><p className="m-0 mt-1 text-[16px] leading-relaxed">{s.good}</p></div>}
              </div>
            )}
          </>
        )}

        {s.type === "task" && (
          <>
            <p className={label}>Практика</p>
            <h2 ref={heading} tabIndex={-1} className={h2}>{s.title}</h2>
            {s.text.map((t) => <p key={t} className={body}>{t}</p>)}
            <SourceData label={s.inputLabel} input={s.input} />
            <p className={`mt-4 text-[15px] leading-relaxed ${muted}`}><strong className="text-graphite">Что должно получиться:</strong> {s.artifact}</p>
          </>
        )}

        {s.type === "action" && (
          <>
            <p className={label}>Практика · действие {s.step} из {s.of}</p>
            <h2 ref={heading} tabIndex={-1} className={h2}>{s.title}</h2>
            {s.text.map((t) => <p key={t} className={body}>{t}</p>)}
            {task && <SourceData label="Исходные данные задания" input={task.input} />}
          </>
        )}

        {s.type === "criterion" && (
          <>
            <p className={label}>Самопроверка · критерий {s.index + 1} из {s.of}</p>
            <h2 ref={heading} tabIndex={-1} className={h2}>Получилось?</h2>
            {s.intro.map((t) => <p key={t} className={`mt-2 text-[15px] leading-relaxed ${muted}`}>{t}</p>)}
            <p className="mt-4 rounded-md border border-graphite/20 bg-white px-4 py-3 text-[16px] leading-relaxed sm:text-[17px]">{s.text}</p>
            <fieldset className="mt-4">
              <legend className="sr-only">Отметка по критерию {s.index + 1}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[[true, "Да, получилось"], [false, "Пока нет"]].map(([v, t]) => (
                  <label key={String(v)} className={`flex min-h-12 items-center gap-3 rounded-md border px-3 text-[16px] ${choices.c[s.index] === v ? "border-graphite bg-white" : "border-graphite/20 bg-white/70"}`}>
                    <input type="radio" name={`crit-${s.index}`} className="h-5 w-5 shrink-0 accent-[#0E0E11]" checked={choices.c[s.index] === v}
                      onChange={() => { const c = [...choices.c]; while (c.length < s.of) c.push(null); c[s.index] = v as boolean; update({ ...choices, c }); }} />
                    <span>{t as string}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {task && <SourceData label="Исходные данные задания" input={task.input} />}
          </>
        )}

        {s.type === "summary" && (() => {
          const yes = s.criteria.filter((_, k) => choices.c[k] === true).length;
          return (
            <>
              <p className={label}>Разбор результата</p>
              <h2 ref={heading} tabIndex={-1} className={h2}>{s.title}</h2>
              <p className={body}>Получилось {yes} из {s.criteria.length} критериев.</p>
              {yes < s.criteria.length && <p className={`mt-2 text-[15px] leading-relaxed ${muted}`}>Посмотрите образец разбора ниже, доработайте и отметьте критерии снова. В маршруте шаг засчитывается, когда выполнены все критерии и пройден мини-тест.</p>}
              {selfSaved && <p role="status" className="mt-2 text-[15px] font-semibold">{selfSaved}</p>}
              <details className="mt-4 rounded-md border border-graphite/20 bg-white/70 p-3">
                <summary className="cursor-pointer text-[15px] font-semibold">Показать образец разбора</summary>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{s.sample}</p>
                <p className={`mt-3 text-[14px] leading-relaxed ${muted}`}><strong className="text-graphite">Если что-то не сошлось:</strong> {s.feedback}</p>
              </details>
              {yes < s.criteria.length && <div className="mt-4"><Button variant="secondary" onClick={() => void go(firstCriterion)}>Отметить критерии заново</Button></div>}
            </>
          );
        })()}

        {s.type === "quiz" && (
          <>
            <p className={label}>Мини-тест · вопрос {s.index + 1} из {s.of}</p>
            <h2 ref={heading} tabIndex={-1} className="mt-2 text-[clamp(18px,4.8vw,26px)] font-bold leading-snug outline-none focus:outline-none">{s.question}</h2>
            {data.result.quizPassed && answered && <p className={`mt-1 text-[14px] font-semibold ${muted}`}>Тест уже засчитан — можно идти дальше.</p>}
            <fieldset className="mt-3" disabled={answered}>
              <legend className="sr-only">Варианты ответа</legend>
              <div className="space-y-1.5 sm:space-y-2">
                {s.options.map((o) => {
                  const picked = choices.q[s.id] === o.id;
                  const state = answered ? (o.id === s.correctId ? "border-graphite bg-white" : picked ? "border-signal bg-white" : "border-graphite/15 bg-white/60") : picked ? "border-graphite bg-white" : "border-graphite/15 bg-white/70";
                  return (
                    <label key={o.id} className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-[15px] leading-[1.45] sm:text-[16px] sm:leading-relaxed ${state}`}>
                      <input type="radio" name={`player-${s.id}`} className="mt-0.5 h-5 w-5 shrink-0 accent-[#0E0E11]" checked={picked} onChange={() => update({ ...choices, q: { ...choices.q, [s.id]: o.id } })} />
                      <span>{o.text}{answered && o.id === s.correctId && <strong className="ml-1">— верный ответ</strong>}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {s.options.some((o) => o.full) && (
              <details className="mt-2 text-[14px]">
                <summary className={`cursor-pointer underline underline-offset-4 ${muted}`}>Полная формулировка вариантов</summary>
                <ul className="mt-2 space-y-1 pl-4 [list-style:disc]">{s.options.map((o) => <li key={o.id}>{o.full ?? o.text}</li>)}</ul>
              </details>
            )}
            {answered && (
              <div className="mt-3" role="status">
                <p className="m-0 text-[16px] font-bold">{choices.q[s.id] === s.correctId ? "Верно." : "Не совсем."}</p>
                <p className="mt-1 text-[15px] leading-relaxed">{s.reason}</p>
              </div>
            )}
            {s.index === s.of - 1 && quizReply && (
              <div className="mt-4">
                <Notice tone={quizReply.passed ? "info" : "warn"}>
                  {quizReply.passed ? `Мини-тест засчитан${quizReply.countedIn === "route" ? " в маршруте" : ""}: ${quizReply.correct} из ${quizReply.total}.`
                    : `Верно ${quizReply.correct} из ${quizReply.total}. Тест засчитывается при всех верных ответах — попробуйте ещё раз.`}
                </Notice>
                {!quizReply.passed && <div className="mt-3"><Button variant="secondary" onClick={retryQuiz}>Пройти тест ещё раз</Button></div>}
              </div>
            )}
          </>
        )}

        {s.type === "result" && <Result s={s} data={data} heading={heading} completion={completion} setCompletion={setCompletion} busy={busy}
          onComplete={() => void completeStep()} onRetryQuiz={retryQuiz} onCriteria={() => void go(firstCriterion)} onExit={onExit}
          onOpenLesson={onOpenLesson} onBackToStep={onBackToStep} onPlayStep={onPlayStep} />}

        {note && <div className="mt-4"><Notice tone="warn">{note}</Notice></div>}
      </div>

      <nav aria-label="Навигация по уроку" className="sticky bottom-0 -mx-4 mt-auto border-t border-graphite/15 bg-cream/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" disabled={i === 0} onClick={() => void go(i - 1)}>Назад</Button>
          <button type="button" onClick={onMaterials} className="inline-flex min-h-11 items-center px-2 text-[14px] font-semibold underline decoration-graphite/40 underline-offset-4">Материалы</button>
          {s.type === "quiz" && !answered ? (
            <Button disabled={!choices.q[s.id]} onClick={() => void checkQuiz()}>Проверить</Button>
          ) : s.type === "quiz" && s.index === s.of - 1 && !data.result.quizPassed && !quizReply?.passed ? (
            <Button disabled>Далее</Button>
          ) : i < total - 1 ? (
            <Button disabled={nextDisabled} onClick={() => void go(i + 1)}>Далее</Button>
          ) : (
            <Button variant="secondary" onClick={data.step ? () => onBackToStep(data.step!.position) : onExit}>{data.step ? "К шагу" : "К урокам"}</Button>
          )}
        </div>
      </nav>
    </section>
  );
}

function Result({ s, data, heading, completion, setCompletion, busy, onComplete, onRetryQuiz, onCriteria, onExit, onOpenLesson, onBackToStep, onPlayStep }: {
  s: Extract<PlayerScreen, { type: "result" }>; data: Data; heading: React.RefObject<HTMLHeadingElement | null>; completion: boolean[]; setCompletion: (v: boolean[]) => void; busy: boolean;
  onComplete: () => void; onRetryQuiz: () => void; onCriteria: () => void; onExit: () => void; onOpenLesson: (id: string) => void; onBackToStep: (n: number) => void; onPlayStep: (lessonId: string, step: number) => void;
}) {
  const st = data.step;
  const nextBtn = data.nextStep && (st?.state === "done") && (
    <Button onClick={() => (data.nextStep!.player ? onPlayStep(data.nextStep!.lessonId, data.nextStep!.position) : onBackToStep(data.nextStep!.position))}>Следующий шаг: {data.nextStep.position}</Button>
  );
  if (!data.result.quizPassed) {
    return (
      <>
        <p className={label}>Результат</p>
        <h2 ref={heading} tabIndex={-1} className={h2}>Урок ещё не завершён</h2>
        <p className={body}>Мини-тест не засчитан: для этого нужны все верные ответы. Попытки не ограничены.</p>
        <div className="mt-4 flex flex-wrap gap-3"><Button onClick={onRetryQuiz}>Пройти мини-тест</Button></div>
      </>
    );
  }
  return (
    <>
      <p className={label}>Урок пройден</p>
      <h2 ref={heading} tabIndex={-1} className={h2}>Теперь я умею</h2>
      <p className="mt-3 text-[17px] font-semibold leading-relaxed sm:text-[18px]">{s.skill.title}</p>
      <dl className="mt-4 space-y-3 text-[16px] leading-relaxed">
        <div><dt className="font-bold">Где пригодится</dt><dd className="m-0">{s.skill.applyAt}</dd></div>
        <div><dt className="font-bold">Чем это полезно работодателю</dt><dd className="m-0">{s.skill.employerValue}</dd></div>
        {s.nextLesson && <div><dt className="font-bold">Следующий навык</dt><dd className="m-0">{s.nextLesson.title}</dd></div>}
      </dl>
      <p className={`mt-4 text-[14px] leading-relaxed ${muted}`}>Мини-тест проверен на сервере. Отметки практики — ваша самопроверка. Это учебные результаты, а не подтверждение навыка работодателем.</p>

      {st && (
        <div className="mt-5 rounded-md border border-graphite/20 bg-white/70 p-4">
          <p className="m-0 text-[15px] font-bold">Шаг {st.position} маршрута</p>
          {st.state === "done" ? (
            <p role="status" className="m-0 mt-1 text-[15px]">Шаг засчитан ✓</p>
          ) : st.state === "self_checked" ? (
            <fieldset className="mt-2">
              <legend className="text-[15px]">Подтвердите критерии выполнения шага:</legend>
              <div className="mt-2 space-y-2">
                {st.completionCriteria.map((c, k) => (
                  <label key={c} className="flex items-start gap-3 text-[15px] leading-snug">
                    <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#0E0E11]" checked={!!completion[k]} onChange={() => setCompletion(completion.map((v, j) => (j === k ? !v : v)))} />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3"><Button disabled={busy || !completion.every(Boolean)} onClick={onComplete}>Завершить шаг</Button></div>
            </fieldset>
          ) : (
            <>
              <p className="m-0 mt-1 text-[15px] leading-relaxed">Чтобы засчитать шаг, нужны все отмеченные критерии самопроверки{st.exerciseMatches ? "" : " по заданию этого шага (на странице шага)"}.</p>
              <div className="mt-3">{st.exerciseMatches ? <Button variant="secondary" onClick={onCriteria}>К самопроверке</Button> : <Button variant="secondary" onClick={() => onBackToStep(st.position)}>На страницу шага</Button>}</div>
            </>
          )}
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {nextBtn}
        {!st && s.nextLesson && <Button onClick={() => onOpenLesson(s.nextLesson!.id)}>Следующий урок</Button>}
        {!st && <Button variant="secondary" onClick={onExit}>К урокам</Button>}
      </div>
    </>
  );
}

function SourceData({ label: text, input }: { label: string; input: string }) {
  return (
    <details className="mt-4 rounded-md border border-graphite/25 bg-white/80 p-3">
      <summary className="cursor-pointer text-[15px] font-semibold">{text}</summary>
      <div className="mt-2 max-h-[40vh] overflow-auto pr-1 text-[15px] leading-relaxed" tabIndex={0} role="region" aria-label={text}>{input}</div>
    </details>
  );
}
