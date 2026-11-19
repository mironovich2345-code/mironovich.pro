"use client";
// "Мои результаты" (#47). Everything shown comes from the server: saved progress, mini-tests, training
// measurements with server-side comparisons, and the manager report built from those fields. The learner
// enters only numbers, dates, a unit and predefined checkboxes — no free text.
import { useCallback, useEffect, useState } from "react";
import {
  COMPARABILITY, COMPARABILITY_KEYS, INSUFFICIENT, conditionsFor, LIMITATIONS, UNIT_LABEL, UNIT_SHORT, fmtNum, tasksWord,
  type Comparison, type LimitationKey, type MeasurementInput, type Unit,
} from "@/lib/career-v3/results";
import { REPORT_KINDS, type Report, type ReportKind } from "@/lib/career-v3/report";
import { staleReasonText, VARIANT_LABEL, humanize } from "@/lib/career-v3/ui-flow";
import { ApiError, Badge, Button, Notice, Section, card, field, muted, PROFESSION, v3 } from "./primitives";
import { ProgressBar } from "./RouteView";
import { cleanTitle, type HistoryItem, type Summary } from "./progress-api";

type Slot = {
  position: number; stableId: string; lessonTitle: string; learningGoal: string;
  metric: { id: string; label: string; method: string; caveat: string; kind: string } | null;
  units: Unit[]; eligible: boolean; note: string | null; input: MeasurementInput | null; comparison: Comparison | null; revision: number; updatedAt: string | null;
};
type Lesson = { lessonId: string; title: string; status: "current" | "outdated" | "withdrawn"; stepsDone: number; stepsTotal: number; quiz: { passed: boolean; correct: number; total: number; attempts: number } | null };
type Results =
  | { plan: null; history: (HistoryItem & { measurements: number })[]; professionTitle: string }
  | {
    plan: { variant: string; builtOn: string }; professionTitle: string; libraryMode: string; stale: boolean; staleReasons: string[];
    summary: Summary; lessons: Lesson[]; measurements: Slot[]; history: (HistoryItem & { measurements: number })[];
  };
type Active = Extract<Results, { summary: Summary }>;

const LESSON_STATUS: Record<Lesson["status"], string> = { current: "Актуальная версия", outdated: "Урок обновлён после прохождения", withdrawn: "Урок снят с выдачи" };
const todayIso = () => new Date().toISOString().slice(0, 10);
const ru = (iso: string) => iso.split("-").reverse().join(".");

