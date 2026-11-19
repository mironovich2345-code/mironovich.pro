"use client";
// "Мой маршрут": the learner's saved plan version with progress. The plan is built once and reused;
// a stale plan stays readable as history and is replaced only when the learner confirms a rebuild.
// When approved material is insufficient the screen says so plainly — it never renders placeholder steps.
import { useCallback, useEffect, useState } from "react";
import type { PlanV3 } from "@/lib/career-v3/contracts";
import { STATE_LABEL } from "@/lib/career-v3/progress";
import { humanize, METRIC_KIND_LABEL, PHASE_LABEL, staleReasonText, VARIANT_LABEL } from "@/lib/career-v3/ui-flow";
import { ApiError, Badge, Button, Notice, card, muted, v3 } from "./primitives";
import { cleanTitle, lessonTitles, type ActiveProgress, type Progress, type HistoryItem } from "./progress-api";

type Unavailable = Extract<PlanV3, { status: "unavailable" }>;

export function ProgressBar({ done, total, percent }: { done: number; total: number; percent: number }) {
  return (
    <div>
      <p className="font-semibold">Завершено {done} из {total} шагов · {percent}%</p>
      <div role="progressbar" aria-label="Прохождение маршрута" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
        className="mt-2 h-3 w-full overflow-hidden rounded-full border border-graphite/30 bg-white">
        <div className="h-full bg-graphite" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function History({ items }: { items: HistoryItem[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="history-title" className={`${card} mt-8`}>
      <h2 id="history-title" className="text-lg font-bold">История прежних маршрутов</h2>
      <p className={`mt-1 text-[15px] ${muted}`}>Результаты прежних маршрутов сохранены, но не переносятся в новый: материалы изменились.</p>
      <ul className="mt-3 space-y-2 text-[15px]">
        {items.map((h, i) => (
          <li key={i}>
            Маршрут от {new Date(h.createdAt).toLocaleDateString("ru-RU")}: завершено {h.done} из {h.total} шагов
            {h.reasons.length > 0 && <span className={muted}> — заменён, потому что {h.reasons.map((r) => staleReasonText(r)).join("; ")}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RouteView({ onOpenLesson, onOpenStep, onRetake, fixtureMode }:
  { onOpenLesson: (id: string) => void; onOpenStep: (position: number) => void; onRetake: () => void; fixtureMode: boolean }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [unavailable, setUnavailable] = useState<Unavailable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      let p = await v3<Progress>("progress");
      if (!p.plan) {
        const built = await v3<{ plan: PlanV3 }>("plan", {});
        if (built.plan.status !== "ready") { setUnavailable(built.plan); setProgress(p); return; }
        p = await v3<Progress>("progress");
      }
      setUnavailable(null);
      setProgress(p);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 && /диагностику/.test(e.message) ? "Сначала пройдите диагностику — маршрут строится по вашим ответам." : (e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rebuild = async () => {
    setBusy(true);
    try {
      const r = await v3<{ plan: PlanV3 }>("plan", { rebuild: true });
      if (r.plan.status !== "ready") setUnavailable(r.plan);
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (error) return <div className="space-y-4"><Notice tone="error">{error}</Notice><Button onClick={onRetake}>Пройти диагностику</Button></div>;
  if (!progress) return <p role="status">Проверяем, можно ли собрать ваш маршрут…</p>;

  if (unavailable || !progress.plan) {
    const plan = unavailable;
    return (
      <article aria-labelledby="route-title">
        <h1 id="route-title" className="font-display text-[clamp(28px,6vw,44px)] font-bold leading-tight">Мой маршрут</h1>
        <div className="mt-5"><Notice tone="warn"><p className="font-semibold">Маршрут из 30 шагов пока не готов.</p>{plan && <p className="mt-1">{humanize(plan.message)}</p>}</Notice></div>
        {plan && plan.gaps.length > 0 && plan.reason !== "no_approved_lessons" && (
          <div className={`${card} mt-5`}>
            <h2 className="text-lg font-bold">Чего не хватает</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {plan.gaps.map((g, i) => <li key={i}>{g.phase !== "total" ? `Этап «${PHASE_LABEL[g.phase]}»: ` : ""}{humanize(g.missing)}</li>)}
            </ul>
          </div>
        )}
        <p className={`mt-5 max-w-3xl leading-relaxed ${muted}`}>
          Шаги маршрута собираются только из проверенных уроков и заданий. Пока материалов недостаточно, мы не показываем
          условные или придуманные шаги. Карта задач и уроки, которые уже доступны, работают без маршрута.
        </p>
        <History items={progress.history} />
      </article>
    );
  }

  const p = progress as ActiveProgress;
  const { plan, summary } = p;
  const titles = lessonTitles(plan);
  const byPos = new Map(p.steps.map((s) => [s.position, s]));
  const resume = p.resumePosition ? plan.steps.find((s) => s.position === p.resumePosition) : null;
  const phases = [...new Set(plan.steps.map((s) => s.phase))];
  return (
    <article aria-labelledby="route-title">
      <h1 id="route-title" className="font-display text-[clamp(28px,6vw,44px)] font-bold leading-tight">Мой маршрут</h1>
      {fixtureMode && <div className="mt-4"><Notice tone="warn">Синтетическая тестовая библиотека: шаги собраны из тестовых заглушек для проверки интерфейса, а не из учебных материалов.</Notice></div>}
      <p className={`mt-3 leading-relaxed ${muted}`}>
        30 шагов в своём темпе — это не календарные дни. Режим практики: {VARIANT_LABEL[plan.variant]}. Занятия по {plan.sessionMinutes} минут.
      </p>

      {p.stale && (
        <div className="mt-5 space-y-3">
          <Notice tone="warn">
            <p className="font-semibold">Маршрут устарел — продолжить его нельзя.</p>
            <p className="mt-1">Причина: {p.staleReasons.map((r) => staleReasonText(r, titles)).join("; ")}.</p>
            <p className="mt-1">Ваши результаты сохранятся в истории, но не перенесутся в новый маршрут автоматически.</p>
          </Notice>
          <Button onClick={rebuild} disabled={busy}>{busy ? "Собираем…" : "Собрать новый маршрут"}</Button>
        </div>
      )}

      <div className={`${card} mt-5 space-y-4`}>
        <ProgressBar done={summary.done} total={summary.total} percent={summary.percent} />
        <p className={`text-[15px] ${muted}`}>Проверка пройдена: {summary.selfChecked} · изучается: {summary.inProgress} · не начато: {summary.notStarted}</p>
        {!p.stale && resume && (
          <Button onClick={() => onOpenStep(resume.position)}>
            {summary.done === 0 && byPos.get(resume.position)?.state === "not_started" ? "Начать" : "Продолжить"}: шаг {resume.position}
          </Button>
        )}
        {!p.stale && !resume && <p className="font-semibold">Все 30 шагов завершены.</p>}
      </div>

      {phases.map((ph) => (
        <section key={ph} aria-labelledby={`ph-${ph}`} className="mt-8">
          <h2 id={`ph-${ph}`} className="text-xl font-bold">{PHASE_LABEL[ph]}</h2>
          <ol className="mt-3 space-y-3">
            {plan.steps.filter((s) => s.phase === ph).map((s) => {
              const sp = byPos.get(s.position);
              return (
                <li key={s.stableId} className={card} data-step={s.position}>
                  <p className={`flex flex-wrap items-center gap-2 text-sm font-semibold ${muted}`}>
                    <span>Шаг {s.position} · занятие {s.session} · около {s.estimatedMinutes} мин</span>
                    <span className="rounded-full border border-graphite/40 px-2 py-0.5 text-graphite">{STATE_LABEL[sp?.state ?? "not_started"]}</span>
                  </p>
                  <h3 className="mt-1 text-lg font-bold leading-snug">{humanize(s.learningGoal)}</h3>
                  <p className="mt-2">{humanize(s.action)}</p>
                  <p className="mt-2 text-[15px]"><strong>Результат:</strong> {humanize(s.expectedArtifact)}</p>
                  <details className="mt-3">
                    <summary className="cursor-pointer font-semibold underline underline-offset-4">Критерии, ограничения и почему этот шаг</summary>
                    <div className="mt-2 space-y-2 text-[15px]">
                      <ul className="list-disc pl-5">{s.completionCriteria.map((c, i) => <li key={i}>{humanize(c)}</li>)}</ul>
                      <ul className="list-disc pl-5">{s.restrictions.map((c, i) => <li key={i}>{humanize(c)}</li>)}</ul>
                      {s.metric && <p><strong>Показатель:</strong> {s.metric.label} — {METRIC_KIND_LABEL[s.metric.kind]}.</p>}
                      <p>{s.why.text}</p>
                    </div>
                  </details>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button onClick={() => onOpenStep(s.position)}>{p.stale ? "Посмотреть шаг" : sp?.state === "done" ? "Открыть выполненный шаг" : "Перейти к шагу"}</Button>
                    <Button variant="secondary" onClick={() => onOpenLesson(s.lessonId)}>Урок: {cleanTitle(s.lessonTitle)}</Button>
                    {s.lessonTitle.startsWith("[SYNTHETIC FIXTURE]") && <Badge>Тестовая заглушка</Badge>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <History items={p.history} />
    </article>
  );
}
