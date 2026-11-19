"use client";
// "Моя карта задач": built by the engine from the saved diagnostic and the role matrix.
// Shows where each conclusion comes from; self-reported answers are bases for development,
// not confirmed skills. No internal IDs or rule names are rendered.
import { useEffect, useState } from "react";
import type { TaskMapV3 } from "@/lib/career-v3/contracts";
import { answerLabel, humanize, METRIC_KIND_LABEL, type Questionnaire } from "@/lib/career-v3/ui-flow";
import { ApiError, Badge, Button, Notice, Section, card, muted, v3 } from "./primitives";

const lower = (t: string) => (t ? t[0].toLowerCase() + t.slice(1) : t);
type Diagnostic = { result: null | { profile: { subtype: string; level: string; workAreas: string[] }; company: { policy: string; aiTools: string[]; dataTypes: string[] } }; stale: boolean };

export default function TaskMapView({ onRetake, onRoute }: { onRetake: () => void; onRoute: () => void }) {
  const [map, setMap] = useState<TaskMapV3 | null>(null);
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [questions, d] = await Promise.all([v3<Questionnaire>("diagnostic/questions"), v3<Diagnostic>("diagnostic")]);
        setQ(questions); setDiag(d);
        if (!d.result) return;
        const built = await v3<{ taskMap: TaskMapV3 }>("task-map", {});
        setMap(built.taskMap);
      } catch (e) {
        setError(e instanceof ApiError && e.status === 409 ? "Анкета обновилась — пройдите диагностику заново, чтобы карта соответствовала новой версии." : e instanceof Error ? e.message : "Не удалось построить карту");
      }
    })();
  }, []);

  if (error) return <div className="space-y-4"><Notice tone="error">{error}</Notice><Button onClick={onRetake}>Пройти диагностику</Button></div>;
  if (diag && !diag.result) return <div className="space-y-4"><Notice>Карта появится после диагностики.</Notice><Button onClick={onRetake}>Пройти диагностику</Button></div>;
  if (!map || !q || !diag?.result) return <p role="status">Строим вашу карту задач…</p>;

  const names = Object.fromEntries(map.tasks.map((t) => [t.taskId, t.title]));
  const r = diag.result;
  const label = (id: string, v: string | string[]) => answerLabel(q, id, v);
  return (
    <article aria-labelledby="map-title">
      <h1 id="map-title" className="font-display text-[clamp(28px,6vw,44px)] font-bold leading-tight">Моя карта задач</h1>
      <p className={`mt-3 max-w-3xl leading-relaxed ${muted}`}>
        Карта построена по вашим ответам анкеты и матрице профессии «Менеджер по продажам». Она показывает, где ИИ может помогать
        уже сейчас и что остаётся вашей ответственностью. Это не оценка ваших профессиональных навыков и не прогноз.
      </p>

      <Section title="Чем вы занимаетесь" id="profile">
        <div className={card}>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className={`text-sm font-semibold ${muted}`}>Специализация</dt><dd>{label("Q01", r.profile.subtype) !== "—" ? label("Q01", r.profile.subtype) : label("F02", r.profile.subtype)}</dd></div>
            <div><dt className={`text-sm font-semibold ${muted}`}>Уровень подготовки</dt><dd>{map.level.label}</dd></div>
            <div className="sm:col-span-2"><dt className={`text-sm font-semibold ${muted}`}>Направления работы</dt><dd>{label("Q03", r.profile.workAreas)}</dd></div>
          </dl>
          <p className={`mt-3 text-[15px] ${muted}`}>{map.level.description}</p>
          <p className="mt-3 text-[13px] font-semibold">Основание: ваши ответы на вопросы о специализации, самостоятельности и направлениях работы.</p>
        </div>
      </Section>

      <Section title="Ваши задачи и роль ИИ" id="tasks">
        {map.status !== "ready" && <Notice>{map.fallback?.message ?? "Вы не выбрали конкретные задачи. Начнём с учебного примера и уточним задачи позже."}</Notice>}
        {map.tasks.map((t) => (
          <div key={t.taskId} className={card}>
            <h3 className="text-lg font-bold leading-snug">{t.title}</h3>
            <p className="mt-2 font-semibold">{t.decisionLabel.replace(/^По матрице профессии: /, "")}</p>
            <p className="mt-1 text-[15px]">{t.workUseLabel}</p>
            {t.basis.tightenedBySafety && <p className="mt-2"><Badge>Ограничено правилами безопасности</Badge></p>}
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold underline underline-offset-4">Почему так и что проверять</summary>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
                <p><strong>Обоснование из матрицы профессии.</strong> {t.basis.modeMeaning}. Ваша ответственность: {lower(t.basis.humanResponsibility)}.</p>
                {t.companyRestrictions.length > 0 && (<div><strong>Ограничения по вашим ответам о компании</strong><ul className="mt-1 list-disc pl-5">{t.companyRestrictions.map((x, i) => <li key={i}>{humanize(x, names)}</li>)}</ul></div>)}
                <div><strong>Риски</strong><ul className="mt-1 list-disc pl-5">{t.risks.map((x, i) => <li key={i}>{humanize(x, names)}</li>)}</ul></div>
                <div><strong>Обязательные проверки</strong><ul className="mt-1 list-disc pl-5">{t.mandatoryChecks.map((x, i) => <li key={i}>{humanize(x, names).replace(/за: ([А-ЯЁ])/, (_m, ch) => "за: " + ch.toLowerCase())}</li>)}</ul></div>
                {t.skill && <p><strong>Навык:</strong> {t.skill.name} — {t.skill.why}.</p>}
                {t.metric && <p><strong>Как увидеть прогресс:</strong> {t.metric.label} — {METRIC_KIND_LABEL[t.metric.kind]}.</p>}
                <p><strong>Уроки:</strong> {t.lessonRefs.length ? t.lessonRefs.map((l) => l.title.replace("[SYNTHETIC FIXTURE] ", "")).join("; ") : "утверждённых уроков по этой задаче пока нет."}</p>
              </div>
            </details>
          </div>
        ))}
      </Section>

      <Section title="На что можно опереться" id="basis">
        <div className={card}>
          <p className={`text-[15px] ${muted}`}>{map.developmentBasis.note}</p>
          {map.developmentBasis.items.length > 0 && (
            <ul className="mt-3 space-y-2">
              {map.developmentBasis.items.map((b) => {
                const [qid, raw = ""] = b.answer.split(": ");
                const vals = raw.split(",");
                return (
                  <li key={b.id} className="rounded-md border border-graphite/15 bg-white/70 p-3">
                    <p>{b.label}</p>
                    <p className={`mt-1 text-[13px] ${muted}`}>Основание — ваш ответ: «{answerLabel(q, qid, vals.length > 1 ? vals : vals[0])}»</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Какие навыки развивать" id="growth">
        <ul className="grid gap-3 sm:grid-cols-2">
          {map.growthSkills.map((g) => (
            <li key={g.skillId} className={card}>
              <h3 className="font-bold">{g.name}</h3>
              <p className={`mt-1 text-[15px] ${muted}`}>{g.why}</p>
              <p className="mt-2 text-[14px]"><strong>Почему рекомендуем:</strong> {g.reasons.map((x) => humanize(x, names)).join("; ")}.</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Учебный маршрут" id="route-state">
        {map.learningRoute.status === "available"
          ? <Notice>Для вашего профиля есть утверждённые материалы. Откройте маршрут, чтобы увидеть шаги.</Notice>
          : <Notice tone="warn">{map.learningRoute.message ?? "Учебный маршрут пока не готов."}</Notice>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={onRoute}>Открыть «Мой маршрут»</Button>
          <Button variant="secondary" onClick={onRetake}>Изменить ответы анкеты</Button>
        </div>
      </Section>
    </article>
  );
}
