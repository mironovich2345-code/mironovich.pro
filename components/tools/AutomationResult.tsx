"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buildActionPlan } from "@/lib/tools/action-plan";
import { calculateAutomation, type AutomationInput } from "@/lib/tools/automation";
import type { DiagnosisInput } from "@/lib/tools/diagnosis";
import type { LaborInput } from "@/lib/tools/labor";
import ToolLead from "./ToolLead";

const number = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
function ResultSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <details className="group border-b border-cream/20">
    <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 py-4 text-base text-cream [&::-webkit-details-marker]:hidden">
      <span className="min-w-0">{title}{note && <span className="ml-2 inline-block text-xs text-stone">{note}</span>}</span>
      <span aria-hidden="true" className="w-5 shrink-0 text-center text-2xl text-signal"><span className="group-open:hidden">+</span><span className="hidden group-open:inline">−</span></span>
    </summary>
    <div className="pb-5 text-sm leading-relaxed text-stone">{children}</div>
  </details>;
}

export default function AutomationResult({ input, diagnosis, labor, description, edit }: {
  input: AutomationInput; diagnosis: DiagnosisInput; labor?: LaborInput; description: string; edit: () => void;
}) {
  const plan = buildActionPlan(input, diagnosis, labor);
  const r = calculateAutomation(input, labor, undefined, diagnosis);
  const title = plan.recommendation.approach === "Готовый SaaS-сервис" ? "готовый сервис по подписке" : plan.recommendation.approach;
  return <section tabIndex={-1} aria-label="Результат подбора автоматизации" className="mx-auto max-w-[800px] scroll-mt-24 break-words border border-cream/20 p-5 text-cream min-[560px]:p-10">
    <p className="text-xs uppercase tracking-widest text-signal">Ваше решение</p>
    <h2 className="font-display text-[clamp(26px,4vw,44px)] font-extrabold uppercase leading-tight">{title}</h2>
    <p className="text-base leading-relaxed text-stone">{plan.recommendation.reason}</p>
    <p className="my-4 border-l-2 border-signal pl-4 text-sm leading-relaxed">{plan.uncertainty}</p>

    <div className="mt-5 border-t border-cream/20">
      <ResultSection title="Какую проблему решаем">
        <dl className="space-y-3 text-sm leading-relaxed text-cream">
          <div><dt className="text-stone">Процесс</dt><dd>{plan.process}</dd></div>
          <div><dt className="text-stone">Главная цель</dt><dd>{plan.goal}</dd></div>
          <div><dt className="text-stone">Программы и способ работы</dt><dd>{plan.systems.join(", ")}{diagnosis.programNames && <>. Указаны вами: {diagnosis.programNames}</>}</dd></div>
          <div><dt className="text-stone">Подход</dt><dd>{title}</dd></div>
        </dl>
      </ResultSection>

      <ResultSection title="План внедрения" note={`${plan.steps.length} шагов`}>
        <ol className="list-decimal space-y-3 pl-6 text-sm leading-relaxed text-stone">{plan.steps.map(step => <li key={step}>{step}</li>)}</ol>
      </ResultSection>
      <ResultSection title="Что необходимо проверить">
        <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-stone">{plan.checks.map(check => <li key={check}>{check}</li>)}</ul>
        <p className="mt-4">{plan.aiExplanation}</p>
      </ResultSection>

      <ResultSection title="Экономический контекст">
        {plan.economics ? <>
          <dl className="space-y-3 text-sm text-cream">
            <div><dt className="text-stone">Ручной труд сейчас</dt><dd>{number(plan.economics.monthlyHours)} ч/мес.</dd></div>
            <div><dt className="text-stone">Стоимость рабочего времени</dt><dd>{plan.economics.monthlyCost === null ? "Неизвестна" : `${number(plan.economics.monthlyCost)} ₽/мес.`}</dd></div>
            <div><dt className="text-stone">Потенциально высвобождаемое время по вашему сценарию</dt><dd>{number(plan.economics.freedHours)} ч/мес.</dd></div>
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-stone">Стоимость времени не равна гарантированной денежной экономии. Долю автоматизации и остаточную ручную работу нужно проверить пилотом.</p>
        </> : <p className="text-sm leading-relaxed text-stone">Ручной труд ещё не рассчитан. <Link className="inline-flex min-h-[44px] items-center text-cream underline" href="/tools/labor-cost">Рассчитать стоимость ручного труда</Link></p>}
      </ResultSection>

      <ResultSection title="Подробнее о расчёте">
        <p>Ориентировочная сложность: <strong>{r.complexity}</strong></p>
        {r.stages.length ? <dl>{r.stages.map(s => <div className="flex flex-wrap justify-between gap-2 py-2" key={s.name}><dt>{s.name}</dt><dd>{s.hours[0]}–{s.hours[1]} ч</dd></div>)}</dl> : <p>Состояние данных или нагрузка неизвестны: часы не подставляются автоматически.</p>}
        <p>Версия: {r.version}. Часы — предварительная инженерная гипотеза, не сроки и не оферта. Денежная модель пока не утверждена.</p>
      </ResultSection>
    </div>
    <ToolLead context={{ tool: "automation-cost", version: r.version, input, diagnosis, ...(labor ? { labor } : {}) }} description={description} actionPlan />
    <button type="button" className="mt-3 min-h-[48px] text-sm underline" onClick={edit}>Изменить ответы</button>
  </section>;
}

/** v2 cards deliberately contain catalog text, never model-authored financial claims. */
export function GuidedResultCards({ cards }: { cards: ReturnType<typeof import("@/lib/tools/catalog").recommendationCards> }) {
  return <div className="mt-7 grid gap-4 md:grid-cols-2">{cards.map((card,index)=><article key={card.task} className="min-w-0 break-words border border-cream/20 p-5"><p className="m-0 text-xs uppercase tracking-wider text-signal">{String(index+1).padStart(2,"0")} / {card.type}</p><h3 className="mt-2 text-xl font-semibold">{card.title}</h3><p className="text-sm text-stone">{card.problem}</p><p className="text-base leading-relaxed">{card.solution}</p><dl className="space-y-3 text-sm leading-relaxed">{[["Почему этот вариант",card.reason],["Что понадобится",card.requirements],["Что проверить",card.checks],["Как измерить эффект",card.measure],["Контроль",card.human]].map(([label,value])=><div key={label}><dt className="text-stone">{label}</dt><dd className="m-0">{value}</dd></div>)}</dl></article>)}</div>;
}
