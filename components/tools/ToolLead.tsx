"use client";

import { useState } from "react";
import LeadForm from "@/components/LeadForm";
import type { ToolContext } from "@/lib/tools/context";
import { buttonClass } from "./Fields";
import { track } from "@/lib/analytics";

export default function ToolLead({ context, description = "", variant = "primary", actionPlan = false }: { context: ToolContext; description?: string; variant?: "primary" | "secondary"; actionPlan?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="mt-8 border-t border-cream/20 pt-6">
    {actionPlan && <p className="mb-4 text-sm leading-relaxed text-stone">Специалист проверит расчёт, уточнит данные и согласует формат подготовки подробного плана.</p>}
    {!open ? <button type="button" className={variant === "secondary" ? "inline-flex min-h-[52px] w-full items-center justify-center border border-cream/40 px-5 py-3 text-center text-sm font-medium uppercase text-cream transition-colors hover:border-cream hover:bg-cream/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal" : buttonClass + " w-full"} aria-expanded={false} aria-controls="tool-contact" onClick={() => { setOpen(true); track("cta_click", { location: "tools" }); requestAnimationFrame(() => document.getElementById("lead-name")?.focus()); }}>{actionPlan ? "Заказать подробный план внедрения" : "Получить план внедрения"}</button> :
      <div id="tool-contact">
        <h3 className="m-0 mb-3 font-display text-2xl font-extrabold uppercase text-cream">Обсудим следующий шаг</h3>
        <p className="m-0 mb-6 text-[14px] leading-[1.6] text-stone">{actionPlan ? "После обращения специалист проверит расчёт, уточнит данные и согласует формат подготовки подробного плана. Ответы и названия программ попадут в заявку только после согласия и отправки формы. Сервер сформирует план заново; описание задачи ниже можно изменить." : "В заявку войдут параметры и результат расчёта. Сервер проверит данные и пересчитает показатели. Название процесса не передаётся; описание ниже можно изменить. Первичное обсуждение бесплатно."}</p>
        <LeadForm toolContext={context} defaultTask={description.slice(0, 2000) || "Хочу обсудить результат расчёта и получить план внедрения."} />
      </div>}
  </div>;
}
