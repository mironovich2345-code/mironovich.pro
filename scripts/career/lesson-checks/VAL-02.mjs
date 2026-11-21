// VAL-02 checks: every number of the before → after comparison is recomputed from the raw rows
// (review and fix time included, comparable tasks only, percent of "before", percentage points for shares),
// and the recommended wording makes no causal claim.
import { after } from "./helpers.mjs";

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (part, base) => Math.round((part / base) * 100);
export const fmt = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, "")).replace(".", ",");
const CAUSAL = /благодаря ИИ|ИИ повысил|ИИ ускорил|ИИ увеличил|из-за ИИ/i;

export default function check(l, data) {
  const out = [];
  const good = (ok, msg) => { if (!ok) out.push(msg); };
  const [ex1, ex2] = l.content.exercises;
  const [k1, k2] = data.exercises;

  // Exercise 1.
  const n1 = k1.answerKey.numbers;
  const b = avg(k1.before.map((r) => r.minutes));
  const comp = k1.after.filter((r) => r.comparable);
  const a = avg(comp.map((r) => r.generation + r.review + r.fix));
  const gen = avg(comp.map((r) => r.generation));
  const bShare = pct(k1.before.filter((r) => !r.hasError).length, k1.before.length);
  const aShare = pct(comp.filter((r) => r.errorsLeft === 0).length, comp.length);
  good(n1.beforeAvg === b && n1.afterAvg === a, "exercise 1 averages (after = generation + review + fix on comparable tasks)");
  good(n1.generationOnlyAvg === gen && n1.generationOnlyPercent === -pct(b - gen, b), "exercise 1 generation-only figures");
  good(n1.absDiff === a - b && n1.percentChange === -pct(b - a, b), "exercise 1 difference and percent of the before value");
  good(n1.beforeShareOk === bShare && n1.afterShareOk === aShare && n1.percentagePoints === aShare - bShare, "exercise 1 quality shares and percentage points");
  good(n1.relativeQualityChange === pct(aShare - bShare, bShare), "exercise 1 relative quality change");
  good(n1.errorsFound === comp.reduce((s, r) => s + r.errorsFound, 0) && n1.errorsLeft === comp.reduce((s, r) => s + r.errorsLeft, 0), "exercise 1 error counts");
  good(JSON.stringify(n1.excluded) === JSON.stringify(k1.after.filter((r) => !r.comparable).map((r) => r.id)), "exercise 1 excluded tasks");
  for (const v of [`${fmt(b)} минут`, `${fmt(a)} минуты`, `${-n1.percentChange}%`, `+${n1.percentagePoints} процентных пунктов`]) good(ex1.sampleSolution.includes(v), `exercise 1 sample solution misses ${v}`);
  good(ex1.successCriteria.join(" ").includes(`−${-n1.percentChange}%`), "exercise 1 criteria miss the percent change");

  // Exercise 2.
  const n2 = k2.answerKey.numbers;
  const b2 = avg(k2.before.map((r) => r.minutes));
  const a2 = avg(k2.afterLongMeetings.filter((r) => r.comparable).map((r) => r.generation + r.review));
  good(k2.afterShortCalls.every((r) => r.comparable === false), "short calls must be excluded");
  good(n2.beforeAvg === b2 && n2.afterAvg === a2 && n2.absDiff === a2 - b2 && n2.percentChange === -pct(b2 - a2, b2), "exercise 2 recomputed comparison");
  const c1 = pct(k2.before.filter((r) => r.complete).length, k2.before.length), c2 = pct(k2.afterLongMeetings.filter((r) => r.complete).length, k2.afterLongMeetings.length);
  good(n2.beforeComplete === c1 && n2.afterComplete === c2 && n2.percentagePoints === c2 - c1, "exercise 2 complete-summary shares");
  good(k2.claim.correctPercent === -pct(k2.claim.before - k2.claim.after, k2.claim.before) && k2.claim.claimedPercent !== -k2.claim.correctPercent, "exercise 2 claimed percent must be shown wrong");
  good(ex2.sampleSolution.includes(`уменьшение на ${-k2.claim.correctPercent}%`), "exercise 2 sample solution must correct the claimed percent");
  good(k2.otherChanges.length >= 1 && k2.otherChanges.every((c) => ex2.syntheticInput.includes(c)), "exercise 2 other changes of the period must be in the input");
  for (const t of ["not_comparable", "review_time_ignored", "different_method", "percent_base", "false_causation"]) good(k2.answerKey.findings.some((f) => f.type === t), `exercise 2 key lacks ${t}`);

  // Wording: no causal claims, limitations stated.
  for (const [ex, marker] of [[ex1, "Формулировка:"], [ex2, "Корректная формулировка:"]]) {
    const w = after(ex.sampleSolution, marker);
    good(!!w && !CAUSAL.test(w) && /[Вв]ыборка мала/.test(w), `${ex.id}: wording must state limits and make no causal claim`);
  }
  const tpl = l.content.templates.find((t) => t.id === "TPL-VAL02-WORDING");
  good(!!tpl && /а не «ИИ повысил» или «благодаря ИИ»/.test(tpl.body), "wording template must warn against causal phrases");
  return out;
}
