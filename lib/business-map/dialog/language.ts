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
  const employees = s.match(
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
  if (/(?:кажд(?:ый|ого)|на (?:сотрудника|человека)|по\s+\d)/u.test(s))
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
