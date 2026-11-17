export const careerQuestions = [
  [
    "role",
    "Учебная профессиональная роль",
    ["operations", "sales", "analyst", "support"],
  ],
  ["experience", "Учебный стаж", ["starter", "practiced", "experienced"]],
  [
    "taskMix",
    "Какие задачи преобладают?",
    ["documents", "tables", "communication", "research"],
  ],
  [
    "frequency",
    "Как часто повторяется задача?",
    ["daily", "weekly", "monthly"],
  ],
  ["duration", "Сколько занимает один повтор?", ["short", "medium", "long"]],
  ["structure", "Насколько понятны шаги?", ["clear", "partial", "unclear"]],
  [
    "inputs",
    "В каком виде учебные входные данные?",
    ["structured", "text", "mixed"],
  ],
  [
    "dataSensitivity",
    "Какие данные допустимы?",
    ["synthetic", "public", "restricted"],
  ],
  [
    "accessRules",
    "Разрешены ли инструменты?",
    ["approved", "ask_first", "forbidden"],
  ],
  ["errorImpact", "Последствия ошибки", ["low", "medium", "high"]],
  [
    "qualityCheck",
    "Есть ли критерий качества?",
    ["checklist", "expert_review", "not_defined"],
  ],
  [
    "repeatability",
    "Насколько похожи повторы?",
    ["same", "variable", "unique"],
  ],
  ["aiExperience", "Опыт с ИИ", ["none", "basic", "regular"]],
  ["reviewTime", "Время на проверку", ["available", "limited", "none"]],
  [
    "decisionAuthority",
    "Кто принимает окончательное решение?",
    ["human", "supervisor", "regulated"],
  ],
  ["baseline", "Есть ли исходный замер?", ["measured", "estimate", "none"]],
  [
    "learningTime",
    "Время на практику в неделю",
    ["one_hour", "three_hours", "five_hours"],
  ],
  ["goal", "Цель эксперимента", ["quality", "speed", "clarity"]],
] as const;
export const careerTasks = [
  {
    id: "table",
    title: "Сверка учебной таблицы",
    steps: "Проверить формат, найти пропуски, сверить контрольные суммы",
  },
  {
    id: "document",
    title: "Черновик учебной инструкции",
    steps: "Составить структуру, подготовить черновик, проверить каждый пункт",
  },
  {
    id: "support",
    title: "Ответ на вымышленное обращение",
    steps: "Выделить вопрос, составить ответ, проверить точность и тон",
  },
  {
    id: "research",
    title: "Обзор открытых источников",
    steps: "Собрать ссылки, сравнить утверждения, проверить первоисточники",
  },
  {
    id: "meeting",
    title: "План вымышленной встречи",
    steps: "Сформулировать цель, повестку, критерии результата",
  },
] as const;
export type CareerAnswers = {
  questions: Record<string, string>;
  tasks: string[];
};
export function validateCareerAnswers(value: unknown): CareerAnswers | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).sort().join() !== "questions,tasks" ||
    !v.questions ||
    typeof v.questions !== "object" ||
    Array.isArray(v.questions) ||
    !Array.isArray(v.tasks)
  )
    return null;
  const q = v.questions as Record<string, unknown>;
  if (
    Object.keys(q).length !== 18 ||
    !careerQuestions.every(
      ([key, , options]) =>
        typeof q[key] === "string" &&
        (options as readonly string[]).includes(q[key] as string),
    )
  )
    return null;
  if (
    v.tasks.length < 1 ||
    v.tasks.length > 5 ||
    new Set(v.tasks).size !== v.tasks.length ||
    !v.tasks.every((id) => careerTasks.some((t) => t.id === id))
  )
    return null;
  return { questions: q as Record<string, string>, tasks: v.tasks as string[] };
}
export const syntheticAnswers = (): CareerAnswers => ({
  questions: Object.fromEntries(
    careerQuestions.map(([key, , choices]) => [key, choices[0]]),
  ),
  tasks: ["table", "document"],
});
export function addCalendarMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, end));
  return d;
}
export function generateSyntheticAnalysis(answers: CareerAnswers) {
  const safe = validateCareerAnswers(answers);
  if (!safe) throw new Error("Invalid coded synthetic diagnostic");
  const restricted =
    safe.questions.dataSensitivity === "restricted" ||
    safe.questions.accessRules !== "approved";
  const highRisk =
    safe.questions.errorImpact === "high" ||
    safe.questions.reviewTime === "none" ||
    safe.questions.decisionAuthority === "regulated";
  const ranked = safe.tasks
    .map((id) => careerTasks.find((t) => t.id === id)!)
    .map((t) => ({
      id: t.id,
      title: t.title,
      steps: t.steps,
      recommendation: restricted
        ? "Не передавать данные в ИИ. Согласовать правила и использовать только учебный пример."
        : highRisk
          ? "ИИ — только черновик под обязательной проверкой человеком; автоматическое решение недопустимо."
          : "Провести небольшой эксперимент на синтетических данных с проверкой результата.",
      score: restricted
        ? 0
        : highRisk
          ? 1
          : safe.questions.repeatability === "same"
            ? 3
            : 2,
    }));
  const weekly = [
    "Выбор задачи и исходный замер",
    "Учебный эксперимент и критерии",
    "Повторение и проверка качества",
    "Фиксация вклада и ограничения",
  ];
  const plan = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    theme: weekly[Math.min(3, Math.floor(i / 7))],
    action: [
      "Описать один учебный пример и разрешённые входные данные",
      "Замерить время ручного выполнения",
      "Записать критерии точности и ошибки",
      "Подготовить безопасный черновик с ИИ-имитацией",
      "Сравнить с ручным эталоном и проверить источники",
      "Зафиксировать ограничения и решение человека",
      "Подвести итог недели и выбрать следующий шаг",
    ][i % 7],
  }));
  return {
    version: "synthetic-v1",
    synthetic: true as const,
    title: "Учебный персональный план",
    disclaimer:
      "Тестовый генератор, не настоящий ИИ-анализ. Не прогноз увольнения и не гарантия роста дохода.",
    tasks: ranked,
    directions: [
      "Безопасность и качество данных",
      "Проверяемый рабочий эксперимент",
      "Доказательства собственного профессионального вклада",
    ],
    plan,
  };
}
export type CareerResult = ReturnType<typeof generateSyntheticAnalysis>;
