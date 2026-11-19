"use client";
// Lesson materials catalogue: everything optional or long — templates, prompts, files, sources — grouped and
// collapsed, plus the lesson's safety rules (always visible). The long full lesson text is one link away.
import { useEffect, useMemo, useState } from "react";
import { humanize, lessonNames } from "@/lib/career-v3/ui-flow";
import { ApiError, Button, Notice, PROFESSION, muted, v3 } from "./primitives";
import { Template } from "./LessonView";

type Material = {
  id: string; title: string;
  content: { templates: { id: string; title: string; kind: string; body: string; prohibitedInputs: string[] }[]; [k: string]: unknown };
  security: { forbiddenInputs: string[]; ifToolForbidden: string; errorEscalation: string };
  sources: { id: string; title: string; url: string; checkedOn: string }[];
  downloads: { id: string; title: string; kind: string }[];
};
const GROUPS: { title: string; kinds: string[] }[] = [
  { title: "Чек-листы и шаблоны", kinds: ["checklist", "script", "template", "table"] },
  { title: "Листы замеров", kinds: ["measurement_sheet"] },
  { title: "Промпты для разрешённого ИИ", kinds: ["prompt"] },
];

export default function LessonMaterials({ lessonId, onBack, onFullLesson }: { lessonId: string; onBack: () => void; onFullLesson: () => void }) {
  const [l, setL] = useState<Material | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { v3<{ lesson: Material }>(`lessons/${lessonId}`).then((r) => setL(r.lesson)).catch((e) => setError(e instanceof ApiError ? e.message : "Материалы не загрузились")); }, [lessonId]);
  const names = useMemo(() => (l ? lessonNames(l as never) : {}), [l]);
  if (error) return <div className="space-y-4"><Notice tone="error">{error}</Notice><Button variant="secondary" onClick={onBack}>Вернуться к уроку</Button></div>;
  if (!l) return <p role="status">Загружаем материалы…</p>;
  const h = (t: string) => humanize(t, names);
  const known = new Set(GROUPS.flatMap((g) => g.kinds));
  const groups = [...GROUPS, { title: "Другие материалы", kinds: [...new Set(l.content.templates.map((t) => t.kind).filter((k) => !known.has(k)))] }]
    .map((g) => ({ ...g, items: l.content.templates.filter((t) => g.kinds.includes(t.kind)) })).filter((g) => g.items.length);
  return (
    <article aria-labelledby="materials-title">
      <Button variant="quiet" onClick={onBack}>← Вернуться к уроку</Button>
      <h1 id="materials-title" className="mt-3 font-display text-[clamp(26px,6vw,40px)] font-bold leading-tight">Материалы урока</h1>
      <p className={`mt-1 ${muted}`}>{l.title}</p>

      <section aria-labelledby="mat-safety" className="mt-6 rounded-md border-l-4 border-signal bg-white/80 p-4">
        <h2 id="mat-safety" className="text-lg font-bold">Правила безопасности</h2>
        <p className="mt-2 text-[15px] font-semibold">Не вставляйте в ИИ:</p>
        <ul className="mt-1 space-y-1 pl-5 text-[15px] leading-relaxed [list-style:disc]">{l.security.forbiddenInputs.map((x) => <li key={x}>{h(x)}</li>)}</ul>
        <p className="mt-3 text-[15px] leading-relaxed"><strong>Если ИИ запрещён:</strong> {h(l.security.ifToolForbidden)}</p>
        <p className="mt-2 text-[15px] leading-relaxed"><strong>Если что-то пошло не так:</strong> {h(l.security.errorEscalation)}</p>
      </section>

      {groups.map((g) => (
        <section key={g.title} aria-labelledby={`mat-${g.title}`} className="mt-7">
          <h2 id={`mat-${g.title}`} className="text-lg font-bold">{g.title} <span className={`text-[15px] font-normal ${muted}`}>· {g.items.length}</span></h2>
          <div className="mt-2 space-y-2">
            {g.items.map((t) => (
              <details key={t.id} className="rounded-md border border-graphite/20 bg-white/70 p-3">
                <summary className="cursor-pointer text-[15px] font-semibold">{h(t.title)}</summary>
                <div className="mt-3"><Template t={t} /></div>
              </details>
            ))}
          </div>
        </section>
      ))}

      {l.downloads.length > 0 && (
        <section aria-labelledby="mat-files" className="mt-7">
          <h2 id="mat-files" className="text-lg font-bold">Файлы для скачивания</h2>
          <ul className="mt-2 space-y-2">
            {l.downloads.map((d) => <li key={d.id}><a className="font-semibold underline underline-offset-4 hover:text-signal" href={`/api/career/v3/${PROFESSION}/lessons/${l.id}/downloads/${d.id}`} download>{h(d.title)}</a></li>)}
          </ul>
        </section>
      )}
      {l.sources.length > 0 && (
        <section aria-labelledby="mat-sources" className="mt-7">
          <h2 id="mat-sources" className="text-lg font-bold">Источники</h2>
          <ul className="mt-2 space-y-1.5 text-[15px]">
            {l.sources.map((s) => <li key={s.id}><a className="underline underline-offset-4" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> <span className={muted}>(проверено {s.checkedOn.split("-").reverse().join(".")})</span></li>)}
          </ul>
        </section>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onBack}>Вернуться к уроку</Button>
        <Button variant="quiet" onClick={onFullLesson}>Полный текст урока одной страницей</Button>
      </div>
    </article>
  );
}
