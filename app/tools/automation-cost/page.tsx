import type { Metadata } from "next";
import AutomationCalculator from "@/components/tools/AutomationCalculator";
import ToolPage from "@/components/tools/ToolPage";
import { pageMetadata } from "@/lib/seo";

// Availability is evaluated per request, not frozen into a build-time/static page.
export const dynamic = "force-dynamic";

const title = "Где бизнес тратит время и почему?";
const description = "Оцените стоимость повторяющейся работы и выясните, какие вопросы стоит разобрать. Способ улучшения выбирают после проверки процесса.";
export const metadata: Metadata = pageMetadata({ title: title + " — MIRONOVICH", description, path: "/tools/automation-cost" });
const faq: [string, string][] = [
 ["Нужно ли разбираться в технологиях?", "Нет. Достаточно выбрать повторяющуюся работу и указать известные вам замеры. Если сведений нет, результат покажет, что нужно выяснить, а не выдуманные цифры."],
 ["Обязательно ли использовать ИИ?", "Нет. Расчёт и объяснение причин работают без OpenAI, регистрации и заявки. Индивидуальный ИИ-консультант — отдельный этап, он не нужен для получения стоимости времени."],
 ["Это реальные потери или экономия?", "Нет. Показана стоимость рабочего времени по вашим данным, а не устранимая сумма затрат. Возможность улучшения и денежную экономию можно проверить только после разбора процесса и пилота."],
 ["Что даст консультация?", "Проверим реальные узкие места, целесообразность и приоритеты. Затем определим требования, подходящее решение и условия пилота. Первичная беседа бесплатна, подробный разбор имеет отдельный согласованный объём."],
];
export default function Automation() { return <ToolPage path="/tools/automation-cost" title={title} description={description} faq={faq}><AutomationCalculator /></ToolPage>; }
