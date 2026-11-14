import type {
  ConversationState,
  LiveProcess,
} from "../../../lib/business-map/dialog/contracts";
import {
  hasCapacityWarning,
  localPlan,
} from "../../../lib/business-map/dialog/engine";
import { approachNames } from "../../../lib/business-map/dialog/industry";
export default function Plan({
  state,
  process: p,
  aiReady,
  busy,
  onAi,
  onChoose,
}: {
  state: ConversationState;
  process: LiveProcess | null;
  aiReady: boolean;
  busy: boolean;
  onAi: () => void;
  onChoose: () => void;
}) {
  if (!p)
    return (
      <section className="bd-empty">
        <h1>Сначала выберите процесс</h1>
        <p>
          План появится после первой проверки гипотезы. Пока нет оснований
          назначить первый пилот.
        </p>
        <button className="bm-primary" onClick={onChoose}>
          Вернуться в диалог →
        </button>
      </section>
    );
  const capacity = hasCapacityWarning(p, state.company),
    ai = capacity ? undefined : state.advice[p.id],
    plan = ai ?? localPlan(p, state.company);
  return (
    <section className="bd-plan">
      <header className="bm-page-heading">
        <p className="bm-eyebrow">
          {ai ? "OpenAI · проверяемая гипотеза" : "Отраслевые правила · без ИИ"}
        </p>
        <h1>Первый шаг, который можно проверить</h1>
        <p>
          {p.name}.{" "}
          {p.result?.group === "first"
            ? "Приоритет подтверждён расчётным ядром; это кандидат для проверки, а не разрешение на запуск."
            : "Это план диагностики. Данных для уверенной рекомендации пилота пока недостаточно."}
        </p>
      </header>
      <div className="bd-plan-lead">
        <span>01</span>
        <div>
          <p className="bm-eyebrow">Предлагаемый подход</p>
          <h2>{approachNames[plan.approach]}</h2>
          <p>{plan.firstStep}</p>
        </div>
      </div>
      <div className="bd-plan-sections">
        <section>
          <h2>Гипотеза</h2>
          <p>{plan.problem}</p>
          <p>{plan.hypothesis}</p>
        </section>
        <section>
          <h2>Подготовка</h2>
          <ul>
            {plan.prepare.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Как измерить результат</h2>
          <ul>
            {plan.metrics.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p>
            Порог улучшения и допустимые ошибки согласуйте до пилота. Никаких
            придуманных процентов.
          </p>
        </section>
        <section>
          <h2>Риски и ограничения</h2>
          <ul>
            {plan.risks.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Когда продолжать</h2>
          <p>{plan.continueIf}</p>
        </section>
        <section>
          <h2>Когда остановиться</h2>
          <p>{plan.stopIf}</p>
        </section>
      </div>
      <div className="bm-callout">
        Любое решение требует проверки человеком. Возможности конкретной CRM не
        проверены. Стоимость высвобожденного времени не равна сокращению
        денежных расходов.
      </div>
      <button
        className="bm-secondary"
        disabled={!aiReady || busy || capacity}
        onClick={onAi}
      >
        {busy ? "Готовим объяснение…" : "Уточнить план с OpenAI"}
      </button>
      <p className="bm-muted">
        {capacity
          ? "Сначала проверьте объём работы и рабочий фонд. Объяснение ИИ не заменяет сверку исходных данных."
          : aiReady
            ? "Отправятся только название, подтверждённые текстовые факты и категория риска. Финансовые результаты модели не передаются."
            : "ИИ-консультант временно недоступен. Практический план по правилам уже доступен выше."}
      </p>
    </section>
  );
}
