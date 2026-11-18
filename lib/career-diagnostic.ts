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
  // The "day" key is retained only for compatibility with the sandbox progress
  // table and API. In the product these are steps, never calendar dates.
  const focus = ranked[0]?.title ?? "выбранной учебной задачи";
  const phases: ReadonlyArray<{
    start: number;
    theme: string;
    steps: ReadonlyArray<readonly [action: string, evidence: string]>;
  }> = [
    {
      start: 1,
      theme: "Разберите задачу",
      steps: [
        ["Выберите один безопасный учебный пример для задачи «{task}».", "Сформулирована цель учебного примера"],
        ["Опишите входные данные и ожидаемый результат без сведений работодателя.", "Определены вход и выход"],
        ["Разделите процесс на повторяющиеся действия и решения человека.", "Получена схема процесса"],
        ["Оцените время ручной работы на одном учебном примере.", "Зафиксирован исходный замер"],
        ["Определите три проверяемых критерия качества результата.", "Составлен критерий проверки"],
        ["Запишите ограничения по данным, доступу и цене ошибки.", "Подготовлен список ограничений"],
      ],
    },
    {
      start: 7,
      theme: "Попробуйте подход",
      steps: [
        ["Сформулируйте гипотезу: на каком этапе ИИ может помочь без принятия решения за человека.", "Записана проверяемая гипотеза"],
        ["Проверьте правила доступа; при запрете используйте только учебную имитацию.", "Выбран разрешённый формат пробы"],
        ["Подготовьте три вымышленных входных примера разной сложности.", "Готов безопасный набор примеров"],
        ["Сделайте один пример вручную для последующего сравнения.", "Создан проверенный ручной эталон"],
        ["Опишите запрос с целью, форматом ответа и запретом выдумывать факты.", "Подготовлен шаблон запроса"],
        ["Получите учебный черновик доступным разрешённым способом или через имитацию.", "Есть пробный черновик"],
        ["Сравните черновик с ручным эталоном по трём критериям.", "Заполнена таблица расхождений"],
        ["Уточните запрос и повторите проверку на другом вымышленном примере.", "Получен второй результат пробы"],
      ],
    },
    {
      start: 15,
      theme: "Проверьте качество",
      steps: [
        ["Проверьте, не потеряны ли обязательные поля и действия.", "Составлен список пропусков"],
        ["Отметьте все обнаруженные фактические и логические ошибки.", "Сформирован реестр ошибок"],
        ["Для каждого проверяемого утверждения найдите первоисточник или пометьте неопределённость.", "Проставлены ссылки и оговорки"],
        ["Проверьте, нет ли в результате вымышленных персональных или закрытых сведений.", "Проведена проверка безопасности"],
        ["Сравните время ручного решения и эксперимента с учётом проверки человеком.", "Посчитано время с проверкой"],
        ["Повторите опыт на третьем учебном примере, не меняя критерии.", "Зафиксирован повтор эксперимента"],
        ["Пройдите контрольный список так, как это сделал бы другой сотрудник.", "Отмечены выполненные критерии"],
        ["Определите решения, которые обязательно остаются за человеком.", "Описаны границы ответственности"],
        ["Сделайте вывод: применять, доработать или отказаться — и почему.", "Записано аргументированное решение"],
      ],
    },
    {
      start: 24,
      theme: "Оформите результат",
      steps: [
        ["Опишите исходную задачу и старый процесс двумя-тремя предложениями.", "Готова вводная часть кейса"],
        ["Кратко покажите новый учебный процесс и роль человека в нём.", "Составлено описание подхода"],
        ["Сведите замеры времени и качества; отдельно укажите ограничения сравнения.", "Готова таблица показателей"],
        ["Соберите короткий обезличенный кейс без неподтверждённых обещаний.", "Подготовлен пример своего вклада"],
        ["Сформулируйте для руководителя предложение об осторожном пилоте, не об увольнениях.", "Написано предложение пилота"],
        ["Выберите два навыка, которые нужно развивать после эксперимента.", "Определены учебные приоритеты"],
        ["Наметьте следующий безопасный эксперимент и критерий его успешности.", "Зафиксирован следующий шаг"],
      ],
    },
  ];
  const plan = phases.flatMap(({ start, theme, steps }) =>
    steps.map(([action, evidence], index) => ({
      day: start + index,
      theme,
      action: action.replace("{task}", focus),
      evidence,
    })),
  );
  if (plan.length !== 30 || plan.some((item, i) => item.day !== i + 1))
    throw new Error("The 30-step plan must be consecutive");
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
