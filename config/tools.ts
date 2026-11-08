export type ToolDefinition = {
  slug: string;
  href: string;
  title: string;
  description: string;
  status: "coming-soon" | "available";
  tone: "red" | "dark";
};

/** Enable links only when the corresponding calculators have been implemented. */
export const tools: readonly ToolDefinition[] = [
  { slug: "labor-cost", href: "/tools/labor-cost", title: "Сколько стоит ручной труд?", description: "Посчитайте часы и стоимость повторяющейся работы за месяц и год по вашим данным.", status: "available", tone: "red" },
  { slug: "automation-cost", href: "/tools/automation-cost", title: "Где бизнес тратит время и почему?", description: "Проверьте причины затрат и узнайте, что нужно выяснить до выбора способа улучшения.", status: "available", tone: "dark" },
];

/** Requires a real /tools catalogue before enabling navigation. */
export const toolsNavigation = { enabled: true, href: "/tools", label: "Инструменты" };
