// MAP-02 checks: the responsibility scheme keeps decisions and client-facing or CRM/terms actions with people,
// AI only prepares; no automatic sending, CRM changes or commercial terms without permission and control;
// variant comparison and "not worth automating" arithmetic are recomputed.
const HUMAN = new Set(["employee", "manager"]);

export default function check(l, data) {
  const out = [];
  const good = (ok, msg) => { if (!ok) out.push(msg); };
  const c = l.content;
  const [k1, k2, k3] = data.exercises;

  // Scheme of responsibility (exercise 1).
  const scheme = k1.answerKey.scheme;
  for (const k of ["preparation", "review", "decision", "action"]) good(scheme.some((p) => p.kind === k), `scheme lacks a ${k} part`);
  for (const p of scheme) {
    if (p.performer === "ai") good(p.kind === "preparation" && HUMAN.has(p.controller), `AI may only prepare under human control: ${p.part}`);
    if (p.kind === "decision" || p.kind === "action") good(HUMAN.has(p.performer) || (p.performer === "system" && HUMAN.has(p.confirmedBy)), `decision or action must stay with a person: ${p.part}`);
  }
  good(k1.rules.integrations.length === 0 && !scheme.some((p) => p.performer === "system"), "no system part without an approved integration");
  for (const t of ["personal_data", "auto_send", "ai_decision", "crm_change", "commercial_terms"]) good(k1.answerKey.findings.some((f) => f.type === t), `exercise 1 key lacks ${t}`);

  // Variant comparison (exercise 2).
  const i = k2.inputs, n = k2.answerKey.numbers;
  const v = Object.fromEntries(k2.variants.map((x) => [x.id, x]));
  good(n.manualPerDay === i.perDay * v.manual.minutesPerItem && n.assistantPerDay === i.perDay * v.assistant.minutesPerItem && n.autoPerDay === i.perDay * v.auto_send.minutesPerItem, "exercise 2 minutes per day");
  good(n.savingPerDay === n.manualPerDay - n.assistantPerDay && n.savingPercent === Math.round((n.savingPerDay / n.manualPerDay) * 100), "exercise 2 saving");
  const chosen = v[k2.answerKey.chosen];
  good(!!chosen && chosen.available && chosen.humanSends, "the chosen variant must be permitted and keep sending with a person");
  good(!i.integrationApproved ? k2.variants.filter((x) => x.id !== "manual" && x.id !== "assistant").every((x) => !x.available) : true, "variants needing an unapproved integration must be unavailable");
  good(v.auto_send.humanSends === false && k2.answerKey.chosen !== "auto_send", "automatic sending must never be chosen");

  // Not worth automating (exercise 3).
  const i3 = k3.inputs, n3 = k3.answerKey.numbers;
  good(n3.prepPerMonth === i3.meetingsPerMonth * i3.prepMinutes && n3.claimedSavingPerMonth === i3.meetingsPerMonth * i3.claimedSavingPerMeeting, "exercise 3 monthly figures");
  good(k3.answerKey.conclusion === "automation_not_justified" && k3.answerKey.reasons.length >= 5, "exercise 3 must justify not automating with at least five reasons");
  good(!i3.dataTransferAllowed && k3.answerKey.reasons.includes("data_forbidden"), "forbidden data must be a reason");

  // Coverage of B2B, inbound and account management; prompts forbid unsafe automation.
  good(["outbound_b2b", "inbound", "account"].every((s) => data.exercises.some((x) => x.subtype === s)), "exercises must cover B2B, inbound and account management");
  for (const t of c.templates.filter((x) => x.kind === "prompt")) good(/Не предлагай автоматическую отправку сообщений, изменение CRM и коммерческих условий/.test(t.body), `prompt ${t.id} must forbid automatic sending, CRM changes and terms`);
  const split = c.templates.find((t) => t.id === "TPL-MAP02-SPLIT");
  good(!!split && /ИИ выполняет только подготовку/.test(split.body), "split template must limit AI to preparation");
  return out;
}
