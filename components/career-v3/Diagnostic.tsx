"use client";
// Diagnostic wizard over the approved v3 questionnaire (served by the engine). One question per
// screen, Back/Continue, editable answers, dynamic task options, conditional follow-ups and server
// validation. No free-text fields: every answer is an option of the approved questionnaire.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  answerLabel, localProblem, optionsFor, pruneFollowUps, pruneTaskChoices, questionSequence, toggleMulti,
  type Answers, type QOption, type Questionnaire,
} from "@/lib/career-v3/ui-flow";
import { ApiError, Button, Notice, card, muted, v3 } from "./primitives";

const DRAFT_KEY = "career-v3-diagnostic-draft";

export default function Diagnostic({ onSaved }: { onSaved: () => void }) {
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState(false);
  const [taskOptions, setTaskOptions] = useState<QOption[]>([]);
  const [taskLabels, setTaskLabels] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<ApiError["errors"]>([]);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    void v3<Questionnaire>("diagnostic/questions").then(setQ).catch((e) => setProblem(e.message));
    try { const d = sessionStorage.getItem(DRAFT_KEY); if (d) setAnswers(JSON.parse(d)); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(answers)); } catch { /* ignore */ } }, [answers]);

  const sequence = useMemo(() => (q ? questionSequence(q, answers) : []), [q, answers]);
  const current = sequence[index];
  const subtypeKey = JSON.stringify([answers.Q01, answers.F02, answers.Q03]);

  // Task options depend on specialisation and work areas; stale task choices are removed with a notice.
  const refreshTasks = useCallback(async () => {
    if (!answers.Q01 || !answers.Q03 || (Array.isArray(answers.Q03) && answers.Q03.length === 0)) { setTaskOptions([]); return; }
    const r = await v3<{ options: QOption[] }>("diagnostic/task-options", { answers: { Q01: answers.Q01, Q03: answers.Q03, ...(answers.F02 ? { F02: answers.F02 } : {}) } });
    setTaskOptions(r.options);
    setTaskLabels((prev) => ({ ...prev, ...Object.fromEntries(r.options.map((o) => [o.value, o.label])) }));
    setAnswers((a) => {
      const taskQ = q?.questions.find((x) => x.kind === "matrix_task_multi");
      if (!taskQ || !a[taskQ.id]) return a;
      const { kept, removed } = pruneTaskChoices(taskQ, a[taskQ.id] as string[], r.options, taskLabels);
      if (removed.length) setNotice(`Список задач обновился под ваши ответы. Сняты варианты, которые больше не подходят: ${removed.join(", ")}.`);
      return { ...a, [taskQ.id]: kept };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtypeKey, q]);
  useEffect(() => { void refreshTasks().catch(() => setNotice("Не удалось загрузить список задач. Попробуйте ещё раз.")); }, [refreshTasks]);

  useEffect(() => { heading.current?.focus(); }, [index, review]);

  if (!q) return problem ? <Notice tone="error">{problem}</Notice> : <p role="status">Загружаем вопросы…</p>;

  const total = sequence.length;
  const value = current ? answers[current.id] : undefined;
  const setValue = (v: string | string[]) => {
    setProblem(null);
    setAnswers((a) => pruneFollowUps(q, { ...a, [current.id]: v }));
  };
  const next = () => {
    const p = localProblem(current, value, taskOptions);
    if (p) { setProblem(p); return; }
    setProblem(null);
    if (index + 1 >= total) setReview(true); else setIndex(index + 1);
  };
  const back = () => { setProblem(null); setNotice(null); if (review) setReview(false); else setIndex(Math.max(0, index - 1)); };
  const submit = async () => {
    setBusy(true); setServerErrors([]);
    try {
      await v3("diagnostic", { answers });
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) setServerErrors(e.errors);
      else setProblem(e instanceof Error ? e.message : "Не удалось сохранить ответы");
    } finally { setBusy(false); }
  };

  if (review) {
    return (
      <div className={card}>
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold">Проверьте ответы</h2>
        <p className={`mt-2 ${muted}`}>Любой ответ можно изменить. После сохранения откроется ваша карта задач.</p>
        {serverErrors.length > 0 && (
          <Notice tone="error">
            <p className="font-semibold">Сервер не принял некоторые ответы:</p>
            <ul className="mt-2 list-disc pl-5">
              {serverErrors.map((er, i) => {
                const at = sequence.findIndex((s) => s.id === er.questionId);
                return (
                  <li key={i}>
                    {at >= 0 ? `«${sequence[at].prompt}»` : "Анкета"}: {er.message}.{" "}
                    {at >= 0 && <Button variant="quiet" onClick={() => { setReview(false); setIndex(at); }}>Перейти к вопросу</Button>}
                  </li>
                );
              })}
            </ul>
          </Notice>
        )}
        <ol className="mt-5 divide-y divide-graphite/10">
          {sequence.map((s, i) => (
            <li key={s.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div>
                <p className="font-semibold">{i + 1}. {s.prompt}</p>
                <p className={muted}>{answerLabel(q, s.id, answers[s.id], taskOptions)}</p>
              </div>
              <Button variant="secondary" className="shrink-0" onClick={() => { setReview(false); setIndex(i); }}
                aria-label={`Изменить ответ на вопрос ${i + 1}`}>Изменить</Button>
            </li>
          ))}
        </ol>
        {problem && <div className="mt-4"><Notice tone="error">{problem}</Notice></div>}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={back}>Назад</Button>
          <Button onClick={() => void submit()} disabled={busy}>{busy ? "Сохраняем…" : "Сохранить и открыть карту"}</Button>
        </div>
      </div>
    );
  }

  const options = optionsFor(current, taskOptions);
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const multi = current.kind !== "single";
  const helpId = `help-${current.id}`;
  return (
    <form className={card} onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
      <p className={`text-sm font-semibold ${muted}`} aria-live="polite">Вопрос {index + 1} из {total} · {current.section}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-graphite/10" aria-hidden="true">
        <div className="h-full bg-signal" style={{ width: `${Math.round(((index + 1) / total) * 100)}%` }} />
      </div>
      <fieldset className="mt-5" aria-describedby={helpId}>
        <legend>
          <h2 ref={heading} tabIndex={-1} className="text-[22px] font-bold leading-snug sm:text-2xl">{current.prompt}</h2>
        </legend>
        <p id={helpId} className={`mt-2 leading-relaxed ${muted}`}>{current.help}</p>
        {multi && current.maxSelected && <p className="mt-1 text-sm font-semibold">Можно выбрать до {current.maxSelected}.</p>}
        {current.kind === "matrix_task_multi" && options.length <= 1 && (
          <Notice tone="warn">Сначала ответьте на вопросы о специализации и направлениях работы — по ним подбирается список задач.</Notice>
        )}
        <div className="mt-4 grid gap-2">
          {options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <label key={o.value}
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-md border px-4 py-3 text-[16px] leading-snug ${checked ? "border-graphite bg-white" : "border-graphite/25 bg-white/50 hover:border-graphite/60"}`}>
                <input type={multi ? "checkbox" : "radio"} name={current.id} value={o.value} checked={checked}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#0E0E11]"
                  onChange={() => setValue(multi ? toggleMulti(current, selected, o.value) : o.value)} />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <details className="mt-4">
        <summary className="cursor-pointer text-[15px] font-semibold underline underline-offset-4">Зачем этот вопрос</summary>
        <p className={`mt-2 ${muted}`}>{current.why}</p>
      </details>
      {notice && <div className="mt-4"><Notice tone="warn">{notice}</Notice></div>}
      {problem && <div className="mt-4"><Notice tone="error">{problem}</Notice></div>}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={back} disabled={index === 0}>Назад</Button>
        <Button type="submit">{index + 1 >= total ? "К проверке ответов" : "Продолжить"}</Button>
      </div>
    </form>
  );
}
