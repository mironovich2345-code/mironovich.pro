/**
 * The three service directions — one source for the homepage, /services catalogue,
 * navigation, footer and structured data. Page content lives in content/services/.
 */

export type ServiceSlug = "automation" | "apps" | "training";

export type Service = {
  slug: ServiceSlug;
  index: string;
  /** Short name — navigation, form option, footer */
  label: string;
  /** Card heading */
  title: string;
  /** One-line offer */
  lead: string;
  /** What I build */
  does: string[];
  /** What the business gets — qualitative, no promised numbers */
  gives: string;
  href: string;
  /** schema.org Service.serviceType */
  serviceType: string;
  /** /services catalogue: when this direction fits */
  fit: string;
  /** /services catalogue: three short example tasks */
  examples: [string, string, string];
};

export const services: readonly Service[] = [
  {
    slug: "automation",
    index: "01",
    label: "Автоматизация и ИИ",
    title: "Автоматизация бизнес-процессов",
    lead: "Убираю ручные операции и связываю сервисы между собой.",
    does: [
      "Автоматизация отчётности",
      "Интеграции CRM и сервисов через API",
      "Обработка заявок и уведомления",
      "Сбор и синхронизация данных",
      "ИИ в рабочих процессах",
    ],
    gives:
      "Меньше ручных операций и ошибок при переносе данных. Руководитель получает актуальные цифры без ручной сводки.",
    href: "/services/automation",
    serviceType: "Автоматизация бизнес-процессов и внедрение ИИ",
    fit: "Подходит, если команда тратит время на перенос данных, ручные отчёты и повторяющиеся операции.",
    examples: ["Отчёт руководителю по расписанию", "Синхронизация CRM и таблиц", "Распределение заявок"],
  },
  {
    slug: "apps",
    index: "02",
    label: "Приложения для бизнеса",
    title: "Разработка приложений",
    lead: "Создаю инструменты под процессы компании, когда таблиц и чатов уже мало.",
    does: [
      "Внутренние приложения",
      "Личные кабинеты сотрудников и клиентов",
      "Административные панели",
      "Аналитические дашборды",
      "Telegram Mini Apps и MVP",
    ],
    gives:
      "Процесс в одном месте: роли, статусы, история. Прозрачность без постоянных вопросов «как там?».",
    href: "/services/apps",
    serviceType: "Разработка внутренних приложений для бизнеса",
    fit: "Подходит, если процесс держится на таблицах и переписке, а готовые сервисы не закрывают специфику.",
    examples: ["Личный кабинет клиента", "Панель руководителя", "Telegram Mini App"],
  },
  {
    slug: "training",
    index: "03",
    label: "Обучение сотрудников",
    title: "Системы обучения сотрудников",
    lead: "Перевожу обучение из головы руководителя в систему.",
    does: [
      "Адаптация новичков",
      "База знаний и корпоративная академия",
      "Тестирование и аттестации",
      "Контроль прогресса",
      "ИИ-инструменты для обучения",
    ],
    gives:
      "Обучение по единому стандарту, которое не держится на одном человеке. Руководитель видит прогресс.",
    href: "/services/training",
    serviceType: "Системы обучения и адаптации сотрудников",
    fit: "Подходит, если обучение новичков зависит от конкретных людей и не даёт проверяемого результата.",
    examples: ["Маршрут адаптации", "База знаний", "Аттестация сотрудников"],
  },
];

export const serviceBySlug = (slug: ServiceSlug) => services.find((s) => s.slug === slug)!;

export const isServiceSlug = (v: string): v is ServiceSlug => services.some((s) => s.slug === v);

/** schema.org @id of a service — defined on its own page, referenced from the home and catalogue graphs. */
export const serviceId = (siteUrl: string, slug: ServiceSlug) => siteUrl + "/services/" + slug + "#service";
