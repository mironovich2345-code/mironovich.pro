export type DigitalProduct = {
  slug: string;
  title: string;
  audience: string;
  problem: string;
  outcome: string;
  plannedPrice: number;
  status: "preparing";
  cover: string;
  chapters: string[];
};
export const products: DigitalProduct[] = [
  {
    slug: "ai-career",
    title: "Как стать ценнее для компании с помощью ИИ",
    audience: "Сотрудникам и специалистам от 18 лет",
    problem:
      "Разберите свои задачи, научитесь применять ИИ и получите план развития из 30 шагов.",
    outcome:
      "Планируемый результат: карта собственных задач и план развития из 30 шагов. Интерактивный продукт ещё разрабатывается и не гарантирует сохранение должности.",
    plannedPrice: 1993,
    status: "preparing",
    cover: "/products/ai-career-v3.png",
    chapters: [
      "Какие рабочие задачи автоматизируются",
      "Какие навыки сохраняют ценность",
      "Как определить собственную уязвимость",
      "Какие компетенции развивать",
      "Как использовать ИИ для продуктивности",
      "Персональный план из 30 шагов",
    ],
  },
  {
    slug: "automation-priorities",
    title: "Какие задачи автоматизировать в первую очередь",
    audience: "Предпринимателям и руководителям",
    problem:
      "Выбрать процесс для первой проверки, прежде чем тратить деньги на внедрение.",
    outcome:
      "Планируемый результат: карта повторяющихся операций, критерии приоритета и план проверки одного процесса. Оценка задач не является решением об увольнении людей.",
    plannedPrice: 4934,
    status: "preparing",
    cover: "/products/automation-priorities.svg",
    chapters: [
      "Инвентаризация повторяющихся операций",
      "Оценка времени и затрат",
      "Пригодность задач для автоматизации",
      "Риски, зависимости и ограничения",
      "Приоритизация процессов",
      "Шаблон карты автоматизации",
      "План первичной проверки процесса",
    ],
  },
];
/** Only the employee digital course is in the website payment application.
 * The company product remains an internal concept until a separate launch.
 */
export const publicStorefrontProducts: DigitalProduct[] = products.filter(
  (p) => p.slug === "ai-career",
);
export const productBySlug = (slug: string) =>
  products.find((p) => p.slug === slug);
