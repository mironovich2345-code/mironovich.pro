// SAL-03 checks: offer arithmetic recomputed from the raw practice data, and prices, discounts, terms and
// guarantees stay out of the model's hands; an authorised person approves before sending.
import { rub, addWorkingDays, addDays, dm, after } from "./helpers.mjs";

export default function check(l, data, ctx) {
  const out = [];
  const good = (ok, msg) => { if (!ok) out.push(msg); };
  const c = l.content, pl = data.priceList;
  const [k1, k2] = data.exercises;
  const [ex1, ex2] = c.exercises;
  // Exercise 2 numbers.
  const i = k2.inputs, n = k2.answerKey.numbers;
  const gross = i.seats * pl.pricePerSeatMonth * i.months;
  const disc = Math.round(gross * Math.min(i.discountPercent, pl.managerDiscountLimitPercent) / 100);
  good(n.subscriptionGross === gross, "subscription gross does not match price list");
  good(n.discount === disc && n.subscriptionNet === gross - disc, "discount must apply to the subscription only, within the manager limit");
  good(n.implementation === pl.implementation && n.firstYearTotal === gross - disc + pl.implementation, "first-year total");
  good(n.launchDate === addWorkingDays(i.dataReceivedOn, pl.implementationWorkingDays), "launch date must be counted in working days after data");
  good(n.validUntil === addDays(i.offerDate, pl.validityCalendarDays), "offer validity date");
  good(n.extraTrainingCost === (i.requestedTrainingSessions - pl.includedTrainingSessions) * pl.extraTrainingSession, "extra training cost");
  const m = k2.measurement;
  good(n.aiTotalMinutes === m.aiGenerationMinutes + m.aiReviewMinutes, "AI time must include review");
  for (const v of [rub(gross), rub(disc), rub(gross - disc), rub(n.firstYearTotal)]) good(ex2.sampleSolution.includes(v), `sample solution misses ${v}`);
  good(ex2.sampleSolution.includes(dm(n.launchDate)) && ex2.sampleSolution.includes(dm(n.validUntil)), "sample solution misses launch or validity date");
  good(ex2.successCriteria.join(" ").includes(rub(n.firstYearTotal)), "success criteria miss the first-year total");
  good(k1.answerKey.preliminaryMonthlyFor12Seats === 12 * pl.pricePerSeatMonth && ex1.sampleSolution.includes(rub(12 * pl.pricePerSeatMonth)), "exercise 1 preliminary estimate");
  // Human approval: the safe outputs never carry terms the authorised person has not approved.
  const final2 = after(ex2.sampleSolution, "Безопасный итоговый вариант");
  good(final2 && !final2.includes(i.requestedDiscountPercent + "%") && /только после ответа руководителя/.test(final2), "safe final offer must exclude the requested discount and wait for the manager");
  const fixed1 = after(ex1.sampleSolution, "Исправленный черновик");
  good(fixed1 && /не отправлять до согласования/.test(fixed1) && !/15%|24\/7|гарантир/.test(fixed1), "corrected draft keeps invented terms or lacks the draft status");
  good(k2.answerKey.questionsForManager.some((q) => q.includes(i.requestedDiscountPercent + "%")), "requested discount must go to the manager");
  // Templates: prompts forbid inventing terms; the offer template is a draft until approved.
  for (const t of c.templates.filter((x) => x.kind === "prompt")) {
    good(/[Нн]е добавляй|[Нн]е предлагай новых условий/.test(t.body) && /скидк/.test(t.body), `prompt ${t.id} must forbid adding discounts and terms`);
  }
  const draft = c.templates.find((t) => t.id === "TPL-SAL03-PROMPT-DRAFT");
  good(!!draft && ["цены", "скидки", "сроки", "гарантии"].every((w) => draft.body.includes(w)) && /[Нн]е назначай скидки/.test(draft.body), "draft prompt must forbid setting prices, discounts, terms and guarantees");
  const offer = c.templates.find((t) => t.id === "TPL-SAL03-OFFER");
  good(!!offer && /ЧЕРНОВИК/.test(offer.body) && /подтверждение уполномоченного/.test(offer.body), "offer template must stay a draft until an authorised person confirms");
  good(c.procedure.some((p) => /Отправляйте КП только после/.test(p.instruction)), "procedure must gate sending on the authorised person");
  const types = k1.answerKey.findings.map((f) => f.type);
  for (const t of ["invented_price", "invented_discount", "invented_term", "invented_commitment", "invented_claim"]) good(types.includes(t), `exercise 1 key lacks ${t}`);
  good(k2.answerKey.findings.some((f) => f.type === "authority_exceeded"), "exercise 2 key lacks an authority finding");
  // Legal and evidence framing (owner review of 19.11.2026): an offer is not automatically an offer in law,
  // the 5% limit is the fictional company's rule, the support study is only an example from another field,
  // and the final legal acceptance stays open.
  good(/не является офертой автоматически/.test(c.explanations[0].body) && /может быть признано офертой, если выполнены условия закона/.test(c.explanations[0].body), "offer wording must say an offer is not automatic");
  good(/правилам вымышленной учебной компании/.test(ex1.syntheticInput) && /правилам вымышленной компании/.test(ex2.syntheticInput), "the 5% limit must be marked as a fictional company rule");
  good(/fictional|вымышленной/.test(pl.managerDiscountLimitSource ?? ""), "price list must mark the discount limit as fictional");
  const study = l.sources.find((s) => s.id === "SRC-ARXIV-GENAI-AT-WORK");
  good(!study || (/Пример из другой сферы/.test(study.supportsClaim) && /не является/.test(study.supportsClaim)), "support study may only be an example from another field");
  good(!/(рост|прирост)[^.]*(подготовк|составлени)[^.]*КП/.test(JSON.stringify(c)), "no claim that AI speeds up offer writing");
  for (const s of (ctx?.registry?.sources ?? []).filter((x) => x.kind === "law")) {
    good(s.officialPublicationCheck?.legalAcceptance === "open", `law source ${s.id} must keep legal acceptance open`);
  }
  good(l.quality.reviewedOn === null && /правовая приёмка открыта/.test(l.quality.notes), "quality notes must keep legal acceptance open");
  return out;
}
