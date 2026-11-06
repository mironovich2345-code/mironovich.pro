import { LABOR_VERSION, parseLaborInput, type LaborInput } from "./labor.ts";
import { record } from "./input.ts";

export const LABOR_STORAGE_KEY = "mrnv_labor_transfer_v1";
const TTL = 24 * 60 * 60 * 1000;
/** Names and free text never enter storage. Transfer stays in this browser tab. */
export function encodeLaborTransfer(input: LaborInput, now = Date.now()): string {
  const parsed = parseLaborInput(input);
  if (!parsed.ok) throw new RangeError("Invalid transfer");
  return JSON.stringify({ version: LABOR_VERSION, savedAt: now, input: parsed.value });
}
export function decodeLaborTransfer(raw: string | null, now = Date.now()): LaborInput | null {
  if (!raw || raw.length > 2000) return null;
  try {
    const obj = record(JSON.parse(raw));
    if (!obj || obj.version !== LABOR_VERSION || typeof obj.savedAt !== "number" || !Number.isFinite(obj.savedAt) || obj.savedAt > now || now - obj.savedAt > TTL) return null;
    const parsed = parseLaborInput(obj.input);
    return parsed.ok ? parsed.value : null;
  } catch { return null; }
}
