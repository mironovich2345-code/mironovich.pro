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
  { slug: "labor-cost", href: "/tools/labor-cost", title: "Сколько стоит ручной труд?", description: "Посчитайте стоимость рутинных процессов.", status: "available", tone: "red" },
  { slug: "automation-cost", href: "/tools/automation-cost", title: "Сколько стоит автоматизация?", description: "Оцените бюджет внедрения.", status: "available", tone: "dark" },
];

/** Requires a real /tools catalogue before enabling navigation. */
export const toolsNavigation = { enabled: true, href: "/tools", label: "Инструменты" };
