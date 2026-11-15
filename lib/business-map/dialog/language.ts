import type { Workload } from "./contracts.ts";
const words: Record<string, string> = {
  один: "1",
  одна: "1",
  два: "2",
  две: "2",
  три: "3",
  четыре: "4",
  пять: "5",
  шесть: "6",
  семь: "7",
  восемь: "8",
  девять: "9",
  десять: "10",
  двенадцать: "12",
  тридцать: "30",
};
export function normalizeNumbers(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[−–]/g, "-")
    .replace(/[а-я]+/g, (w) => words[w] ?? w)
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/минус\s+(?=\d)/g, "-")
    .replace(/-\s+(?=\d)/g, "-");
}
export const unknownAnswer = (text: string) =>
  /^(?:не знаю|пока не знаю|нет данных|не измеряли|пропустить)[.! ]*$/iu.test(
    text.trim(),
  );
export function parseWorkloadText(text: string): Partial<Workload> {
  const s = normalizeNumbers(text),
    out: Partial<Workload> = {};
  // A per-person denominator is not headcount: «на 1 сотрудника» can precede «10 сотрудников».
  const headcountText = s.replace(
    /на\s+(?:одного|одну|1)\s+(?:сотрудник[а-я]*|человек[а-я]*|менеджер[а-я]*)/gu,
    " ",
  );
  const employees = headcountText.match(
    /(-?\d+(?:\.\d+)?)\s*(?:сотрудник|менеджер|человек|управляющ)/u,
  );
  if (employees) out.employees = Number(employees[1]);
  const ops =
    s.match(
      /(?:по\s+)(-?\d+(?:\.\d+)?)\s*(?:раз|отчет|операц|запис|заяв|обращ|провер|перенос)/u,
    ) ??
    s.match(
      /(-?\d+(?:\.\d+)?)\s*(?:раз|отчет|операц|запис|заяв|обращ|провер|перенос)/u,
    );
  const frequency = s.match(
    /(-?\d+(?:\.\d+)?)\s*(?:в|за)\s*(?:день|сутки|недел|месяц)/u,
  );
  if (ops ?? frequency) out.operations = Number((ops ?? frequency)![1]);
  if (/(?:кажд(?:ый|ого)|на\s+(?:(?:одного|одну|1)\s+)?(?:сотрудника|человека|менеджера)|по\s+\d)/u.test(s))
    out.scope = "per-person";
  else if (/вс(?:его|ей командой)|вместе|общ(?:ий|ее)|суммарно/u.test(s))
    out.scope = "team";
  else if (ops ?? frequency) out.scope = "unknown";
  if (/(?:в|за)\s+(?:день|сутки)|ежеднев/u.test(s)) out.period = "day";
  else if (/(?:в|за)\s+недел|еженедел/u.test(s)) out.period = "week";
  else if (/(?:в|за)\s+месяц|ежемесяч/u.test(s)) out.period = "month";
  const minutes = s.match(/(-?\d+(?:\.\d+)?)\s*мин/u);
  if (minutes) out.minutes = Number(minutes[1]);
  return out;
}

/** Only literal names in an explicit software phrase; never infer CRM functions. */
export function namedSystemMentions(text: string): string[] {
  return [...text.matchAll(/работа(?:ют|ем|ет)\s+(?:в|с)\s+([A-Za-z][A-Za-z0-9.+-]{1,39})/giu)]
    .map((m) => m[1])
    .filter((name) => !/^(?:crm|erp)$/iu.test(name));
}

/** A narrow explicit fact, not a confirmation inferred from the general problem score. */
export function manualReportingEvidence(text: string): string | null {
  if (text.includes("?")) return null;
  // Keep a preceding «Возможно,» attached to its sentence; it is not an asserted fact.
  const clauses = text.split(/[.;!]/u)
    .filter((sentence) => !/возможн|может|могут|предполож|планир|буд[еут]/iu.test(sentence))
    .flatMap((sentence) => sentence.split(","));
  return clauses.find((clause) =>
    /отч[её]т/iu.test(clause) && /вручную/iu.test(clause) &&
    /собира|готов|дела/iu.test(clause) &&
    !/(?:^|\s)(?:не|нет|без|если)\s/iu.test(clause),
  )?.trim().slice(0, 300) ?? null;
}
