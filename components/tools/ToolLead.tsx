"use client";

import { useState } from "react";
import LeadForm from "@/components/LeadForm";
import type { ToolContext } from "@/lib/tools/context";
import { buttonClass } from "./Fields";
import { track } from "@/lib/analytics";

export default function ToolLead({ context, description = "" }: { context: ToolContext; description?: string }) {
  const [open, setOpen] = useState(false);
  return <div className="mt-8 border-t border-cream/20 pt-6">
    {!open ? <button type="button" className={buttonClass + " w-full"} aria-expanded={false} aria-controls="tool-contact" onClick={() => { setOpen(true); track("cta_click", { location: "tools" }); requestAnimationFrame(() => document.getElementById("lead-name")?.focus()); }}>Получить план внедрения</button> :
      <div id="tool-contact">
        <h3 className="m-0 mb-3 font-display text-2xl font-extrabold uppercase text-cream">Обсудим следующий шаг</h3>
        <p className="m-0 mb-6 text-[14px] leading-[1.6] text-stone">В заявку войдут параметры и результат расчёта. Сервер проверит данные и пересчитает показатели. Название процесса не передаётся; описание ниже можно изменить. Первичное обсуждение бесплатно.</p>
        <LeadForm toolContext={context} defaultTask={description.slice(0, 2000) || "Хочу обсудить результат расчёта и получить план внедрения."} />
      </div>}
  </div>;
}
