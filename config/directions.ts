import {
  solutions,
  solutionHref,
  entryPrice,
  rub,
  type SolutionSlug,
} from "./solutions.ts";
import { ctoOffer } from "./commercial.ts";

/** Navigation copy only; the existing offer registries own all scopes and prices. */
const summaries: Record<
  SolutionSlug,
  { title: string; problem: string; result: string }
> = {
  "corporate-academy": {
    title: "Обучение и адаптация сотрудников",
    problem:
      "Новичков каждый раз обучают вручную, а знания хранятся в разных местах.",
    result:
      "Единая программа обучения, тесты и понятный прогресс каждого сотрудника.",
  },
  "employee-kpi": {
    title: "Рейтинги и мотивация команды",
    problem: "Результаты сотрудников приходится собирать и сравнивать вручную.",
    result: "Прозрачные показатели и рейтинги по согласованным правилам.",
  },
  "management-analytics": {
    title: "Отчётность и управление финансами",
    problem:
      "Чтобы понять состояние бизнеса, приходится сводить несколько таблиц.",
    result: "Выручка, расходы и план–факт в одном управленческом отчёте.",
  },
  "branch-standards": {
    title: "Контроль стандартов филиалов",
    problem:
      "Сложно проверить, одинаково ли соблюдаются правила во всех точках.",
    result:
      "Чек-листы, подтверждения проверок и задачи ответственным в одной системе.",
  },
  "lead-engine": {
    title: "ИИ для поиска и обработки клиентов",
    problem:
      "Команда вручную ищет потенциальных клиентов и разбирает обращения.",
    result:
      "Рабочий процесс поиска и обработки с проверкой источников и контролем человека.",
  },
};
export type Direction = {
  id: SolutionSlug | "cto";
  title: string;
  problem: string;
  result: string;
  href: string;
  price: string;
  solution?: SolutionSlug;
  service?: "cto";
};
export const directions: readonly Direction[] = [
  ...solutions.map((s) => ({
    id: s.slug,
    ...summaries[s.slug],
    href: solutionHref(s),
    price: entryPrice(s),
    solution: s.slug,
  })),
  {
    id: "cto",
    title: "Внешний технологический директор",
    problem:
      "Нужен человек, который свяжет задачи бизнеса, бюджет и работу подрядчиков.",
    result:
      "Технологическая стратегия, приоритеты и контроль реализации в согласованном объёме.",
    href: "/services/cto",
    price: `${rub(ctoOffer.monthlyPrice)}/мес. · до ${ctoOffer.hours} часов`,
    service: "cto",
  },
];
