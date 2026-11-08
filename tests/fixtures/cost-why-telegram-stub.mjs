// Test-only preload. Never configure this in production or with working credentials.
import fs from "node:fs";
if (process.env.TOOLS_V3_TEST_STUB !== "true" || process.env.TELEGRAM_BOT_TOKEN !== "LOCAL_COST_WHY_TEST_ONLY" || process.env.TELEGRAM_CHAT_ID !== "LOCAL_COST_WHY_TEST_ONLY" || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.VERCEL_ENV) throw new Error("Synthetic local preview credentials and explicit test mode required");
const report = process.env.TOOLS_V3_STUB_REPORT || "/tmp/tools-v3-delivery.json";
const original = globalThis.fetch;
let count = 0;
fs.writeFileSync(report, JSON.stringify({ count }));
globalThis.fetch = async function (input, options) {
  const url = input instanceof Request ? input.url : String(input);
  if (url === "https://api.telegram.org/botLOCAL_COST_WHY_TEST_ONLY/sendMessage") {
    const { text } = JSON.parse(options.body);
    // Persist only outcomes, never names, contacts, request/response text or tokens.
    fs.writeFileSync(report, JSON.stringify({ count: ++count, costVersion: text.includes("tools-cost-3.0.0"), serverRecalculated: text.includes("пересчитано сервером"), has39600: text.includes("39600"), has475200: text.includes("475200"), monthlyBasis: text.includes("96000") && text.includes("160"), unknownCost: text.includes("стоимость неизвестна"), noForgedTotals: !text.includes("999999"), escaped: text.includes("&lt;контекста&gt;") && text.includes("&amp;") }));
    return Response.json({ ok: true, result: { message_id: count } });
  }
  if (url.includes("api.telegram.org") || url.includes("api.openai.com")) throw new Error("External provider calls forbidden in synthetic preview");
  return original.apply(this, arguments);
};
