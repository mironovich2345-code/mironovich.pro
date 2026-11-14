"use client";
import { useState } from "react";
import type {
  LiveProcess,
  Workload,
} from "../../../lib/business-map/dialog/contracts";
import { parseDecimal } from "../../../lib/tools/input";
import { NumberField, SelectField } from "../shared";
const errorNames = {
  unknown: "Не знаю",
  minor: "Мелкая, легко исправить",
  noticeable: "Заметная переделка",
  serious: "Серьёзный ущерб",
  critical: "Критические последствия",
};
export default function QuickEditor({
  process: p,
  onSave,
  onCancel,
}: {
  process: LiveProcess;
  onSave: (
    patch: Pick<LiveProcess, "name" | "workload" | "error" | "confirmed">,
  ) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(p.name),
    [work, setWork] = useState(p.workload),
    [error, setError] = useState(p.error),
    [confirmed, setConfirmed] = useState(
      p.confirmed === null ? "unknown" : p.confirmed ? "yes" : "no",
    ),
    [failure, setFailure] = useState("");
  const [numbers, setNumbers] = useState(
    Object.fromEntries(
      (["operations", "employees", "minutes", "hourlyRate"] as const).map(
        (k) => [k, p.workload[k]?.toString() ?? ""],
      ),
    ),
  );
  return (
    <form
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          if (!name.trim() || name.length > 80)
            throw new Error("Введите название до 80 символов.");
          const workload = { ...work };
          for (const k of [
            "operations",
            "employees",
            "minutes",
            "hourlyRate",
          ] as const)
            workload[k] =
              numbers[k].trim() === "" ? null : parseDecimal(numbers[k]);
          onSave({
            name: name.trim(),
            workload,
            error,
            confirmed: confirmed === "unknown" ? null : confirmed === "yes",
          });
        } catch (e) {
          setFailure(e instanceof Error ? e.message : "Проверьте числа.");
        }
      }}
    >
      <header className="bm-page-heading">
        <p className="bm-eyebrow">Без повторного опроса</p>
        <h1>Уточнить процесс</h1>
        <p>
          Пустое числовое поле означает «Не знаю». Значения не сохраняются за
          пределами этой вкладки.
        </p>
      </header>
      <label className="bm-field">
        <span>Название</span>
        <input
          autoFocus
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="bm-field-grid">
        <SelectField
          label="Ручная работа подтверждена?"
          value={confirmed}
          onChange={setConfirmed}
          options={{
            unknown: "Пока гипотеза",
            yes: "Да",
            no: "Нет, автоматизация не нужна",
          }}
        />
        <NumberField
          label="Количество выполнений за период"
          value={numbers.operations}
          onChange={(v) => setNumbers((n) => ({ ...n, operations: v }))}
          optional
        />
        <SelectField
          label="Чей это объём?"
          value={work.scope}
          onChange={(v) =>
            setWork((w) => ({ ...w, scope: v as Workload["scope"] }))
          }
          options={{
            unknown: "Нужно уточнить",
            team: "Всей команды",
            "per-person": "Одного сотрудника",
          }}
        />
        <SelectField
          label="За какой период?"
          value={work.period ?? ""}
          onChange={(v) =>
            setWork((w) => ({
              ...w,
              period: (v || null) as Workload["period"],
            }))
          }
          options={{
            "": "Не знаю",
            day: "За день",
            week: "За неделю",
            month: "За месяц",
          }}
        />
        <NumberField
          label="Сотрудников участвует"
          value={numbers.employees}
          onChange={(v) => setNumbers((n) => ({ ...n, employees: v }))}
          optional
        />
        <NumberField
          label="Минут на одно выполнение"
          value={numbers.minutes}
          onChange={(v) => setNumbers((n) => ({ ...n, minutes: v }))}
          optional
        />
        <NumberField
          label="Полная стоимость часа, ₽"
          value={numbers.hourlyRate}
          onChange={(v) => setNumbers((n) => ({ ...n, hourlyRate: v }))}
          optional
        />
        <SelectField
          label="Последствия ошибки"
          value={error}
          onChange={(v) => setError(v as LiveProcess["error"])}
          options={errorNames}
        />
      </div>
      {failure && (
        <p role="alert" className="bm-error-text">
          {failure}
        </p>
      )}
      <div className="bm-actions">
        <button className="bm-primary" type="submit">
          Сохранить и пересчитать
        </button>
        <button className="bm-link" type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
