"use client";
import { useState } from "react";
import LeadForm from "@/components/LeadForm";
import { track } from "@/lib/analytics";
import type { ToolContext } from "@/lib/tools/context";
import { buttonClass } from "./Fields";
export default function CostConsultation({ context, description }: { context: ToolContext; description: string }) {
  const [open, setOpen] = useState(false);
  return <section aria-label="Консультация по затратам" className="mt-8 border border-cream/25 p-4 min-[560px]:p-6">
    <h3 className="m-0 font-display text-2xl font-extrabold uppercase">Что даст консультация</h3>
    <p className="text-sm leading-relaxed text-stone">Проверим реальные узкие места, причины затрат и целесообразность автоматизации. Определим приоритеты и требования к результату, затем выберем подходящее решение и условия небольшого пилота. Возможно, достаточно изменить порядок работы.</p>
    <p className="text-sm leading-relaxed text-stone">Первичная беседа бесплатна. Подробный разбор — отдельный согласованный объём. Расчёт доступен без заявки.</p>
    {!open ? <button type="button" className={buttonClass + " w-full"} aria-expanded={false} aria-controls="cost-contact" onClick={() => { setOpen(true); track("cta_click", { location: "tools" }); requestAnimationFrame(() => document.getElementById("lead-name")?.focus()); }}>Разобрать эти затраты с экспертом</button> : <div id="cost-contact">
      <h4 className="text-lg font-medium">Обсудим ваш расчёт</h4><p className="text-xs leading-relaxed text-stone">Параметры расчёта попадут в заявку только после вашего согласия и отправки. Сервер пересчитает показатели. Описание ниже можно изменить.</p>
      <LeadForm toolContext={context} defaultTask={description || "Хочу разобрать стоимость повторяющейся работы, причины затрат и целесообразность улучшений."} />
    </div>}
  </section>;
}
