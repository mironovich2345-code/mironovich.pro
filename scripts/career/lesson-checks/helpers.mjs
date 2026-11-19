// Shared helpers for lesson-specific checks (scripts/career/lesson-checks/<LESSON-ID>.mjs).
export const rub = (n) => n.toLocaleString("ru-RU").replace(/\s/g, " ") + " ₽";
export const iso = (d) => d.toISOString().slice(0, 10);
export function addWorkingDays(isoDate, n) {
  const d = new Date(isoDate + "T00:00:00Z");
  while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() % 6 !== 0) n--; }
  return iso(d);
}
export const addDays = (isoDate, n) => { const d = new Date(isoDate + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const dm = (isoDate) => isoDate.slice(8, 10) + "." + isoDate.slice(5, 7) + "." + isoDate.slice(0, 4);
export const after = (s, marker) => (s.includes(marker) ? s.slice(s.indexOf(marker)) : "");
