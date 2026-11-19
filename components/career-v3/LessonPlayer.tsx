"use client";
// Lesson player: one screen — one thought. Theory → practice in small actions → self-check against the lesson's
// own criteria → mini-test (graded on the server when the lesson is in the route) → «Теперь я умею…».
// The current screen is saved on the server and restored after sign-in. A screen is not a route step.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, Button, Notice, v3 } from "./primitives";
import type { PlayerScreen } from "@/lib/career-v3/player";

type Data = {
  lesson: { id: string; title: string; shortTitle: string; category: string; version: string };
  scriptVersion: string; exerciseId: string; screens: PlayerScreen[]; position: number; restarted: boolean; completedAt: string | null;
  step: { position: number; stableId: string; exerciseMatches: boolean } | null; inRoute: boolean; quizPassed: boolean;
};
const KIND_LABEL: Record<string, string> = { why: "Зачем", idea: "Главная идея", how: "Как это работает", example: "Пример", formula: "Расчёт" };
const muted = "text-[#55524D]";

export default function LessonPlayer({ lessonId, step, onExit, onMaterials, onOpenLesson, onBackToStep }: {
  lessonId: string; step?: number; onExit: () => void; onMaterials: () => void; onOpenLesson: (id: string) => void; onBackToStep: (n: number) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [criteria, setCriteria] = useState<boolean[]>([]);
  const [selfSaved, setSelfSaved] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    v3<Data>(`player/lessons/${lessonId}${step ? `?step=${step}` : ""}`)
      .then((d) => {
        setData(d);
        setI(d.position);
        const review = d.screens.find((s) => s.type === "review");
        setCriteria(review && review.type === "review" ? review.criteria.map(() => false) : []);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Урок не загрузился"));
  }, [lessonId, step]);

  const save = useCallback((screen: number) => {
    if (!data) return;
    void v3(`player/lessons/${lessonId}/position`, { scriptVersion: data.scriptVersion, exerciseId: data.exerciseId, screen }).catch(() => undefined);
  }, [data, lessonId]);

  useEffect(() => {
    if (!data) return;
    if (first.current) { first.current = false; return; }
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [i, data]);

  if (error) return <div className="py-6"><Notice tone="error">{error}</Notice><div className="mt-4"><Button variant="secondary" onClick={onExit}>К урокам</Button></div></div>;
  if (!data) return <p role="status" className="py-6">Открываем урок…</p>;

  const screens = data.screens;
  const s = screens[i];
  const total = screens.length;
  const go = (n: number) => { const k = Math.max(0, Math.min(total - 1, n)); setI(k); save(k); };
  const quizScreens = screens.filter((x): x is Extract<PlayerScreen, { type: "quiz" }> => x.type === "quiz");
  const needCheck = s.type === "quiz" && !checked[s.id];
  const task = screens.find((x): x is Extract<PlayerScreen, { type: "task" }> => x.type === "task");

  const checkQuiz = async () => {
    if (s.type !== "quiz" || !answers[s.id]) return;
    setChecked((c) => ({ ...c, [s.id]: true }));
    if (s.index === s.of - 1) {
      const all = Object.fromEntries(quizScreens.map((q) => [q.id, answers[q.id] ?? (q.id === s.id ? answers[s.id] : "")]));
      if (!data.inRoute) { setQuizResult("Ответы проверены здесь. В маршрут мини-тест засчитывается, когда урок есть в вашем маршруте."); return; }
      try {
        const r = await v3<{ passed: boolean; correct: number; total: number }>(`progress/lessons/${lessonId}/quiz`, { answers: all });
        setQuizResult(r.passed ? `Мини-тест засчитан: ${r.correct} из ${r.total}.` : `Верно ${r.correct} из ${r.total}. Чтобы засчитать тест, пройдите его ещё раз — вернитесь к первому вопросу.`);
      } catch (e) {
        setQuizResult(e instanceof ApiError ? e.message : "Не удалось сохранить результат теста");
      }
    }
  };
  const retryQuiz = () => {
    const firstQuiz = screens.findIndex((x) => x.type === "quiz");
    setAnswers({}); setChecked({}); setQuizResult(null); go(firstQuiz);
  };
  const saveSelfCheck = async () => {
    if (!data.step?.exerciseMatches) return;
    try {
      await v3(`progress/steps/${data.step.position}/self-check`, { stableId: data.step.stableId, criteriaMet: criteria });
      setSelfSaved("Самопроверка сохранена в шаге маршрута.");
    } catch (e) {
      setSelfSaved(e instanceof ApiError ? e.message : "Не удалось сохранить");
    }
  };

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

      {data.restarted && i === 0 && <div className="mt-4"><Notice>Урок обновился с прошлого раза, поэтому он начинается сначала. Отметки в шагах маршрута сохранены.</Notice></div>}

      <div key={i} data-player-screen className="flex-1 pb-4 pt-4 motion-safe:animate-[playerIn_200ms_ease-out]">
        {s.type === "text" && (
          <>
            <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-signal">{KIND_LABEL[s.kind]}</p>
            <h2 ref={heading} tabIndex={-1} className="mt-2 font-display text-[clamp(23px,6.2vw,36px)] font-bold leading-tight outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0">{s.title}</h2>
            {s.quote && <blockquote className="mt-4 border-l-4 border-graphite/30 bg-white/70 px-4 py-3 text-[16px] leading-relaxed">{s.quote}</blockquote>}
            {s.formula && <div className="mt-4 space-y-1 rounded-md border border-graphite/20 bg-white px-4 py-3 font-mono text-[15px] leading-relaxed">{s.formula.map((f) => <p key={f} className="m-0">{f}</p>)}</div>}
            {s.text?.map((t) => <p key={t} className="mt-3 text-[16px] leading-[1.55] sm:mt-4 sm:text-[17px] sm:leading-relaxed">{t}</p>)}
            {s.list && <ul className="mt-3 space-y-1.5 pl-5 text-[16px] leading-[1.5] sm:mt-4 sm:space-y-2 sm:text-[17px] sm:leading-relaxed [list-style:disc]">{s.list.map((t) => <li key={t}>{t}</li>)}</ul>}
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
            <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-signal">Практика</p>
            <h2 ref={heading} tabIndex={-1} className="mt-2 font-display text-[clamp(23px,6.2vw,36px)] font-bold leading-tight outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0">{s.title}</h2>
            {s.text.map((t) => <p key={t} className="mt-3 text-[16px] leading-[1.55] sm:mt-4 sm:text-[17px] sm:leading-relaxed">{t}</p>)}
            <SourceData label={s.inputLabel} input={s.input} />
            <p className={`mt-4 text-[15px] leading-relaxed ${muted}`}><strong className="text-graphite">Что должно получиться:</strong> {s.artifact}</p>
          </>
        )}

        {s.type === "action" && (
          <>
            <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-signal">Практика · действие {s.step} из {s.of}</p>
            <h2 ref={heading} tabIndex={-1} className="mt-2 font-display text-[clamp(22px,5.8vw,32px)] font-bold leading-tight outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0">{s.title}</h2>
            {s.text.map((t) => <p key={t} className="mt-3 text-[16px] leading-[1.55] sm:mt-4 sm:text-[17px] sm:leading-relaxed">{t}</p>)}
            {task && <SourceData label="Исходные данные задания" input={task.input} />}
          </>
        )}

        {s.type === "review" && (
          <>
            <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-signal">Разбор результата</p>
            <h2 ref={heading} tabIndex={-1} className="mt-2 font-display text-[clamp(22px,5.8vw,32px)] font-bold leading-tight outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0">{s.title}</h2>
            {s.text.map((t) => <p key={t} className="mt-3 text-[16px] leading-relaxed">{t}</p>)}
            <fieldset className="mt-4">
              <legend className="text-[15px] font-semibold">Критерии успешного выполнения</legend>
              <div className="mt-2 space-y-2">
                {s.criteria.map((c, k) => (
                  <label key={c} className="flex items-start gap-3 rounded-md border border-graphite/15 bg-white/70 p-3 text-[15px] leading-relaxed">
                    <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#0E0E11]" checked={!!criteria[k]} onChange={(e) => setCriteria((v) => v.map((x, j) => (j === k ? e.target.checked : x)))} />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {data.step?.exerciseMatches && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={() => void saveSelfCheck()}>Сохранить в шаг {data.step.position}</Button>
                <span role="status" className="text-[14px]">{selfSaved ?? ""}</span>
              </div>
            )}
            <details className="mt-4 rounded-md border border-graphite/20 bg-white/70 p-3">
              <summary className="cursor-pointer text-[15px] font-semibold">Показать образец разбора</summary>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{s.sample}</p>
              <p className={`mt-3 text-[14px] leading-relaxed ${muted}`}><strong className="text-graphite">Если что-то не сошлось:</strong> {s.feedback}</p>
            </details>
          </>
        )}

        {s.type === "quiz" && (
          <>
            <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-signal">Мини-тест · вопрос {s.index + 1} из {s.of}</p>
            <h2 ref={heading} tabIndex={-1} className="mt-2 text-[clamp(18px,4.8vw,26px)] font-bold leading-snug outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0">{s.question}</h2>
            <fieldset className="mt-4" disabled={checked[s.id]}>
              <legend className="sr-only">Варианты ответа</legend>
              <div className="space-y-1.5 sm:space-y-2">
                {s.options.map((o) => {
                  const picked = answers[s.id] === o.id;
                  const state = checked[s.id] ? (o.id === s.correctId ? "border-graphite bg-white" : picked ? "border-signal bg-white" : "border-graphite/15 bg-white/60") : picked ? "border-graphite bg-white" : "border-graphite/15 bg-white/70";
                  return (
                    <label key={o.id} className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-[15px] leading-[1.45] sm:text-[16px] sm:leading-relaxed ${state}`}>
                      <input type="radio" name={`player-${s.id}`} className="mt-1 h-5 w-5 shrink-0 accent-[#0E0E11]" checked={picked} onChange={() => setAnswers((a) => ({ ...a, [s.id]: o.id }))} />
                      <span>{o.text}{checked[s.id] && o.id === s.correctId && <strong className="ml-1">— верный ответ</strong>}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {checked[s.id] && (
              <div className="mt-4" role="status">
                <p className="m-0 text-[16px] font-bold">{answers[s.id] === s.correctId ? "Верно." : "Не совсем."}</p>
                <p className="mt-1 text-[15px] leading-relaxed">{s.reason}</p>
              </div>
            )}
            {quizResult && s.index === s.of - 1 && (
              <div className="mt-4"><Notice>{quizResult}</Notice>
                {/Чтобы засчитать/.test(quizResult) && <div className="mt-3"><Button variant="secondary" onClick={retryQuiz}>Пройти тест ещё раз</Button></div>}
              </div>
            )}
          </>
        )}

        {s.type === "done" && (
          <>
            <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.12em] text-signal">Урок пройден</p>
            <h2 ref={heading} tabIndex={-1} className="mt-2 font-display text-[clamp(23px,6.2vw,36px)] font-bold leading-tight outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0">Теперь я умею</h2>
            <p className="mt-3 text-[18px] font-semibold leading-relaxed">{s.skill.title}</p>
            <dl className="mt-5 space-y-4 text-[16px] leading-relaxed">
              <div><dt className="font-bold">Где пригодится</dt><dd className="m-0">{s.skill.applyAt}</dd></div>
              <div><dt className="font-bold">Чем это полезно работодателю</dt><dd className="m-0">{s.skill.employerValue}</dd></div>
              {s.nextLesson && <div><dt className="font-bold">Следующий навык</dt><dd className="m-0">{s.nextLesson.title}</dd></div>}
            </dl>
            <p className={`mt-5 text-[14px] leading-relaxed ${muted}`}>Отметки в практике — ваша самопроверка. Мини-тест проверен автоматически. Это учебные результаты, а не подтверждение навыка работодателем.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {data.step ? <Button onClick={() => onBackToStep(data.step!.position)}>Вернуться к шагу {data.step.position} и завершить его</Button> : <Button onClick={onExit}>К урокам</Button>}
              {s.nextLesson && !data.step && <Button variant="secondary" onClick={() => onOpenLesson(s.nextLesson!.id)}>Следующий урок</Button>}
            </div>
          </>
        )}
      </div>

      <nav aria-label="Навигация по уроку" className="sticky bottom-0 -mx-4 mt-auto border-t border-graphite/15 bg-cream/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" disabled={i === 0} onClick={() => go(i - 1)}>Назад</Button>
          <button type="button" onClick={onMaterials} className="inline-flex min-h-11 items-center px-2 text-[14px] font-semibold underline decoration-graphite/40 underline-offset-4">Материалы урока</button>
          {needCheck ? (
            <Button disabled={s.type === "quiz" && !answers[s.id]} onClick={() => void checkQuiz()}>Проверить</Button>
          ) : i < total - 1 ? (
            <Button onClick={() => go(i + 1)}>Далее</Button>
          ) : (
            <Button onClick={data.step ? () => onBackToStep(data.step!.position) : onExit}>{data.step ? "К шагу" : "Готово"}</Button>
          )}
        </div>
      </nav>
    </section>
  );
}

function SourceData({ label, input, open = false }: { label: string; input: string; open?: boolean }) {
  return (
    <details className="mt-4 rounded-md border border-graphite/25 bg-white/80 p-3" open={open}>
      <summary className="cursor-pointer text-[15px] font-semibold">{label}</summary>
      <div className="mt-2 max-h-[40vh] overflow-auto pr-1 text-[15px] leading-relaxed" tabIndex={0} role="region" aria-label={label}>{input}</div>
    </details>
  );
}
