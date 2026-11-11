import { calculateCostWhy, costTaskLabels } from "./cost-why.ts";
import { calculateQuizLabor, consequences, issueFrequencies, obstacles, QUIZ_VERSION, type QuizInput, type QuizLabor } from "./quiz-model.ts";
const laborDescription = (data: QuizLabor) => {
  const r = calculateQuizLabor(data);
  return `Месяц: ${data.month}. Основание: ${r.basis === "salary" ? "зарплата, не полные расходы работодателя" : r.basis === "employer" ? "полные расходы по словам посетителя" : r.basis === "mixed" ? "разные основания, рубли не складывать" : "не все суммы известны"}.
Итог: ${r.totalHours ?? "не сводится"} ч/мес; ${r.totalCost === null ? "рубли неизвестны/суммирование запрещено" : r.totalCost + " ₽/мес; " + r.totalAnnualCost + " ₽/год"}.
Стоимость времени не равна экономии. Год — 12 месяцев при той же нагрузке.
${r.rows.map(row => `${costTaskLabels[row.task]}: ${row.hours ?? "не измерено"} ч/мес; ${row.cost === null ? "стоимость неизвестна" : row.cost + " ₽/мес; " + row.annualCost + " ₽/год"}${row.warning ? "; нагрузка требует проверки" : ""}.`).join("\n")}
${r.groups.map(g => `${g.id}: ${g.employees} чел; ${g.schedule}; ${g.shifts} смен (${g.actualShifts === null ? "календарная оценка, фаза/праздники не подтверждены" : "фактически"}); ${g.shiftHours} ч/смену; ${g.paidHours} ч/мес. ${g.pay.kind === "unknown" ? "Сумма неизвестна" : (g.pay.kind === "salary" ? "Зарплата" : "Полные расходы") + ": " + g.pay.amount + " ₽/мес; ставка " + g.rate + " ₽/ч"}.
${data.tasks.map(task => { const m = g.measures[task]!; return `${costTaskLabels[task]}: ${m.repetitions ?? "?"}/${m.frequency} на чел × ${m.minutes ?? "?"} мин.`; }).join(" ")}`).join("\n")}`;
};
export function describeQuizInput(input: QuizInput): string {
  const prefix = `Интерактивный разбор · ${QUIZ_VERSION} · пересчитано сервером\n`;
  if (input.kind === "labor") return prefix + laborDescription(input.data);
  const d = input.data;
  const diagnosis = `Процессы: ${d.tasks.map(t => costTaskLabels[t]).join(", ")}.\nСо слов посетителя: ${obstacles[d.obstacle]}. Частота проблемы: ${d.frequency === "measured" ? "известен объём операций; это не частота ошибок" : issueFrequencies[d.frequency]}. Последствия: ${consequences[d.consequence]}. Проблемы не подтверждены независимым замером.\n`;
  if (!d.known) return prefix + diagnosis + "Часы и стоимость не измерены. Никакой оценки разработки или экономии нет.";
  if (d.known.kind === "v4") return prefix + diagnosis + laborDescription(d.known.input);
  const r = calculateCostWhy(d.known.input);
  return prefix + diagnosis + "Перенос v3, проверенные исходные данные. Стоимость времени не равна экономии.\n" + r.rows.map(row => `${costTaskLabels[row.task]}: ${row.hours ?? "не измерено"} ч/мес; ${row.cost === null ? "стоимость неизвестна" : row.cost + " ₽/мес; " + row.annualCost + " ₽/год"}.`).join("\n");
}
