export const ctoOffer = {
  monthlyPrice: 150000,
  hours: 30,
  allocation: [
    { label: "Стратегия и приоритеты", hours: 6 },
    { label: "Подготовка технических решений", hours: 5 },
    { label: "Оценка смет и подрядчиков", hours: 5 },
    { label: "Координация разработчиков", hours: 6 },
    { label: "Контроль качества и приёмка", hours: 5 },
    { label: "Отчётность и планирование", hours: 3 },
  ],
} as const;
export const additionalServices = [
  {
    id: "crm",
    service: "automation",
    title: "Настройка CRM",
    href: "/services/automation#crm",
    description: "Воронки, роли и рабочие процессы под задачу компании.",
  },
  {
    id: "api",
    service: "automation",
    title: "API-интеграции",
    href: "/services/automation#api",
    description: "Обмен данными после проверки разрешённого API и доступов.",
  },
  {
    id: "ai-assistants",
    service: "development",
    title: "ИИ-помощники",
    href: "/services/development#ai-assistants",
    description: "Работа со знаниями и текстом с контролем качества.",
  },
  {
    id: "sales-trainers",
    service: "training",
    title: "ИИ-тренажёры продаж",
    href: "/services/training#sales-trainers",
    description: "Учебные диалоги и разбор по согласованным критериям.",
  },
  {
    id: "voice-ai",
    service: "automation",
    title: "Голосовые ИИ-интеграции",
    href: "/services/automation#voice-ai",
    description:
      "Только после правовой проверки и подтверждения оснований для звонков; без стандартного холодного рекламного обзвона.",
  },
  {
    id: "custom-crm",
    service: "apps",
    title: "Специализированные CRM",
    href: "/services/apps#custom-crm",
    description:
      "Приложение под специфичный процесс, если готовый сервис не подходит.",
  },
  {
    id: "expertise",
    service: "expertise",
    title: "Техническая экспертиза",
    href: "/services/expertise#expertise",
    description: "Разбор продукта, сметы или предложения подрядчика.",
  },
  {
    id: "support",
    service: "support",
    title: "Техническое сопровождение",
    href: "/services/support#support",
    description: "Согласованные работы по действующему продукту.",
  },
] as const;
export type ServiceTopicId = (typeof additionalServices)[number]["id"];
