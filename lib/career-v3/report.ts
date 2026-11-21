// Manager report builder (#47): assembled only from system-checked fields and saved training results.
// It never invents achievements, money, savings or career promises; every variant carries the training-data
// notice, the measurement dates and the statement that no link to business results is proven.
import { ALWAYS_LIMITATIONS, INSUFFICIENT, type Comparison, type Unit } from "./results.ts";

export type ReportKind = "results" | "pilot" | "development";
export const REPORT_KINDS: { id: ReportKind; label: string }[] = [
  { id: "results", label: "Отчёт о результатах обучения" },
  { id: "pilot", label: "Предложение двухнедельного пилота" },
  { id: "development", label: "Просьба обсудить дальнейшее развитие" },
];
export const SECTION_HEADINGS = [
  "1. Какую задачу я изучал",
  "2. Какой безопасный способ работы проверял",
  "3. Что измерил",
  "4. Что изменилось на учебных данных",
  "5. Ограничения результата",
  "6. Какой следующий эксперимент предлагаю согласовать",
] as const;

export interface ReportSnapshot {
  professionTitle: string;
  variantLabel: string;
  syntheticLibrary: boolean;
  /** Closed cloud demo: lessons are in editorial review (shown as a notice in every report). */
  demoPreview?: boolean;
  generatedOn: string;
  completedSteps: number;
  totalSteps: number;
  stale: boolean;
  lessons: { title: string; stepsDone: number; stepsTotal: number; quiz: { passed: boolean; correct: number; total: number } | null }[];
  measurements: { metricLabel: string; method: string; unit: Unit; baselineOn: string | null; afterOn: string | null; comparison: Comparison }[];
}
export interface Report { kind: ReportKind; title: string; notice: string[]; sections: { heading: string; lines: string[] }[]; text: string }

const ru = (iso: string) => iso.split("-").reverse().join(".");
const clean = (t: string) => t.replace("[SYNTHETIC FIXTURE] ", "");

export function buildReport(kind: ReportKind, s: ReportSnapshot): Report {
  const title = REPORT_KINDS.find((k) => k.id === kind)!.label;
  const dates = s.measurements.flatMap((m) => [m.baselineOn, m.afterOn]).filter((d): d is string => !!d).sort();
  const notice = [
    "Учебные данные: результаты получены на вымышленных задачах в учебном контуре, а не на рабочих данных.",
    dates.length ? `Даты замеров: ${ru(dates[0])}${dates.length > 1 && dates.at(-1) !== dates[0] ? `–${ru(dates.at(-1)!)}` : ""}.` : "Замеров пока нет.",
    "Связь с выручкой, конверсией, продлениями и другими бизнес-результатами не доказана и не утверждается.",
    ...(s.demoPreview ? ["Демонстрационная версия: учебные материалы находятся на проверке и не опубликованы."] : []),
    ...(s.syntheticLibrary ? ["Сформировано на тестовой библиотеке-заглушке для проверки интерфейса — это не учебные материалы."] : []),
  ];
  const studied = s.lessons.filter((l) => l.stepsDone > 0);
  const quizPassed = s.lessons.filter((l) => l.quiz?.passed).length;
  const quizTotal = s.lessons.filter((l) => l.quiz).length;
  const ok = s.measurements.filter((m) => m.comparison.status === "ok");
  const caveats = [...new Set([...ALWAYS_LIMITATIONS, ...s.measurements.flatMap((m) => m.comparison.caveats)])];

  const intro: Record<ReportKind, string> = {
    results: `Коротко о пройденном в учебной программе «${s.professionTitle}»: завершено ${s.completedSteps} из ${s.totalSteps} шагов.`,
    pilot: `Предлагаю согласовать короткий учебный пилот по итогам программы «${s.professionTitle}» (завершено ${s.completedSteps} из ${s.totalSteps} шагов).`,
    development: `Прошу обсудить дальнейшее развитие по итогам учебной программы «${s.professionTitle}» (завершено ${s.completedSteps} из ${s.totalSteps} шагов).`,
  };
  const next: Record<ReportKind, string[]> = {
    results: [
      ok.length
        ? "Повторить замер тем же способом на большем числе сопоставимых учебных задач, чтобы понять, устойчиво ли изменение."
        : "Сначала сделать исходный и повторный замер на сопоставимых учебных задачах: без них выводов о результате нет.",
      "Решение о любом применении на рабочих задачах остаётся за руководителем и правилами компании.",
    ],
    pilot: [
      "Срок — две недели, одна операция из пройденных шагов, тот же показатель и тот же способ замера, что в учебной программе.",
      "Только разрешённые компанией инструменты и данные; каждый результат проверяется мной до любого действия, которое видит клиент.",
      "Критерий остановки — ошибка в цене, сроке или обязательстве, пропущенная проверкой, или нарушение правил работы с данными.",
      "Итог — лист замера «было → стало» с теми же ограничениями; решение о продолжении принимает руководитель.",
    ],
    development: [
      "Обсудить, какие задачи из моей карты стоит осваивать дальше и какие правила работы с ИИ действуют в компании.",
      "Договориться, какой учебный замер был бы полезен руководителю и в каком формате удобно получать результаты.",
      "Это просьба о разговоре, а не запрос о должности или оплате.",
    ],
  };

  const sections = [
    { heading: SECTION_HEADINGS[0], lines: [intro[kind], ...(studied.length
      ? studied.map((l) => `«${clean(l.title)}» — завершено шагов: ${l.stepsDone} из ${l.stepsTotal}.`)
      : ["Пока ни один шаг не завершён."])] },
    { heading: SECTION_HEADINGS[1], lines: [
      `Режим практики: ${s.variantLabel.toLowerCase()}.`,
      "Каждый учебный результат проверен мной по критериям урока; решения и действия оставались за мной, данные — только вымышленные.",
      `Мини-тесты пройдены: ${quizPassed} из ${quizTotal}.`,
      "Отметки о выполнении — самопроверка, а не объективное подтверждение профессионального навыка.",
    ] },
    { heading: SECTION_HEADINGS[2], lines: s.measurements.length
      ? s.measurements.map((m) => `${m.metricLabel}: ${m.method}.`)
      : ["Учебные замеры пока не внесены."] },
    { heading: SECTION_HEADINGS[3], lines: s.measurements.length
      ? s.measurements.map((m) => m.comparison.status === "ok"
        ? `${m.metricLabel}. ${m.comparison.statement}`
        : `${m.metricLabel}: ${INSUFFICIENT.toLowerCase()} — ${m.comparison.reasons.join("; ").toLowerCase()}.`)
      : [`${INSUFFICIENT}: замеров нет.`] },
    { heading: SECTION_HEADINGS[4], lines: [...caveats, ...(s.stale ? ["Часть материалов обновилась после прохождения: результаты относятся к прежней версии маршрута."] : [])] },
    { heading: SECTION_HEADINGS[5], lines: next[kind] },
  ];
  const text = [title, "", ...notice, "", ...sections.flatMap((x) => [x.heading, ...x.lines.map((l) => "— " + l), ""]), `Сформировано ${ru(s.generatedOn)} в учебном кабинете.`].join("\n");
  return { kind, title, notice, sections, text };
}
