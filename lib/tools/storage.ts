import { parseGuided, GUIDED_VERSION } from "./guided.ts";
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

// v2 uses a separate key: old v1 numeric scenarios cannot silently become multi-process inputs.
export const GUIDED_STORAGE_KEY = "mrnv_tools_transfer_v2";
export function encodeGuidedTransfer(input: import("./guided.ts").GuidedInput, now = Date.now()): string {
  const parsed = parseGuided(input);
  if (!parsed) throw new RangeError("Invalid guided transfer");
  return JSON.stringify({ version: GUIDED_VERSION, savedAt: now, input: parsed });
}
export function decodeGuidedTransfer(raw: string | null, now = Date.now()): import("./guided.ts").GuidedInput | null {
  if (!raw || raw.length > 12000) return null;
  try {
    const s = record(JSON.parse(raw));
    if (!s || s.version !== GUIDED_VERSION || typeof s.savedAt !== "number" || !Number.isFinite(s.savedAt) || s.savedAt>now || now-s.savedAt>TTL) return null;
    return parseGuided(s.input);
  } catch { return null; }
}
