import type { Metadata } from "next";
import AutomationCalculator from "@/components/tools/AutomationCalculator";
import ToolPage from "@/components/tools/ToolPage";
import { pageMetadata } from "@/lib/seo";

const title = "Подберите способ автоматизации";
const description = "Ответьте на несколько вопросов и узнайте, какое решение может подойти вашему бизнесу";
export const metadata: Metadata = pageMetadata({ title: title + " — MIRONOVICH", description, path: "/tools/automation-cost" });
const faq: [string, string][] = [
 ["Нужно ли разбираться в технологиях?", "Нет. Выберите задачи или опишите проблему. Используемые программы и последствия ошибки можно уточнить двумя необязательными вопросами."],
 ["Обязательно ли использовать ИИ?", "Нет. Сначала рассматриваются готовые сервисы, интеграции и обычные правила. Базовый разбор не вызывает внешнюю модель. Для ИИ нужны отдельное действие и подтверждение уведомления."],
 ["Можно ли узнать бюджет и экономию?", "По нескольким категориям нельзя честно определить бюджет, сроки или экономию. Их здесь не придумывают. Собственные замеры ручного труда и стоимости времени переносятся из первого инструмента."],
 ["Как проверить рекомендации?", "Каждая карточка содержит предположения, необходимые проверки и способ измерить эффект. Возможности программ, права и законность обработки подтверждаются до небольшого пилота с контролем человека."],
];
export default function Automation() { return <ToolPage path="/tools/automation-cost" title={title} description={description} faq={faq}><AutomationCalculator /></ToolPage>; }
