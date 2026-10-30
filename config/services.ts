/**
 * The three service directions — one source for the homepage, navigation, footer,
 * lead form and structured data. `href` points at the homepage section until the
 * dedicated /services/* pages ship; switching it here moves every link at once.
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
    href: "/#automation",
    serviceType: "Автоматизация бизнес-процессов и внедрение ИИ",
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
    href: "/#apps",
    serviceType: "Разработка внутренних приложений для бизнеса",
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
    href: "/#training",
    serviceType: "Системы обучения и адаптации сотрудников",
  },
];

export const serviceBySlug = (slug: ServiceSlug) => services.find((s) => s.slug === slug)!;
