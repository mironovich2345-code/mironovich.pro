import type { Metadata } from "next";
import ToolCard from "@/components/ToolCard";
import ToolPage from "@/components/tools/ToolPage";
import { tools } from "@/config/tools";
import { pageMetadata } from "@/lib/seo";

const title = "Инструменты для бизнеса";
const description = "Рассчитайте стоимость ручной работы, оцените автоматизацию и найдите процессы, которые стоит улучшить";
export const metadata: Metadata = pageMetadata({ title: title + " — MIRONOVICH", description, path: "/tools" });
const faq: [string, string][] = [
  ["Нужны ли регистрация и контакты?", "Нет. Результаты доступны бесплатно в браузере. Форма обращения открывается только по вашему желанию."],
  ["Можно ли переносить данные между инструментами?", "Да. После расчёта ручного труда можно перенести числовые параметры в оценку автоматизации. Они сохраняются в текущей вкладке до 24 часов; названия и описания не переносятся."],
  ["Это готовое коммерческое предложение?", "Нет. Формулы труда используют ваши данные. Модель внедрения — начальная инженерная гипотеза; денежные диапазоны не публикуются до её утверждения."],
];
export default function Tools() {
  return <ToolPage path="/tools" title={title} description={description} faq={faq}>
    <div className="grid gap-5 min-[760px]:grid-cols-2">{tools.map((tool) => <ToolCard key={tool.slug} tool={{ ...tool, description: tool.slug === "labor-cost" ? "Посчитайте, сколько времени и денег компания тратит на повторяющиеся операции" : "Ответьте на несколько вопросов и узнайте, какое решение может подойти вашему бизнесу." }} />)}</div>
  </ToolPage>;
}
