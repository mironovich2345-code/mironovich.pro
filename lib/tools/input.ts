export type FieldErrors = Record<string, string>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export const record = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;

export function numberField(v: unknown, min: number, max: number, integer = false): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v));
}

/** Decimal comma is accepted in the UI, but empty, exponent and partial input are not numbers. */
export function parseDecimal(text: string): number {
  const s = text.trim().replace(",", ".");
  return /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;
}
