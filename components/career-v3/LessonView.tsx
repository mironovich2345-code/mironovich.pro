"use client";
// Universal v3 lesson component: renders any lesson that follows lesson.schema.json.
// Practice is self-checked against the lesson's criteria — no free-text answers are sent anywhere.
import { useEffect, useMemo, useState } from "react";
import { humanize, lessonNames, MODULE_LABEL } from "@/lib/career-v3/ui-flow";
import { Badge, Button, Notice, Section, card, muted, PROFESSION, v3 } from "./primitives";

type Mode = "published" | "synthetic_fixture" | "review_preview";
type Full = {
  id: string; title: string; summary: string; moduleId: string; durationMinutes: number; objectives: string[];
  content: {
    introduction: { heading: string; paragraphs: string[] };
    explanations: { heading: string; body: string; example: string }[];
    workedExamples: { id: string; title: string; situation: string; unsafeAttempt: string; safeApproach: string; workedOutput: string; humanReview: string }[];
    procedure: { id: string; title: string; instruction: string; expectedResult: string; check: string }[];
    templates: { id: string; title: string; kind: string; body: string; prohibitedInputs: string[] }[];
    exercises: { id: string; title: string; syntheticInput: string; instructions: string[]; expectedArtifact: string; successCriteria: string[]; sampleSolution: string; feedbackIfIncorrect: string }[];
    quiz: { id: string; question: string; options: { id: string; text: string }[]; correctId: string; reason: string }[];
    summary: string[];
  };
  security: { forbiddenInputs: string[]; ifToolForbidden: string; errorEscalation: string };
  sources: { id: string; title: string; url: string; checkedOn: string }[];
  downloads: { id: string; title: string; kind: string; repositoryPath: string }[];
};
const KIND: Record<string, string> = { prompt: "Промпт для разрешённого ИИ", checklist: "Чек-лист", measurement_sheet: "Лист замера", script: "Шаблон для работы вручную" };

