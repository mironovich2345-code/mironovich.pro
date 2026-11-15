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
    title: "Настройка CRM",
    href: "/services/automation",
    description: "Воронки, роли и рабочие процессы под задачу компании.",
  },
  {
    title: "API-интеграции",
    href: "/services/automation",
    description: "Обмен данными после проверки разрешённого API и доступов.",
  },
  {
    title: "ИИ-помощники",
    href: "/services/development",
    description: "Работа со знаниями и текстом с контролем качества.",
  },
  {
    title: "ИИ-тренажёры продаж",
    href: "/services/training",
    description: "Учебные диалоги и разбор по согласованным критериям.",
  },
  {
    title: "Голосовые ИИ-интеграции",
    href: "/services/automation",
    description:
      "Только после правовой проверки и подтверждения оснований для звонков; без стандартного холодного рекламного обзвона.",
  },
  {
    title: "Специализированные CRM",
    href: "/services/apps",
    description:
      "Приложение под специфичный процесс, если готовый сервис не подходит.",
  },
  {
    title: "Техническая экспертиза",
    href: "/services/expertise",
    description: "Разбор продукта, сметы или предложения подрядчика.",
  },
  {
    title: "Техническое сопровождение",
    href: "/services/support",
    description: "Согласованные работы по действующему продукту.",
  },
] as const;
