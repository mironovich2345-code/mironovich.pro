"use client";
// "Мой маршрут": the state of the 30-step constructor. When approved material is insufficient the
// screen says so plainly and lists what is missing — it never renders placeholder steps.
import { useEffect, useState } from "react";
import type { PlanV3 } from "@/lib/career-v3/contracts";
import { humanize, METRIC_KIND_LABEL, PHASE_LABEL, VARIANT_LABEL } from "@/lib/career-v3/ui-flow";
import { ApiError, Badge, Button, Notice, card, muted, v3 } from "./primitives";

export default function RouteView({ onOpenLesson, onRetake, fixtureMode }: { onOpenLesson: (id: string) => void; onRetake: () => void; fixtureMode: boolean }) {
  const [plan, setPlan] = useState<PlanV3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void v3<{ plan: PlanV3 }>("plan", {}).then((r) => setPlan(r.plan)).catch((e) =>
      setError(e instanceof ApiError && e.status === 409 ? "Сначала пройдите диагностику — маршрут строится по вашим ответам." : e.message));
  }, []);
  if (error) return <div className="space-y-4"><Notice tone="error">{error}</Notice><Button onClick={onRetake}>Пройти диагностику</Button></div>;
  if (!plan) return <p role="status">Проверяем, можно ли собрать ваш маршрут…</p>;

  if (plan.status !== "ready") {
    return (
      <article aria-labelledby="route-title">
        <h1 id="route-title" className="font-display text-[clamp(28px,6vw,44px)] font-bold leading-tight">Мой маршрут</h1>
        <div className="mt-5"><Notice tone="warn"><p className="font-semibold">Маршрут из 30 шагов пока не готов.</p><p className="mt-1">{humanize(plan.message)}</p></Notice></div>
        {plan.gaps.length > 0 && plan.reason !== "no_approved_lessons" && (
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
      </article>
    );
  }

  const phases = [...new Set(plan.steps.map((s) => s.phase))];
  return (
    <article aria-labelledby="route-title">
      <h1 id="route-title" className="font-display text-[clamp(28px,6vw,44px)] font-bold leading-tight">Мой маршрут</h1>
      {fixtureMode && <div className="mt-4"><Notice tone="warn">Синтетическая тестовая библиотека: шаги собраны из тестовых заглушек для проверки интерфейса, а не из учебных материалов.</Notice></div>}
      <p className={`mt-3 leading-relaxed ${muted}`}>
        30 шагов в своём темпе — это не календарные дни. Режим практики: {VARIANT_LABEL[plan.variant]}. Занятия по {plan.sessionMinutes} минут.
      </p>
      {phases.map((ph) => (
        <section key={ph} aria-labelledby={`ph-${ph}`} className="mt-8">
          <h2 id={`ph-${ph}`} className="text-xl font-bold">{PHASE_LABEL[ph]}</h2>
          <ol className="mt-3 space-y-3">
            {plan.steps.filter((s) => s.phase === ph).map((s) => (
              <li key={s.stableId} className={card}>
                <p className={`text-sm font-semibold ${muted}`}>Шаг {s.position} · занятие {s.session} · около {s.estimatedMinutes} мин</p>
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
                  <Button variant="secondary" onClick={() => onOpenLesson(s.lessonId)}>Открыть урок: {s.lessonTitle.replace("[SYNTHETIC FIXTURE] ", "")}</Button>
                  {s.lessonTitle.startsWith("[SYNTHETIC FIXTURE]") && <Badge>Тестовая заглушка</Badge>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </article>
  );
}
