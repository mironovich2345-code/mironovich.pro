/**
 * The service registry — one source for the homepage, /services catalogue,
 * navigation, footer and structured data. Page content lives in content/services/.
 */

export type ServiceSlug = "cto" | "development" | "support" | "expertise" | "automation" | "apps" | "training";

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

const legacyServices: readonly Service[] = [
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

/** Primary commercial directions. Legacy specialisations remain published below. */
export const services: readonly Service[] = [
  {
    slug: "cto", index: "01", label: "Внешний CTO", title: "Внешний CTO",
    lead: "Помогаю управлять технологиями без технологического директора в штате.",
    does: ["Технологическая стратегия и приоритеты", "Оценка бюджета и рисков", "Управление разработкой и подрядчиками"],
    gives: "Понятный план действий и человек, с которым можно обсуждать технические решения на языке бизнеса.",
    href: "/services/cto", serviceType: "Внешний технологический директор",
    fit: "Когда технических решений много, а связать их с задачами бизнеса и контролировать выполнение некому.",
    examples: ["Выбор готового продукта или разработки", "План развития IT-направления", "Контроль подрядчиков и бюджета"],
  },
  {
    slug: "development", index: "02", label: "Разработка и автоматизация", title: "Разработка и автоматизация",
    lead: "Создаю продукты и связываю системы, когда задача действительно требует разработки.",
    does: ["Бизнес-приложения и Telegram Mini Apps", "Интеграции, отчётность и ИИ-ассистенты", "Системы обучения сотрудников"],
    gives: "Решение под конкретный рабочий процесс — с требованиями, проверкой и планом сопровождения.",
    href: "/services/development", serviceType: "Разработка цифровых продуктов и автоматизация",
    fit: "Когда готовые инструменты не закрывают задачу или существующие системы нужно связать между собой.",
    examples: ["Внутреннее приложение", "CRM-интеграция через API", "ИИ-ассистент для сотрудников"],
  },
  {
    slug: "support", index: "03", label: "Техническое сопровождение", title: "Техническое сопровождение",
    lead: "Беру на сопровождение действующие продукты и помогаю планировать их развитие.",
    does: ["Работоспособность и исправление ошибок", "Обновления и сопровождение интеграций", "Планирование доработок и инфраструктуры"],
    gives: "Регулярная работа с продуктом вместо поиска нового исполнителя при каждой проблеме. Объём и условия закрепляются в договоре.",
    href: "/services/support", serviceType: "Техническое сопровождение и развитие IT-продуктов",
    fit: "Когда приложение уже работает, но зависит от одного разработчика или осталось без технического владельца.",
    examples: ["Приём продукта после ухода разработчика", "Сопровождение CRM и интеграций", "План регулярных обновлений"],
  },
  {
    slug: "expertise", index: "04", label: "Техническая экспертиза", title: "Независимая техническая экспертиза",
    lead: "Разбираю предложения, сметы и существующие продукты до того, как вы примете решение.",
    does: ["Проверка сметы и технического задания", "Оценка разработчиков и подрядчиков", "Аудит продукта и рисков внедрения"],
    gives: "Аргументы для решения: что проверить, какие вопросы задать и на каких условиях двигаться дальше.",
    href: "/services/expertise", serviceType: "Независимая техническая экспертиза",
    fit: "Когда нужно второе мнение о цене, исполнителе или технической готовности продукта.",
    examples: ["Разбор предложения подрядчика", "Проверка компетенций кандидата", "Оценка рисков действующего продукта"],
  },
];

/** Every live URL, including the three original service pages and blog references. */
export const allServices: readonly Service[] = [...services, ...legacyServices];

export const serviceBySlug = (slug: ServiceSlug) => allServices.find((s) => s.slug === slug)!;

export const isServiceSlug = (v: string): v is ServiceSlug => allServices.some((s) => s.slug === v);

/** schema.org @id of a service — defined on its own page, referenced from the home and catalogue graphs. */
export const serviceId = (siteUrl: string, slug: ServiceSlug) => siteUrl + "/services/" + slug + "#service";
