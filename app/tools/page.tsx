import type { Metadata } from "next";
import ToolCard from "@/components/ToolCard";
import ToolPage from "@/components/tools/ToolPage";
import { tools } from "@/config/tools";
import { pageMetadata } from "@/lib/seo";

const title = "Инструменты для бизнеса";
const description = "Оцените стоимость повторяющейся работы и причины затрат. Результат доступен без заявки и обещаний экономии.";
export const metadata: Metadata = pageMetadata({ title: title + " — MIRONOVICH", description, path: "/tools" });
const faq: [string, string][] = [
  ["Нужны ли регистрация и контакты?", "Нет. Результаты доступны бесплатно в браузере. Форма обращения открывается только по вашему желанию."],
  ["Можно ли переносить данные между инструментами?", "Да. Процессы и числовые параметры сохраняются в текущей вкладке до 24 часов по вашему переходу. Произвольные названия и описания не сохраняются."],
  ["Это готовое коммерческое предложение?", "Нет. Формулы используют ваши данные и явно обозначенные допущения. Стоимость времени не равна экономии; решение и условия пилота определяются после проверки процесса."],
];
export default function Tools() {
  return <ToolPage path="/tools" title={title} description={description} faq={faq}>
    <div className="grid gap-5 min-[760px]:grid-cols-2">{tools.map((tool) => <ToolCard key={tool.slug} tool={tool} />)}</div>
  </ToolPage>;
}
