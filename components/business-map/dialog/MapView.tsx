import type {
  ConversationState,
  LiveProcess,
} from "../../../lib/business-map/dialog/contracts";
import {
  approachNames,
  industryNames,
  scenarioById,
} from "../../../lib/business-map/dialog/industry";
import {
  insight,
  processStatus,
  statusNames,
} from "../../../lib/business-map/dialog/engine";
import {
  bands,
  fieldNames,
  freedRange,
  paybackText,
  rubles,
  show,
  systemNames,
} from "../presentation";
import Glyph from "./Glyph";
export const missingNames: Record<string, string> = {
  ...fieldNames,
  scope: "Объём команды или сотрудника",
  period: "Период операций",
  employees: "Число участников",
  operations: "Частота операций команды",
  minutes: "Длительность выполнения",
};
export default function MapView({
  state,
  onOpen,
  onFocus,
  compact = false,
}: {
  state: ConversationState;
  onOpen: (id: string) => void;
  onFocus: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <section
      aria-label="Живая карта процессов"
      className={compact ? "bd-map bd-map-compact" : "bd-map"}
    >
      <header className="bd-section-head">
        <div>
          <p className="bm-eyebrow">Живая карта</p>
          <h2>От слов к процессам</h2>
        </div>
        <span>{state.processes.length} / 5</span>
      </header>
      {state.industry && (
        <p className="bm-muted">
          {industryNames[state.industry]}
          {state.locations !== null
            ? ` · Подразделений: ${state.locations}`
            : ""}
          {state.systems.length
            ? ` · ${state.systems.map((s) => systemNames[s] ?? s).join(", ")}`
            : ""}
        </p>
      )}
      {state.systemMentions.length > 0 && (
        <p className="bm-muted">
          Упомянутое ПО: {state.systemMentions.join("; ")}. Возможности и категория программы не проверены.
        </p>
      )}
      {!state.processes.length ? (
        <div className="bd-map-empty">
          <span>01—05</span>
          <p>
            Здесь появятся процессы из разговора. До подтверждения — только
            гипотезы.
          </p>
        </div>
      ) : (
        <ol className="bd-processes">
          {state.processes.map((p, i) => {
            const q = insight(p, state.company),
              s = scenarioById(p.scenarioId),
              status = processStatus(p, state.company);
            return (
              <li key={p.id} className={`bd-process bd-process-${status}`}>
                <div className="bd-process-head">
                  <span className="bd-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={`bd-status bd-status-${status}`}>
                    {statusNames[status]}
                  </span>
                </div>
                <h3>
                  <button onClick={() => onOpen(p.id)}>
                    {p.name}
                    <span>
                      <Glyph />
                    </span>
                  </button>
                </h3>
                <p>
                  {p.confirmed === true
                    ? "Ручная работа подтверждена вами."
                    : p.confirmed === false
                      ? "Проблема не подтвердилась."
                      : s.problem}
                </p>
                {(p.result?.hours || q.hours) && (
                  <strong className="bd-hours">
                    {show(p.result?.hours ?? q.hours)}{" "}
                    <small>ч/мес. сейчас</small>
                  </strong>
                )}
                {!compact && (
                  <>
                    <dl className="bd-map-metrics">
                      <dt>Стоимость труда</dt>
                      <dd>{rubles(p.result?.timeCost ?? q.timeCost)}</dd>
                      <dt>Потенциал времени</dt>
                      <dd>
                        {p.result
                          ? freedRange(p.result)
                          : "Нужны условия процесса"}
                      </dd>
                      <dt>Следующий подход</dt>
                      <dd>
                        {
                          approachNames[
                            p.error === "critical" || p.confirmed === false
                              ? "wait"
                              : q.solution
                          ]
                        }
                      </dd>
                    </dl>
                    {p.facts.length > 0 && (
                      <details>
                        <summary>Подтверждённые вами сведения</summary>
                        <ul>
                          {p.facts.map((f, j) => (
                            <li key={j}>{f}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <p>
                      {p.error === "critical"
                        ? "Критическая цена ошибки. Нужен специалист."
                        : q.firstAction}
                    </p>
                    <p className="bm-muted">
                      Уточнить:{" "}
                      {(p.result?.missing ?? q.missing)
                        .map((k) => missingNames[k] ?? k)
                        .join(", ") ||
                        "нет пробелов в расчёте времени; для пилота проверьте пригодность"}
                      .
                    </p>
                    {p.result && (
                      <p className="bm-muted">
                        Риск:{" "}
                        {p.result.risk.level
                          ? bands[p.result.risk.level]
                          : "неизвестен"}
                        . Уверенность: {bands[p.result.confidence]}.{" "}
                        {paybackText(p.result)}
                      </p>
                    )}
                  </>
                )}
                <div className="bd-row">
                  <button className="bm-link" onClick={() => onFocus(p.id)}>
                    Продолжить разбор
                  </button>
                  <button className="bm-link" onClick={() => onOpen(p.id)}>
                    Подробнее →
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {state.processes.length > 1 && (
        <p className="bm-muted">
          Часы процессов не складываются без проверки пересечений. Карта
          хранится в памяти вкладки.
        </p>
      )}
    </section>
  );
}
export function QuickNumbers({
  process: p,
  state,
}: {
  process: LiveProcess;
  state: ConversationState;
}) {
  const q = insight(p, state.company);
  return (
    <>
      <div className="bm-metrics">
        <div>
          <span>Текущее время всей команды</span>
          <strong>
            {q.hours ? `${show(q.hours)} ч/мес.` : "Не рассчитано"}
          </strong>
        </div>
        <div>
          <span>Стоимость рабочего времени</span>
          <strong>{rubles(q.timeCost)}</strong>
          <small>Не денежная экономия</small>
        </div>
      </div>
      <div className="bm-formula">
        <span>Откуда берётся результат</span>
        <code>H = N команды × k периода × t / 60</code>
        <p>
          {p.workload.operations ?? "?"}{" "}
          {p.workload.scope === "per-person"
            ? `× ${p.workload.employees ?? "?"} сотрудников = ${q.teamOperations ?? "?"} выполнений всей команды`
            : p.workload.scope === "team"
              ? "выполнений всей команды"
              : "— нужно уточнить, чей это объём"}
          .
        </p>
        <p>
          k ={" "}
          {p.workload.period === "day"
            ? "21 рабочий день"
            : p.workload.period === "week"
              ? "52/12 недели"
              : p.workload.period === "month"
                ? "1 месяц"
                : "период неизвестен"}
          ; t = {p.workload.minutes ?? "?"} мин.
        </p>
        <p>
          C = H × полная стоимость часа ({p.workload.hourlyRate ?? "не введена"}{" "}
          ₽). Зарплату и денежную экономию не предполагаем.
        </p>
        <small>
          Число сотрудников умножается на объём только при ответе «на
          сотрудника», один раз. Допущения календаря: business-map-v1.1; полная
          точность до округления показа.
        </small>
      </div>
    </>
  );
}