export default function ResultsView({ onRoute }: { onRoute: () => void }) {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setData(await v3<Results>("results")); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p role="status">Собираем ваши результаты…</p>;
  const title = <h1 id="results-title" className="font-display text-[clamp(28px,6vw,44px)] font-bold leading-tight">Мои результаты</h1>;
  if (!data.plan) {
    return (
      <article aria-labelledby="results-title">
        {title}
        <div className="mt-5"><Notice>Результаты появятся, когда будет собран маршрут и вы начнёте проходить шаги.</Notice></div>
        <div className="mt-4"><Button onClick={onRoute}>Открыть «Мой маршрут»</Button></div>
        <History items={data.history} />
      </article>
    );
  }
  const d = data as Active;
  const studied = d.lessons.filter((l) => l.stepsDone > 0 || l.quiz);
  return (
    <article aria-labelledby="results-title">
      {title}
      <p className={`mt-3 max-w-3xl leading-relaxed ${muted}`}>
        Здесь собрано то, что вы прошли и измерили на учебных задачах. Отметки о выполнении — ваша самопроверка по критериям уроков, а не объективное
        подтверждение профессионального навыка. Учебные замеры не доказывают изменений выручки, конверсии или продлений.
      </p>
      {d.libraryMode === "synthetic_fixture" && <div className="mt-4"><Notice tone="warn">Тестовая библиотека-заглушка: результаты сформированы для проверки интерфейса.</Notice></div>}
      {d.stale && (
        <div className="mt-4"><Notice tone="warn"><strong>Материалы обновились:</strong> {d.staleReasons.map((r) => staleReasonText(r)).join("; ")}. Результаты ниже относятся к прежней версии маршрута; новые замеры вносятся после сборки нового маршрута.</Notice></div>
      )}

      <div className={`${card} mt-5 space-y-2`}>
        <ProgressBar done={d.summary.done} total={d.summary.total} percent={d.summary.percent} />
        <p className={`text-[15px] ${muted}`}>Режим практики: {VARIANT_LABEL[d.plan.variant]}.</p>
      </div>

      <Section title="Пройденные уроки и мини-тесты" id="lessons-done">
        {studied.length === 0 ? <p>Пока нет завершённых шагов.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {studied.map((l) => (
              <li key={l.lessonId} className={card}>
                <p className="font-bold leading-snug">{cleanTitle(l.title)}</p>
                <p className="mt-1 text-[15px]">Завершено шагов: {l.stepsDone} из {l.stepsTotal}</p>
                <p className="text-[15px]">Мини-тест: {l.quiz ? (l.quiz.passed ? `пройден (попыток: ${l.quiz.attempts})` : `не пройден, верно ${l.quiz.correct} из ${l.quiz.total}`) : "не начат"}</p>
                {l.status !== "current" && <p className="mt-2"><Badge>{LESSON_STATUS[l.status]}</Badge></p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Учебные замеры «было → стало»" id="measurements">
        <p className={`max-w-3xl leading-relaxed ${muted}`}>
          Замер вносится к шагам этапов «Измерение» и «Ценность». Сравнение показывается только для учебных показателей, при одинаковых условиях
          и не меньше чем трёх задачах в каждом замере. Иначе — «{INSUFFICIENT}».
        </p>
        {d.measurements.length === 0 ? <p>В вашем маршруте нет шагов с замером.</p> : d.measurements.map((s) => (
          <MeasurementCard key={s.position} slot={s} readOnly={d.stale} onSaved={load} />
        ))}
      </Section>

      <ReportBuilder />
      <History items={d.history} />
    </article>
  );
}

function History({ items }: { items: (HistoryItem & { measurements: number })[] }) {
  if (!items.length) return null;
  return (
    <Section title="История прежних маршрутов" id="results-history">
      <ul className="space-y-2 text-[15px]">
        {items.map((h, i) => (
          <li key={i} className={card}>
            Маршрут от {new Date(h.createdAt).toLocaleDateString("ru-RU")}: завершено {h.done} из {h.total} шагов, замеров: {h.measurements}.
            {h.reasons.length > 0 && <span className={muted}> Заменён, потому что {h.reasons.map((r) => staleReasonText(r)).join("; ")}. Результаты не перенесены в новый маршрут.</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

type PointForm = { value: string; sampleSize: string; measuredOn: string };
const emptyPoint: PointForm = { value: "", sampleSize: "", measuredOn: "" };
const toForm = (p: { value: number; sampleSize: number; measuredOn: string } | null): PointForm => (p ? { value: String(p.value), sampleSize: String(p.sampleSize), measuredOn: p.measuredOn } : emptyPoint);

function MeasurementCard({ slot, readOnly, onSaved }: { slot: Slot; readOnly: boolean; onSaved: () => Promise<void> }) {
  const i = slot.input;
  const [unit, setUnit] = useState<Unit>(i?.unit ?? slot.units[0] ?? "count");
  const [baseline, setBaseline] = useState<PointForm>(toForm(i?.baseline ?? null));
  const [after, setAfter] = useState<PointForm>(toForm(i?.after ?? null));
  const [review, setReview] = useState(i?.reviewMinutes?.toString() ?? "");
  const [fix, setFix] = useState(i?.fixMinutes?.toString() ?? "");
  const [errorsFound, setErrorsFound] = useState(i?.errorsFound?.toString() ?? "");
  const [conditions, setConditions] = useState<Record<string, boolean>>(i?.conditions ?? Object.fromEntries(COMPARABILITY_KEYS.map((k) => [k, false])));
  const [limits, setLimits] = useState<LimitationKey[]>(i?.limitations ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const id = `m${slot.position}`;

  if (!slot.metric) return null;
  if (!slot.eligible) {
    return (
      <div className={card}>
        <p className={`text-sm font-semibold ${muted}`}>Шаг {slot.position}</p>
        <h3 className="font-bold">{slot.metric.label}</h3>
        <p className="mt-2 text-[15px]">{slot.note}. {slot.metric.caveat}.</p>
      </div>
    );
  }
  const point = (p: PointForm, what: string) => {
    const filled = [p.value, p.sampleSize, p.measuredOn].filter((x) => x !== "").length;
    if (filled === 0) return null;
    if (filled < 3) throw new Error(`${what}: заполните значение, число задач и дату — или оставьте все три поля пустыми`);
    return { value: Number(p.value.replace(",", ".")), sampleSize: Number(p.sampleSize), measuredOn: p.measuredOn };
  };
  const optional = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
  const save = async () => {
    setBusy(true); setMessage(null);
    try {
      const measurement = {
        unit, baseline: point(baseline, "Было"), after: point(after, "Стало"),
        reviewMinutes: unit === "minutes" ? optional(review) : null, fixMinutes: unit === "minutes" ? optional(fix) : null, errorsFound: optional(errorsFound),
        conditions: Object.fromEntries(conditionsFor(unit).map((k) => [k, !!conditions[k]])), limitations: limits,
      };
      await v3(`results/measurements/${slot.position}`, { stableId: slot.stableId, metricId: slot.metric!.id, measurement });
      await onSaved();
      setMessage({ tone: "info", text: "Замер сохранён." });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof ApiError || e instanceof Error ? e.message : "Не удалось сохранить замер" });
    } finally { setBusy(false); }
  };
  const u = UNIT_SHORT[unit];
  const pointFields = (label: string, p: PointForm, set: (p: PointForm) => void, key: string) => (
    <fieldset className="rounded-md border border-graphite/20 bg-white p-3" disabled={readOnly}>
      <legend className="px-1 font-semibold">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-[15px]">Значение, {u}
          <input className={`${field} mt-1`} type="number" inputMode="decimal" min={0} max={unit === "percent" ? 100 : 1000} step="0.1" value={p.value} onChange={(e) => set({ ...p, value: e.target.value })} id={`${id}-${key}-v`} />
        </label>
        <label className="block text-[15px]">Число задач
          <input className={`${field} mt-1`} type="number" inputMode="numeric" min={1} max={100} step="1" value={p.sampleSize} onChange={(e) => set({ ...p, sampleSize: e.target.value })} />
        </label>
        <label className="block text-[15px]">Дата замера
          <input className={`${field} mt-1`} type="date" max={todayIso()} value={p.measuredOn} onChange={(e) => set({ ...p, measuredOn: e.target.value })} />
        </label>
      </div>
    </fieldset>
  );
  return (
    <div className={card} data-measurement={slot.position}>
      <p className={`text-sm font-semibold ${muted}`}>Шаг {slot.position} · {cleanTitle(slot.lessonTitle)}</p>
      <h3 className="mt-1 text-lg font-bold leading-snug">{slot.metric.label}</h3>
      <p className="mt-1 text-[15px]"><strong>Что измеряется:</strong> {slot.metric.method}. <span className={muted}>{slot.metric.caveat}.</span></p>
      <p className={`mt-1 text-[15px] ${muted}`}>Цель шага: {humanize(slot.learningGoal)}</p>

      <div className="mt-4 space-y-3">
        {slot.units.length > 1 && (
          <label className="block max-w-xs font-semibold">Единица измерения
            <select className={`${field} mt-1`} value={unit} disabled={readOnly} onChange={(e) => setUnit(e.target.value as Unit)}>
              {slot.units.map((x) => <option key={x} value={x}>{UNIT_LABEL[x]}</option>)}
            </select>
          </label>
        )}
        {pointFields("Было — исходный замер", baseline, setBaseline, "b")}
        {pointFields(unit === "minutes" ? "Стало — минуты работы без проверки" : "Стало — повторный замер", after, setAfter, "a")}
        <fieldset className="grid gap-3 sm:grid-cols-3" disabled={readOnly}>
          <legend className="sr-only">Проверка и ошибки</legend>
          {unit === "minutes" && <>
            <label className="block text-[15px]">Время проверки, мин
              <input className={`${field} mt-1`} type="number" inputMode="decimal" min={0} max={600} step="0.1" value={review} onChange={(e) => setReview(e.target.value)} />
            </label>
            <label className="block text-[15px]">Время исправления, мин
              <input className={`${field} mt-1`} type="number" inputMode="decimal" min={0} max={600} step="0.1" value={fix} onChange={(e) => setFix(e.target.value)} />
            </label>
          </>}
          <label className="block text-[15px]">Найдено ошибок при проверке
            <input className={`${field} mt-1`} type="number" inputMode="numeric" min={0} max={1000} step="1" value={errorsFound} onChange={(e) => setErrorsFound(e.target.value)} />
          </label>
        </fieldset>
        <fieldset disabled={readOnly}>
          <legend className="font-semibold">Условия сопоставимости</legend>
          <div className="mt-2 space-y-2">
            {conditionsFor(unit).map((k) => (
              <label key={k} className="flex items-start gap-3 text-[15px] leading-snug">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#0E0E11]" checked={!!conditions[k]} onChange={() => setConditions({ ...conditions, [k]: !conditions[k] })} />
                <span>{COMPARABILITY[k]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={readOnly}>
          <legend className="font-semibold">Ограничения, которые вы видите</legend>
          <div className="mt-2 space-y-2">
            {(Object.keys(LIMITATIONS) as LimitationKey[]).map((k) => (
              <label key={k} className="flex items-start gap-3 text-[15px] leading-snug">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#0E0E11]" checked={limits.includes(k)} onChange={() => setLimits(limits.includes(k) ? limits.filter((x) => x !== k) : [...limits, k])} />
                <span>{LIMITATIONS[k]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {!readOnly && <Button variant="secondary" disabled={busy} onClick={save}>{busy ? "Сохраняем…" : slot.revision ? "Обновить замер" : "Сохранить замер"}</Button>}
        <div aria-live="polite">{message && <Notice tone={message.tone === "error" ? "error" : "info"}>{message.text}</Notice>}</div>
      </div>
      {slot.comparison && <ComparisonView c={slot.comparison} input={slot.input!} />}
    </div>
  );
}

function ComparisonView({ c, input }: { c: Comparison; input: MeasurementInput }) {
  if (c.status === "insufficient") {
    return (
      <div className="mt-4 rounded-md border-l-4 border-signal/70 bg-[#FBF6EC] p-4" data-comparison="insufficient">
        <p className="font-semibold">{INSUFFICIENT}</p>
        <ul className="mt-1 list-disc pl-5 text-[15px]">{c.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </div>
    );
  }
  const u = UNIT_SHORT[c.unit];
  return (
    <div className="mt-4 rounded-md border-l-4 border-graphite bg-white p-4" data-comparison="ok">
      <p className="font-semibold">Расчёт на учебных данных</p>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-[15px] sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">Было</dt><dd>{fmtNum(c.baseline)} {u} · {tasksWord(input.baseline!.sampleSize)} · {ru(input.baseline!.measuredOn)}</dd>
        <dt className="font-semibold">Стало</dt>
        <dd>{c.afterParts ? `${fmtNum(c.afterParts.work)} + ${fmtNum(c.afterParts.review)} + ${fmtNum(c.afterParts.fix)} = ` : ""}{fmtNum(c.after)} {u} · {tasksWord(input.after!.sampleSize)} · {ru(input.after!.measuredOn)}{c.afterParts ? " (работа + проверка + исправление)" : ""}</dd>
        <dt className="font-semibold">Разница</dt><dd>{fmtNum(c.after)} − {fmtNum(c.baseline)} = {fmtNum(c.absDiff)} {u}</dd>
        {c.percentagePoints !== null
          ? <><dt className="font-semibold">Разница долей</dt><dd>{fmtNum(c.percentagePoints)} п. п. (процентных пунктов)</dd></>
          : null}
        <dt className="font-semibold">В процентах</dt>
        <dd>{c.relative.value !== null ? `${fmtNum(c.absDiff)} / ${fmtNum(c.baseline)} × 100 = ${fmtNum(c.relative.value)}% от «было»` : c.relative.explanation}</dd>
      </dl>
      <p className={`mt-2 text-[15px] ${muted}`}>{c.caveats.join(". ")}.</p>
    </div>
  );
}

function ReportBuilder() {
  const [kind, setKind] = useState<ReportKind>("results");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCopied(false);
    void v3<Report>(`results/report?kind=${kind}`).then(setReport).catch((e) => setError(e.message));
  }, [kind]);
  return (
    <Section title="Кейс для руководителя" id="report">
      <p className={`max-w-3xl leading-relaxed ${muted}`}>Отчёт собирается только из ваших сохранённых учебных результатов. Проверьте текст перед отправкой: в нём нет обещаний и выводов, которых не подтверждают замеры.</p>
      <fieldset>
        <legend className="font-semibold">Вид отчёта</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {REPORT_KINDS.map((k) => (
            <label key={k.id} className="flex items-center gap-2 text-[15px]">
              <input type="radio" name="report-kind" className="h-4 w-4 accent-[#0E0E11]" checked={kind === k.id} onChange={() => setKind(k.id)} />{k.label}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      {report && (
        <div className={card} data-report={report.kind}>
          <h3 className="text-lg font-bold">{report.title}</h3>
          <ul className={`mt-2 space-y-1 text-[14px] ${muted}`}>{report.notice.map((n, i) => <li key={i}>{n}</li>)}</ul>
          {report.sections.map((s) => (
            <div key={s.heading} className="mt-4">
              <h4 className="font-bold">{s.heading}</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">{s.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </div>
          ))}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={() => { void navigator.clipboard?.writeText(report.text).then(() => setCopied(true)).catch(() => setCopied(false)); }}>Скопировать текст</Button>
            <a className="inline-flex min-h-11 items-center rounded-md border border-graphite/60 px-4 text-[15px] font-semibold hover:border-signal"
              href={`/api/career/v3/${PROFESSION}/results/report.pdf?kind=${report.kind}`} download>Скачать PDF</a>
            <span role="status" className="text-sm">{copied ? "Текст скопирован" : ""}</span>
          </div>
        </div>
      )}
    </Section>
  );
}
