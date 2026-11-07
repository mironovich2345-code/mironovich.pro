"use client";

import Link from "next/link";
import { buildActionPlan } from "@/lib/tools/action-plan";
import { calculateAutomation, type AutomationInput } from "@/lib/tools/automation";
import type { DiagnosisInput } from "@/lib/tools/diagnosis";
import type { LaborInput } from "@/lib/tools/labor";
import ToolLead from "./ToolLead";

const number = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
export default function AutomationResult({ input, diagnosis, labor, description, edit }: {
  input: AutomationInput; diagnosis: DiagnosisInput; labor?: LaborInput; description: string; edit: () => void;
}) {
  const plan = buildActionPlan(input, diagnosis, labor);
  const r = calculateAutomation(input, labor, undefined, diagnosis);
  const title = plan.recommendation.approach === "Готовый SaaS-сервис" ? "готовый сервис по подписке" : plan.recommendation.approach;
  return <section tabIndex={-1} aria-label="Результат подбора автоматизации" className="mx-auto max-w-[800px] scroll-mt-24 break-words border border-cream/20 p-5 text-cream min-[560px]:p-10">
    <p className="text-xs uppercase tracking-widest text-signal">Ваше решение · предварительный экспресс-план</p>
    <h2 className="font-display text-[clamp(26px,4vw,44px)] font-extrabold uppercase leading-tight">Вам, вероятнее всего, подойдёт: {title}</h2>
    <p className="text-base leading-relaxed text-stone">{plan.recommendation.reason}</p>
    <p className="mt-3 text-sm leading-relaxed text-stone">{plan.aiExplanation}</p>

    <div className="my-6 border-y border-cream/20 py-5">
      <h3 className="mb-4 text-xl">Какую проблему решаем</h3>
      <dl className="space-y-3 text-sm leading-relaxed">
        <div><dt className="text-stone">Процесс</dt><dd>{plan.process}</dd></div>
        <div><dt className="text-stone">Главная цель</dt><dd>{plan.goal}</dd></div>
        <div><dt className="text-stone">Программы и способ работы</dt><dd>{plan.systems.join(", ")}{diagnosis.programNames && <>. Указаны вами: {diagnosis.programNames}</>}</dd></div>
        <div><dt className="text-stone">Подход</dt><dd>{title}</dd></div>
      </dl>
    </div>

    <h3 className="mb-4 text-xl">План внедрения</h3>
    <ol className="list-decimal space-y-3 pl-6 text-sm leading-relaxed text-stone">{plan.steps.map(step => <li key={step}>{step}</li>)}</ol>
    <h3 className="mb-4 mt-7 text-xl">Что необходимо проверить</h3>
    <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-stone">{plan.checks.map(check => <li key={check}>{check}</li>)}</ul>
    <p className="mt-4 border-l-2 border-signal pl-4 text-sm leading-relaxed">{plan.uncertainty}</p>

    <div className="my-6 border-y border-cream/20 py-5">
      <h3 className="mb-4 text-xl">Экономический контекст</h3>
      {plan.economics ? <>
        <dl className="space-y-3 text-sm">
          <div><dt className="text-stone">Ручной труд сейчас</dt><dd>{number(plan.economics.monthlyHours)} ч/мес.</dd></div>
          <div><dt className="text-stone">Стоимость рабочего времени</dt><dd>{plan.economics.monthlyCost === null ? "Неизвестна" : `${number(plan.economics.monthlyCost)} ₽/мес.`}</dd></div>
          <div><dt className="text-stone">Потенциально высвобождаемое время по вашему сценарию</dt><dd>{number(plan.economics.freedHours)} ч/мес.</dd></div>
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-stone">Стоимость времени не равна гарантированной денежной экономии. Долю автоматизации и остаточную ручную работу нужно проверить пилотом.</p>
      </> : <p className="text-sm leading-relaxed text-stone">Ручной труд ещё не рассчитан. <Link className="inline-flex min-h-[44px] items-center text-cream underline" href="/tools/labor-cost">Рассчитать стоимость ручного труда</Link></p>}
    </div>

    <details className="my-6 border-b border-cream/20 pb-4 text-sm text-stone">
      <summary className="min-h-[44px] cursor-pointer text-cream">Подробнее о расчёте</summary>
      <p>Ориентировочная сложность: <strong>{r.complexity}</strong></p>
      {r.stages.length ? <dl>{r.stages.map(s => <div className="flex flex-wrap justify-between gap-2 py-2" key={s.name}><dt>{s.name}</dt><dd>{s.hours[0]}–{s.hours[1]} ч</dd></div>)}</dl> : <p>Состояние данных или нагрузка неизвестны: часы не подставляются автоматически.</p>}
      <p>Версия: {r.version}. Часы — предварительная инженерная гипотеза, не сроки и не оферта. Денежная модель пока не утверждена.</p>
    </details>
    <button className="min-h-[48px] text-sm underline" onClick={edit}>Изменить ответы</button>
    <ToolLead context={{ tool: "automation-cost", version: r.version, input, diagnosis, ...(labor ? { labor } : {}) }} description={description} actionPlan />
  </section>;
}
