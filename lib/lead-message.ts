type MessageInput = { name: string; phone: string; task: string; company: string; direction: string; page: string; date: string; consentVersion: string; context: string; attribution: Record<string, string> };

/** Cap escaped length without cutting an entity, tag or surrogate pair. */
export function escapedField(text: string, limit: number): string {
  let out = "";
  for (const char of text) {
    const next = char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : char;
    if (out.length + next.length > limit - 1) return out + "…";
    out += next;
  }
  return out;
}

export function formatLeadMessage(i: MessageInput): string {
  const field = (title: string, value: string, max: number) => value ? `<b>${title}:</b>\n${escapedField(value, max)}\n\n` : "";
  const diagnosis = i.context.includes("План:\n");
  const costReview = i.context.startsWith("Стоимость повторяющейся работы · tools-cost-3.0.0") || i.context.startsWith("Интерактивный разбор · tools-quiz-4.0.0");
  const detailed = diagnosis || costReview;
  const prefix = "<b>НОВАЯ ЗАЯВКА С САЙТА</b>\n\n" +
    field("Имя", i.name, 160) + field("Компания", i.company, 160) + field("Контакт", i.phone, 100) +
    field("Направление", i.direction, 80);
  const suffix = field("КОНТЕКСТ РАСЧЁТА", i.context, costReview ? 2400 : diagnosis ? 2200 : 1300) + field("Страница", i.page, 120) +
    field("Дата", i.date, 50) + field("Согласие на обработку ПД", "получено, редакция " + i.consentVersion, 80) +
    "<b>ИСТОЧНИК</b>\n" + ["utm_source", "utm_medium", "utm_campaign", "utm_content", "referrer", "landingPage"]
      .map((k) => `${k}: ${escapedField(i.attribution[k] || "unknown", 60)}`).join("\n");
  // Reserve the complete structured plan, then use remaining Telegram space for the task.
  const taskWrapper = field("Задача", "x", 2).length - 1;
  const taskLimit = detailed ? Math.min(1000, 4095 - prefix.length - suffix.length - taskWrapper) : 1000;
  return prefix + field("Задача", i.task, taskLimit) + suffix;
}
