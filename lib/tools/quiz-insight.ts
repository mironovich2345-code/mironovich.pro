import { parseDecimal, round2 } from "./input.ts";
import { shiftCount, periodFactor } from "./quiz-model.ts";
import { emptyMeasure, type LaborDraft, type QuizStep } from "./quiz-draft.ts";
export type QuizInsight = { label: string; value: string; note: string };
const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
export function laborInsight(d: LaborDraft, step: QuizStep): QuizInsight {
  const fallback = { label: "Поэтапный результат", value: "Нужен ваш ответ", note: "Показываем только данные, которые уже известны. Ставку и экономию не придумываем." };
  if (step.kind === "processes") return { label: "Выбрано процессов", value: String(d.tasks.length), note: "Начните с одного. Показатели разных процессов не суммируются без проверки пересечений." };
  const g = d.groups.find(g => g.id === step.group);
  if (!g) return fallback;
  const task = step.task ?? d.tasks[0], m = g.measures[task] ?? emptyMeasure();
  const employees = parseDecimal(g.employees), repetitions = !m.frequencyUnknown ? parseDecimal(m.repetitions) : NaN;
  const operations = employees * repetitions, minutes = !m.durationUnknown ? parseDecimal(m.duration) * (m.durationUnit === "hours" ? 60 : 1) : NaN;
  const periodHours = repetitions === 0 ? 0 : operations * minutes / 60;
  const unit = { shift: "за смену", week: "за неделю", month: "за месяц" }[m.frequency];
  const shifts = g.schedule ? shiftCount(d.month, g.schedule, g.useActual || g.schedule === "other" ? parseDecimal(g.actualShifts) : null) : null;
  const monthHours = periodHours * (shifts === null ? m.frequency === "month" ? 1 : NaN : periodFactor(d.month, m.frequency, shifts));
  const paidHours = shifts === null ? NaN : shifts * parseDecimal(g.shiftHours);
  if (step.kind === "employees" && Number.isFinite(employees)) return { label: "Участников в этой группе", value: fmt(employees), note: "Один график и одна месячная сумма применяются к этой группе. Участников повторно не спрашиваем." };
  if (step.kind === "frequency" && Number.isFinite(operations)) return { label: `Операций ${unit} у группы`, value: fmt(operations), note: "Участники × повторы на одного сотрудника. Другие периоды пока не подставляем." };
  if (step.kind === "duration" && Number.isFinite(periodHours)) return { label: `Ручная работа ${unit}`, value: `${fmt(periodHours)} ч`, note: "Время всей группы на выбранный процесс. Это ещё не денежная оценка." };
  if (["schedule", "actual_shifts"].includes(step.kind) && shifts !== null) return { label: Number.isFinite(monthHours) ? "Ручная работа за месяц" : "Смен в месяце", value: Number.isFinite(monthHours) ? `${fmt(monthHours)} ч` : fmt(shifts), note: `${fmt(shifts)} смен — ${g.useActual || g.schedule === "other" ? "указано фактически" : "календарная оценка, не точный график"}. ${m.frequency === "week" ? "Недельные повторы учитываются по календарным дням / 7." : m.frequency === "month" ? "Месячные повторы на смены не умножаем." : "График определяет число повторений за месяц."}` };
  if (step.kind === "shift_hours" && Number.isFinite(paidHours)) return { label: "Рабочих часов на сотрудника / месяц", value: `${fmt(paidHours)} ч`, note: "Смены × часы в смену. Этот фонд используем для стоимости часа." };
  if (step.kind === "pay") {
    if (g.payKind === "unknown") return { label: "Без вымышленной суммы", value: Number.isFinite(monthHours) ? `${fmt(monthHours)} ч/мес` : "Стоимость неизвестна", note: "Часы остаются доступны. Зарплату и ставку часа не подставляем." };
    const amount = parseDecimal(g.amount);
    if (Number.isFinite(amount) && amount >= 0 && amount <= 10000000 && paidHours > 0) {
      const rate = amount / paidHours, cost = monthHours * rate;
      return { label: Number.isFinite(cost) ? "Этот процесс · эта группа / месяц" : "Стоимость часа этой группы", value: `${fmt(Number.isFinite(cost) ? round2(cost) : rate)} ₽`, note: `${fmt(rate)} ₽/ч${Number.isFinite(cost) ? ` · ${fmt(round2(round2(cost) * 12))} ₽/год при той же нагрузке` : ""}. ${g.payKind === "salary" ? "По зарплате, не полным расходам работодателя." : "По указанным полным расходам."} Это не экономия.` };
    }
  }
  return fallback;
}