export default function LessonView({ lessonId, preview, onBack }: { lessonId: string; preview: boolean; onBack: () => void }) {
  const [data, setData] = useState<{ lesson: Full; mode: Mode } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void v3<{ lesson: Full; mode: Mode }>(`${preview ? "preview/" : ""}lessons/${lessonId}`).then(setData).catch((e) => setError(e.message));
  }, [lessonId, preview]);
  const names = useMemo(() => (data ? lessonNames(data.lesson) : {}), [data]);
  if (error) return <div className="space-y-4"><Notice tone="error">{error}</Notice><Button variant="secondary" onClick={onBack}>Назад к урокам</Button></div>;
  if (!data) return <p role="status">Открываем урок…</p>;
  const { lesson: l, mode } = data;
  const h = (t: string) => humanize(t, names);
  const c = l.content;
  const prompts = c.templates.filter((t) => t.kind === "prompt");
  const manual = c.templates.filter((t) => t.kind !== "prompt");
  return (
    <article aria-labelledby="lesson-title">
      <Button variant="quiet" onClick={onBack}>← Все уроки</Button>
      {mode === "review_preview" && <div className="mt-3"><Notice tone="warn"><strong>Черновик на проверке.</strong> Материал ещё не прошёл редакционную и правовую приёмку и не опубликован. Предпросмотр доступен только тестировщику.</Notice></div>}
      {mode === "synthetic_fixture" && <div className="mt-3"><Notice tone="warn"><strong>Синтетическая тестовая заглушка.</strong> Используется только для проверки интерфейса и не является учебным материалом.</Notice></div>}
      <p className={`mt-4 text-sm font-semibold ${muted}`}>{MODULE_LABEL[l.moduleId] ?? "Урок"} · около {l.durationMinutes} минут</p>
      <h1 id="lesson-title" className="mt-1 font-display text-[clamp(26px,5.5vw,40px)] font-bold leading-tight">{l.title.replace("[SYNTHETIC FIXTURE] ", "")}</h1>
      <p className="mt-3 max-w-3xl text-[17px] leading-relaxed">{h(l.summary)}</p>

      <Section title="Что вы научитесь делать" id="goals"><ul className="list-disc space-y-1 pl-5">{l.objectives.map((o, i) => <li key={i}>{h(o)}</li>)}</ul></Section>

      <Section title={c.introduction.heading} id="intro">{c.introduction.paragraphs.map((p, i) => <p key={i} className="max-w-3xl leading-relaxed">{p}</p>)}</Section>

      <Section title="Объяснение" id="explain">
        {c.explanations.map((e, i) => (
          <div key={i} className={card}>
            <h3 className="text-lg font-bold">{h(e.heading)}</h3>
            <p className="mt-2 leading-relaxed">{h(e.body)}</p>
            <p className="mt-3 border-l-4 border-signal pl-3 text-[15px] leading-relaxed"><strong>Пример.</strong> {h(e.example)}</p>
          </div>
        ))}
      </Section>

      <Section title="Разобранные примеры" id="cases">
        {c.workedExamples.map((x) => (
          <div key={x.id} className={card}>
            <h3 className="text-lg font-bold">{h(x.title)}</h3>
            <p className="mt-2 leading-relaxed">{h(x.situation)}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-signal/60 bg-white p-3"><p className="font-semibold text-signal">Как не надо</p><p className="mt-1 text-[15px] leading-relaxed">{h(x.unsafeAttempt)}</p></div>
              <div className="rounded-md border border-graphite/30 bg-white p-3"><p className="font-semibold">Как надо</p><p className="mt-1 text-[15px] leading-relaxed">{h(x.safeApproach)}</p></div>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed"><strong>Результат.</strong> {h(x.workedOutput)}</p>
            <p className={`mt-2 text-[15px] leading-relaxed ${muted}`}><strong>Что проверил человек.</strong> {h(x.humanReview)}</p>
          </div>
        ))}
      </Section>

      <Section title="Пошаговая инструкция" id="steps">
        <ol className="space-y-3">
          {c.procedure.map((p, i) => (
            <li key={p.id} className={card}>
              <h3 className="font-bold">{i + 1}. {h(p.title)}</h3>
              <p className="mt-1 leading-relaxed">{h(p.instruction)}</p>
              <p className="mt-2 text-[15px]"><strong>Результат:</strong> {h(p.expectedResult)}</p>
              <p className={`text-[15px] ${muted}`}><strong>Самопроверка:</strong> {h(p.check)}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Шаблоны и промпты" id="templates">
        <Notice><strong>Без ИИ.</strong> {h(l.security.ifToolForbidden)}</Notice>
        {[...manual, ...prompts].map((t) => <Template key={t.id} t={t} />)}
      </Section>

      <Section title="Практика" id="practice">
        <Notice tone="warn">Используйте только вымышленные данные урока. Не вставляйте: {l.security.forbiddenInputs.join("; ").toLowerCase()}.</Notice>
        {c.exercises.map((x) => <Exercise key={x.id} x={x} h={h} />)}
      </Section>

      <Section title="Мини-тест" id="quiz">
        {c.quiz.map((q, i) => <Quiz key={q.id} q={q} n={i + 1} />)}
      </Section>

      <Section title="Главное" id="summary"><ul className="list-disc space-y-1 pl-5">{c.summary.map((s, i) => <li key={i}>{h(s)}</li>)}</ul></Section>

      {l.downloads.length > 0 && (
        <Section title="Материалы для скачивания" id="downloads">
          <ul className="space-y-2">
            {l.downloads.map((d) => (
              <li key={d.id}>
                <a className="font-semibold underline underline-offset-4 hover:text-signal" href={`/api/career/v3/${PROFESSION}/${preview ? "preview/" : ""}lessons/${l.id}/downloads/${d.id}`} download>
                  {h(d.title.replace("[SYNTHETIC FIXTURE] ", ""))}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {l.sources.length > 0 && (
        <Section title="Источники" id="sources">
          <ul className="space-y-2 text-[15px]">
            {l.sources.map((s) => <li key={s.id}><a className="underline underline-offset-4" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> <span className={muted}>(проверено {s.checkedOn.split("-").reverse().join(".")})</span></li>)}
          </ul>
        </Section>
      )}
    </article>
  );
}

function Template({ t }: { t: Full["content"]["templates"][number] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={card}>
      <p className={`text-sm font-semibold ${muted}`}>{KIND[t.kind] ?? "Шаблон"}</p>
      <h3 className="font-bold">{humanize(t.title)}</h3>
      <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-white p-3 font-sans text-[15px] leading-relaxed">{humanize(t.body)}</pre>
      <p className="mt-2 text-[14px]"><strong>Нельзя подставлять:</strong> {t.prohibitedInputs.join("; ")}.</p>
      <div className="mt-2 flex items-center gap-3">
        <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(humanize(t.body)).then(() => setCopied(true)).catch(() => setCopied(false)); }}>Скопировать</Button>
        <span role="status" className="text-sm">{copied ? "Скопировано" : ""}</span>
      </div>
    </div>
  );
}

function Exercise({ x, h }: { x: Full["content"]["exercises"][number]; h: (t: string) => string }) {
  const [done, setDone] = useState<boolean[]>(x.successCriteria.map(() => false));
  const all = done.every(Boolean);
  return (
    <div className={card}>
      <h3 className="text-lg font-bold">{h(x.title)}</h3>
      <div className="mt-2 rounded-md bg-white p-3"><p className={`text-sm font-semibold ${muted}`}>Исходные данные (вымышленные)</p><p className="mt-1 leading-relaxed">{h(x.syntheticInput)}</p></div>
      <p className="mt-3 font-semibold">Что сделать</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">{x.instructions.map((s, i) => <li key={i}>{h(s)}</li>)}</ol>
      <p className="mt-3"><strong>Что должно получиться:</strong> {h(x.expectedArtifact)}</p>
      <fieldset className="mt-4">
        <legend className="font-semibold">Самопроверка по критериям</legend>
        <div className="mt-2 space-y-2">
          {x.successCriteria.map((cr, i) => (
            <label key={i} className="flex items-start gap-3 text-[15px] leading-snug">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#0E0E11]" checked={done[i]} onChange={() => setDone(done.map((d, j) => (j === i ? !d : d)))} />
              <span>{h(cr)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p role="status" className="mt-3 text-[15px] font-semibold">{all ? "Все критерии отмечены — сверьтесь с образцом." : `Отмечено ${done.filter(Boolean).length} из ${done.length} критериев.`}</p>
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold underline underline-offset-4">Показать образец ответа</summary>
        <p className="mt-2 leading-relaxed">{h(x.sampleSolution)}</p>
        <p className={`mt-2 text-[15px] leading-relaxed ${muted}`}><strong>Если не получилось.</strong> {h(x.feedbackIfIncorrect)}</p>
      </details>
    </div>
  );
}

function Quiz({ q, n }: { q: Full["content"]["quiz"][number]; n: number }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const right = checked && choice === q.correctId;
  return (
    <fieldset className={card}>
      <legend className="sr-only">Вопрос {n}</legend>
      <p className="font-bold">{n}. {q.question}</p>
      <div className="mt-2 space-y-2">
        {q.options.map((o) => (
          <label key={o.id} className="flex items-start gap-3 text-[15px] leading-snug">
            <input type="radio" name={q.id} className="mt-1 h-4 w-4 shrink-0 accent-[#0E0E11]" checked={choice === o.id} onChange={() => { setChoice(o.id); setChecked(false); }} />
            <span>{o.text}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={!choice} onClick={() => setChecked(true)}>Проверить ответ</Button>
      </div>
      <div aria-live="polite" className="mt-3">
        {checked && (
          <div className={`rounded-md border-l-4 p-3 text-[15px] ${right ? "border-graphite bg-white" : "border-signal bg-white"}`}>
            <p className="font-semibold">{right ? "Верно." : "Не совсем."} {!right && <Badge>Правильный ответ: «{q.options.find((o) => o.id === q.correctId)?.text}»</Badge>}</p>
            <p className="mt-1">{q.reason}</p>
          </div>
        )}
      </div>
    </fieldset>
  );
}
