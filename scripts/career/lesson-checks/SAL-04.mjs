// SAL-04 checks: objection replies use only verified facts, never invented discounts, results, guarantees,
// case studies, competitor claims or pressure; a refusal is respected; the human chooses the reply.
import { rub, after } from "./helpers.mjs";

export default function check(l, data) {
  const out = [];
  const good = (ok, msg) => { if (!ok) out.push(msg); };
  const c = l.content, pl = data.priceList;
  const [k1, k2] = data.exercises;
  const [ex1, ex2] = c.exercises;

  // Exercise 1: every reply classified, the refusal is respected, motives are not invented.
  const types = new Map(k1.answerKey.types.map((t) => [t.reply, t]));
  for (const [reply, t] of types) {
    good(ex1.syntheticInput.includes(reply + " — «"), `reply ${reply} not in the input`);
    good(ex1.sampleSolution.includes(`${reply} — ${t.label}`), `sample solution misses the type of ${reply}`);
  }
  good([...types.values()].some((t) => t.type === "refusal") && /не писать до/.test(ex1.sampleSolution), "the refusal must be respected (no contact until the agreed date)");
  for (const t of ["invented_discount", "invented_motive", "unverified_claim", "ignored_refusal", "manipulation"]) good(k1.answerKey.findings.some((f) => f.type === t), `exercise 1 key lacks ${t}`);

  // Exercise 2: arithmetic from the price list (same fictional price list as SAL-03).
  const i = k2.inputs, n = k2.answerKey.numbers;
  const net = (seats) => { const g = seats * pl.pricePerSeatMonth * i.months; return g - Math.round(g * Math.min(i.discountPercent, pl.managerDiscountLimitPercent) / 100); };
  const g8 = i.proposedSeats * pl.pricePerSeatMonth * i.months;
  good(n.seats8Gross === g8 && n.seats8Net === net(i.proposedSeats) && n.seats8Discount === g8 - net(i.proposedSeats), "8-seat subscription and discount");
  good(n.seats8Total === net(i.proposedSeats) + pl.implementation, "implementation is a fixed fee regardless of seats");
  good(n.offerTotal === net(i.offerSeats) + pl.implementation, "offer total for 10 seats");
  good(n.withinBudget === (n.seats8Total <= i.clientBudget), "budget comparison");
  good(n.draftsChecked === k2.drafts.length && n.errorsBefore === k2.drafts.reduce((s, d) => s + d.errors, 0), "error count must equal the sum over drafts");
  good(n.errorsBefore === k2.answerKey.findings.length + 1, "error count: six quoted findings plus the pressure by fear in draft Б");
  for (const v of [rub(n.seats8Net), rub(n.seats8Total), rub(n.offerTotal)]) good(ex2.sampleSolution.includes(v), `sample solution misses ${v}`);

  // The final reply: chosen by the human, no invented terms.
  const final = after(ex2.sampleSolution, "Итоговый ответ");
  good(!!final, "sample solution needs a final reply");
  good(!/1[05]%|2\d%|3\d%|гарантир|наши клиенты|конкурент|до пятницы|30 000 ₽/i.test(final.slice(0, final.indexOf("Вопрос руководителю") > 0 ? final.indexOf("Вопрос руководителю") : undefined)), "final reply keeps an invented discount, result, guarantee, competitor claim, pressure or price");
  good(/Решение принимаю я, а не ИИ/.test(ex2.sampleSolution), "the human must make the choice");
  good(k2.drafts.filter((d) => d.chosen).length === 1 && k2.answerKey.chosenDraft === k2.drafts.find((d) => d.chosen).id, "exactly one chosen draft");
  good(pl.allowedCaseStudies.length === 0 && pl.allowedCustomerResults.length === 0 && pl.allowedCompetitorFacts.length === 0, "no case studies, customer results or competitor facts are allowed material");
  for (const t of ["invented_discount", "invented_result", "invented_guarantee", "invented_price", "manipulation"]) good(k2.answerKey.findings.some((f) => f.type === t), `exercise 2 key lacks ${t}`);

  // Templates: prompts forbid inventing terms and leave the choice to the human.
  const opt = c.templates.find((t) => t.id === "TPL-SAL04-PROMPT-OPTIONS");
  good(!!opt && ["скидки", "гарантии", "результаты", "кейсы", "конкурентах", "мотивы"].every((w) => opt.body.includes(w)) && /Не выбирай лучший вариант/.test(opt.body), "options prompt must forbid invented terms and leave the choice to the human");
  const choice = c.templates.find((t) => t.id === "TPL-SAL04-CHOICE");
  good(!!choice && /Решение принимает менеджер/.test(choice.body), "choice template must keep the decision with the manager");
  good(/вымышленн/.test(pl.managerDiscountLimitSource ?? "") && /вымышленн/.test(ex2.syntheticInput), "the 5% limit must be marked as a fictional company rule");
  return out;
}
