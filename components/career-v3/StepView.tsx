"use client";
// One step of the saved route. Self-check, mini-test answers and completion are stored on the server;
// the server decides the state. Only checkboxes and option choices are sent — no free text.
import { useCallback, useEffect, useMemo, useState } from "react";
import { STATE_LABEL } from "@/lib/career-v3/progress";
import { humanize, lessonNames, staleReasonText, VARIANT_LABEL } from "@/lib/career-v3/ui-flow";
import { ApiError, Badge, Button, Notice, Section, card, muted, v3 } from "./primitives";
import { cleanTitle, lessonTitles, type ActiveProgress, type Progress, type StepProgress } from "./progress-api";
import { ProgressBar } from "./RouteView";

type Lesson = {
  id: string; title: string; version: string;
  content: {
    exercises: { id: string; title: string; syntheticInput: string; instructions: string[]; expectedArtifact: string; successCriteria: string[]; sampleSolution: string; feedbackIfIncorrect: string }[];
    templates: { id: string; title: string; kind: string; body: string }[];
    quiz: { id: string; question: string; options: { id: string; text: string }[]; reason: string }[];
  };
  security: { ifToolForbidden: string; forbiddenInputs: string[] };
};
type QuizReply = { attempt: { correct: number; total: number; passed: boolean; results: { questionId: string; chosen: string; correct: boolean }[] }; passed: boolean; attempts: number };

