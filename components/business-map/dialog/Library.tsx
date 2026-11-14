import { useState } from "react";
import type {
  Industry,
  ScenarioId,
} from "../../../lib/business-map/dialog/contracts";
import {
  approachNames,
  industryNotice,
  industryScenarios,
} from "../../../lib/business-map/dialog/industry";
export default function Library({
  industry,
  onChoose,
  disabled = false,
}: {
  industry: Industry;
  onChoose: (id: ScenarioId) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState<ScenarioId | null>(null);
  return (
    <section className="bd-library" aria-label="Отраслевые гипотезы">
      <p className="bm-eyebrow">Возможности для проверки · без ожидания ИИ</p>
      <p className="bm-muted">{industryNotice(industry)}</p>
      <div>
        {industryScenarios(industry).map((s, i) => (
          <article key={s.id}>
            <div className="bd-library-line">
              <span className="bd-index">{String(i + 1).padStart(2, "0")}</span>
              <button
                className="bd-library-name"
                aria-expanded={expanded === s.id}
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              >
                {s.name}
                <span aria-hidden="true">{expanded === s.id ? "−" : "+"}</span>
              </button>
              <button
                className="bm-link"
                disabled={disabled}
                onClick={() => onChoose(s.id)}
              >
                Проверить
              </button>
            </div>
            {expanded === s.id && (
              <div className="bd-library-detail">
                <p>{s.problem}</p>
                <p>
                  <strong>Признаки:</strong> {s.signs.join("; ")}.
                </p>
                <p>
                  <strong>Первое действие:</strong> {s.firstAction}
                </p>
                <p>
                  <strong>Варианты:</strong>{" "}
                  {s.solutions.map((a) => approachNames[a]).join(" → ")}.
                </p>
                <p>
                  <strong>Ограничения:</strong> {s.limits.join(". ")}.
                </p>
                <details>
                  <summary>Что уточним и как проверим</summary>
                  <ul>
                    {s.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                  <p>Для расчёта: {s.calculationData.join("; ")}.</p>
                  <p>Метрики: {s.metrics.join("; ")}.</p>
                </details>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