export default function StepView({ position, onBack, onOpenLesson, onOpenStep }:
  { position: number; onBack: () => void; onOpenLesson: (id: string) => void; onOpenStep: (n: number) => void }) {
  const [progress, setProgress] = useState<ActiveProgress | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<boolean[]>([]);
  const [completion, setCompletion] = useState<boolean[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizReply, setQuizReply] = useState<QuizReply | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (show = true) => {
    const p = await v3<Progress>("progress");
    if (!p.plan) throw new Error("Маршрут ещё не собран");
    if (show) setProgress(p as ActiveProgress);
    return p as ActiveProgress;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null); setMessage(null); setQuizReply(null); setLesson(null);
      try {
        // Audit #49: the step is shown only after "start" is applied, so the learner never sees a stale «Не начат».
        let p = await refresh(false);
        const step = p.plan.steps.find((s) => s.position === position);
        if (!step) throw new Error("Шаг не найден");
        if (!p.stale && p.steps[position - 1]?.state !== "done") {
          await v3(`progress/steps/${position}/start`, { stableId: step.stableId });
        }
        p = await refresh();
        const sp = p.steps.find((s) => s.position === position)!;
        const l = await v3<{ lesson: Lesson }>(`lessons/${step.lessonId}`).then((r) => r.lesson).catch(() => null);
        if (cancelled) return;
        setLesson(l);
        const ex = l?.content.exercises.find((e) => e.id === step.exerciseId);
        setCriteria(sp.criteriaMet ?? (ex ? ex.successCriteria.map(() => false) : []));
        setCompletion(sp.completionMet ?? step.completionCriteria.map(() => false));
        setAnswers(p.quizzes[step.lessonId]?.answers ?? {});
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [position, refresh]);

  const names = useMemo(() => (lesson ? lessonNames(lesson) : {}), [lesson]);
  if (error) return <div className="space-y-4"><Notice tone="error">{error}</Notice><Button variant="secondary" onClick={onBack}>К маршруту</Button></div>;
  if (!progress) return <p role="status">Открываем шаг…</p>;
  const step = progress.plan.steps.find((s) => s.position === position)!;
  const sp = progress.steps.find((s) => s.position === position) as StepProgress;
  const quiz = progress.quizzes[step.lessonId];
  const exercise = lesson?.content.exercises.find((e) => e.id === step.exerciseId);
  const template = lesson?.content.templates.find((t) => t.id === step.templateId);
  const readOnly = progress.stale || sp.state === "done";
  const h = (t: string) => humanize(t, names);
  const manual = progress.plan.variant === "manual_without_ai";

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true); setMessage(null);
    try { await fn(); await refresh(); if (ok) setMessage(ok); } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Не удалось сохранить");
    } finally { setBusy(false); }
  };
  const saveCriteria = () => act(() => v3(`progress/steps/${position}/self-check`, { stableId: step.stableId, criteriaMet: criteria }), "Самопроверка сохранена.");
  const sendQuiz = () => act(async () => setQuizReply(await v3<QuizReply>(`progress/lessons/${step.lessonId}/quiz`, { answers })));
  const complete = () => act(() => v3(`progress/steps/${position}/complete`, { stableId: step.stableId, completionMet: completion }), "Шаг завершён и сохранён.");
  const next = progress.plan.steps.find((s) => s.position > position && progress.steps[s.position - 1]?.state !== "done");
  const allQuiz = lesson ? lesson.content.quiz.every((q) => answers[q.id]) : false;

  return (
    <article aria-labelledby="step-title">
      <Button variant="quiet" onClick={onBack}>← Мой маршрут</Button>
      <div className={`${card} mt-3`}><ProgressBar done={progress.summary.done} total={progress.summary.total} percent={progress.summary.percent} /></div>
      <p className={`mt-5 flex flex-wrap items-center gap-2 text-sm font-semibold ${muted}`}>
        <span>Шаг {position} из 30 · около {step.estimatedMinutes} мин</span>
        <span className="rounded-full border border-graphite/40 px-2 py-0.5 text-graphite" data-testid="step-state">{STATE_LABEL[sp.state]}</span>
      </p>
      <h1 id="step-title" className="mt-1 font-display text-[clamp(24px,5vw,36px)] font-bold leading-tight">{h(step.learningGoal)}</h1>
      <p className="mt-3 max-w-3xl leading-relaxed">{h(step.action)}</p>
      <p className="mt-2"><strong>Результат шага:</strong> {h(step.expectedArtifact)}</p>
      <p className={`mt-2 text-[15px] ${muted}`}><strong>Безопасность:</strong> {h(step.safetyNote)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => onOpenLesson(step.lessonId)}>Теория урока: {cleanTitle(step.lessonTitle)}</Button>
        {step.lessonTitle.startsWith("[SYNTHETIC FIXTURE]") && <Badge>Тестовая заглушка</Badge>}
      </div>

      {progress.stale && (
        <div className="mt-5"><Notice tone="warn"><strong>Маршрут устарел:</strong> {progress.staleReasons.map((r) => staleReasonText(r, lessonTitles(progress.plan))).join("; ")}. Шаг доступен только для просмотра; соберите новый маршрут на странице «Мой маршрут».</Notice></div>
      )}
      {sp.state === "done" && <div className="mt-5"><Notice><strong>Шаг завершён</strong> {sp.completedAt ? new Date(sp.completedAt).toLocaleString("ru-RU") : ""}. Повторная отметка не нужна.</Notice></div>}
      {manual && lesson && <div className="mt-5"><Notice><strong>Практика вручную, без ИИ.</strong> {h(lesson.security.ifToolForbidden)}</Notice></div>}
      {!lesson && <div className="mt-5"><Notice tone="warn">Урок этого шага сейчас недоступен. Прогресс сохранён.</Notice></div>}

      {template && (
        <Section title="Шаблон шага" id="template">
          <div className={card}>
            <h3 className="font-bold">{h(template.title)}</h3>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-white p-3 font-sans text-[15px] leading-relaxed">{h(template.body)}</pre>
          </div>
        </Section>
      )}

      {exercise && (
        <Section title="1. Упражнение и самопроверка" id="exercise">
          <Notice tone="warn">Используйте только вымышленные данные урока. Ответ остаётся у вас: сохраняются только отметки критериев. Не вставляйте: {lesson!.security.forbiddenInputs.join("; ").toLowerCase()}.</Notice>
          <div className={card}>
            <h3 className="text-lg font-bold">{h(exercise.title)}</h3>
            <div className="mt-2 rounded-md bg-white p-3"><p className={`text-sm font-semibold ${muted}`}>Исходные данные (вымышленные)</p><p className="mt-1 leading-relaxed">{h(exercise.syntheticInput)}</p></div>
            <ol className="mt-3 list-decimal space-y-1 pl-5">{exercise.instructions.map((s, i) => <li key={i}>{h(s)}</li>)}</ol>
            <p className="mt-3"><strong>Что должно получиться:</strong> {h(exercise.expectedArtifact)}</p>
            <fieldset className="mt-4" disabled={readOnly}>
              <legend className="font-semibold">Самопроверка по критериям упражнения</legend>
              <div className="mt-2 space-y-2">
                {exercise.successCriteria.map((c, i) => (
                  <label key={i} className="flex items-start gap-3 text-[15px] leading-snug">
                    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#0E0E11]" checked={!!criteria[i]} onChange={() => setCriteria(criteria.map((d, j) => (j === i ? !d : d)))} />
                    <span>{h(c)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {!readOnly && <div className="mt-3"><Button variant="secondary" disabled={busy} onClick={saveCriteria}>Сохранить самопроверку</Button></div>}
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold underline underline-offset-4">Показать образец ответа</summary>
              <p className="mt-2 leading-relaxed">{h(exercise.sampleSolution)}</p>
              <p className={`mt-2 text-[15px] leading-relaxed ${muted}`}><strong>Если не получилось.</strong> {h(exercise.feedbackIfIncorrect)}</p>
            </details>
          </div>
        </Section>
      )}

      {lesson && (
        <Section title="2. Мини-тест урока" id="quiz">
          <p className={muted}>{quiz?.passed ? `Мини-тест пройден (попыток: ${quiz.attempts}).` : quiz ? `Пока не пройден: верно ${quiz.correct} из ${quiz.total}, попыток: ${quiz.attempts}.` : "Ответьте на все вопросы — нужен полностью верный результат, попытки не ограничены."}</p>
          {lesson.content.quiz.map((q, n) => {
            const r = quizReply?.attempt.results.find((x) => x.questionId === q.id);
            return (
              <fieldset key={q.id} className={card} disabled={readOnly || quiz?.passed}>
                <legend className="sr-only">Вопрос {n + 1}</legend>
                <p className="font-bold">{n + 1}. {q.question}</p>
                <div className="mt-2 space-y-2">
                  {q.options.map((o) => (
                    <label key={o.id} className="flex items-start gap-3 text-[15px] leading-snug">
                      <input type="radio" name={`step-${q.id}`} className="mt-1 h-4 w-4 shrink-0 accent-[#0E0E11]" checked={answers[q.id] === o.id} onChange={() => setAnswers({ ...answers, [q.id]: o.id })} />
                      <span>{o.text}</span>
                    </label>
                  ))}
                </div>
                {r && <p className="mt-2 text-[15px]"><strong>{r.correct ? "Верно." : "Неверно."}</strong> {r.correct ? q.reason : "Перечитайте объяснение в уроке и попробуйте ещё раз."}</p>}
              </fieldset>
            );
          })}
          {!readOnly && !quiz?.passed && <Button variant="secondary" disabled={busy || !allQuiz} onClick={sendQuiz}>Отправить ответы</Button>}
          {quizReply && <p role="status" className="font-semibold">{quizReply.attempt.passed ? "Мини-тест пройден." : `Верно ${quizReply.attempt.correct} из ${quizReply.attempt.total}. Попробуйте ещё раз.`}</p>}
        </Section>
      )}

      <Section title="3. Завершение шага" id="complete">
        <div className={card}>
          <p className={`text-[15px] ${muted}`}>Завершить шаг можно, когда отмечены все критерии упражнения, мини-тест пройден и вы подтвердили критерии выполнения шага.</p>
          <fieldset className="mt-3" disabled={readOnly || sp.state !== "self_checked"}>
            <legend className="font-semibold">Критерии выполнения шага</legend>
            <div className="mt-2 space-y-2">
              {step.completionCriteria.map((c, i) => (
                <label key={i} className="flex items-start gap-3 text-[15px] leading-snug">
                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#0E0E11]" checked={!!completion[i]} onChange={() => setCompletion(completion.map((d, j) => (j === i ? !d : d)))} />
                  <span>{h(c)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {!readOnly && (
            <div className="mt-3">
              <Button disabled={busy || sp.state !== "self_checked" || !completion.every(Boolean)} onClick={complete}>Завершить шаг</Button>
              {sp.state !== "self_checked" && <p className={`mt-2 text-[15px] ${muted}`}>Сначала сохраните самопроверку со всеми отмеченными критериями и пройдите мини-тест.</p>}
            </div>
          )}
        </div>
      </Section>

      <div aria-live="polite" className="mt-4">{message && <Notice>{message}</Notice>}</div>
      <div className="mt-6 flex flex-wrap gap-3">
        {sp.state === "done" && next && <Button onClick={() => onOpenStep(next.position)}>Следующий шаг: {next.position}</Button>}
        <Button variant="secondary" onClick={onBack}>К маршруту</Button>
      </div>
      <p className={`mt-6 text-[14px] ${muted}`}>Режим практики: {VARIANT_LABEL[progress.plan.variant]}.</p>
    </article>
  );
}
