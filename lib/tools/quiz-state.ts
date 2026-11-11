import { record } from "./input.ts";
import { taskLabels, type Task } from "./guided.ts";
import { QUIZ_VERSION, knownHasTime, parseKnownCost, parseQuizDiagnosis, type KnownCost, type QuizDiagnosis } from "./quiz-model.ts";
import { taskWorkspaceState, cleanLaborDraft, initialLaborDraft, laborSteps, type LaborDraft, type QuizStep } from "./quiz-draft.ts";
export type QuizMode = "labor-cost" | "automation-cost";
export type DiagnosisDraft = { tasks: Task[]; obstacle: QuizDiagnosis["obstacle"] | ""; frequency: Exclude<QuizDiagnosis["frequency"], "measured"> | ""; consequence: QuizDiagnosis["consequence"] | ""; known: KnownCost | null };
export const initialDiagnosis = (known: KnownCost | null = null): DiagnosisDraft => ({ tasks: known?.input.tasks ?? [], obstacle: "", frequency: "", consequence: "", known });
export function diagnosisSteps(d: DiagnosisDraft): QuizStep[] {
  return [{ id: "obstacle", kind: "obstacle" }, ...(!d.known ? [{ id: "processes", kind: "processes" } as QuizStep] : []), ...(d.obstacle === "unclear" ? [] : [...(d.obstacle === "time" && d.known && knownHasTime(d.known) ? [] : [{ id: "issue_frequency", kind: "issue_frequency" } as QuizStep]), { id: "consequence", kind: "consequence" } as QuizStep])];
}
export function buildDiagnosis(d: DiagnosisDraft): QuizDiagnosis | null {
  return parseQuizDiagnosis({ tasks: d.tasks, obstacle: d.obstacle, frequency: d.obstacle === "unclear" ? "unknown" : d.obstacle === "time" && d.known && knownHasTime(d.known) ? "measured" : d.frequency, consequence: d.obstacle === "unclear" ? "unknown" : d.consequence, known: d.known });
}
export function diagnosisStepError(d: DiagnosisDraft, step: QuizStep): string | null {
  if (step.kind === "processes") return d.tasks.length ? null : "Выберите хотя бы один процесс.";
  if (step.kind === "obstacle") return d.obstacle ? null : "Выберите проблему или «Пока трудно определить».";
  if (step.kind === "issue_frequency") return d.frequency ? null : "Укажите частоту проблемы или «Пока не знаю».";
  if (step.kind === "consequence") return d.consequence ? null : "Выберите последствия или «Пока не измеряли».";
  return null;
}
export const checkpointKey = (mode: QuizMode) => `mrnv_quiz_v4_${mode}`;
export const QUIZ_TRANSFER_KEY = "mrnv_quiz_transfer_v4";
const TTL = 86400000;
function cleanDiagnosis(raw: unknown): DiagnosisDraft | null {
  const s = record(raw);
  if (!s || !Array.isArray(s.tasks) || s.tasks.length > 9 || new Set(s.tasks).size !== s.tasks.length || !s.tasks.every(t => typeof t === "string" && Object.hasOwn(taskLabels, t)) || !["", "time", "reentry", "errors", "waiting", "unclear"].includes(String(s.obstacle)) || !["", "often", "sometimes", "rare", "unknown"].includes(String(s.frequency)) || !["", "time", "client", "financial", "unknown"].includes(String(s.consequence))) return null;
  const known = s.known === null ? null : parseKnownCost(s.known);
  if (s.known !== null && !known) return null;
  return { tasks: [...s.tasks] as Task[], obstacle: s.obstacle as DiagnosisDraft["obstacle"], frequency: s.obstacle === "unclear" ? "unknown" : s.frequency as DiagnosisDraft["frequency"], consequence: s.obstacle === "unclear" ? "unknown" : s.consequence as DiagnosisDraft["consequence"], known };
}
export function encodeCheckpoint(mode: QuizMode, draft: LaborDraft | DiagnosisDraft, step: string, now = Date.now(), activeTask?: Task): string {
  const clean = mode === "labor-cost" ? cleanLaborDraft(draft) : cleanDiagnosis(draft);
  if (!clean) throw new RangeError("Invalid wizard checkpoint");
  return JSON.stringify({ version: QUIZ_VERSION, mode, savedAt: now, step, draft: clean, ...(activeTask && clean.tasks.includes(activeTask) ? { activeTask } : {}) });
}
export function decodeCheckpoint(mode: QuizMode, raw: string | null, now = Date.now()): { draft: LaborDraft | DiagnosisDraft; step: string; activeTask?: Task } | null {
  if (!raw || raw.length > 20000) return null;
  try {
    const s = record(JSON.parse(raw));
    if (!s || s.version !== QUIZ_VERSION || s.mode !== mode || typeof s.savedAt !== "number" || !Number.isFinite(s.savedAt) || s.savedAt > now || now - s.savedAt > TTL) return null;
    const draft = mode === "labor-cost" ? cleanLaborDraft(s.draft) : cleanDiagnosis(s.draft);
    if (!draft) return null;
    const steps = mode === "labor-cost" ? laborSteps(draft as LaborDraft) : diagnosisSteps(draft as DiagnosisDraft);
    const activeTask = typeof s.activeTask === "string" && draft.tasks.includes(s.activeTask as Task) ? s.activeTask as Task : draft.tasks[0];
    const complete = mode === "labor-cost" ? activeTask && taskWorkspaceState(draft as LaborDraft, activeTask).input : buildDiagnosis(draft as DiagnosisDraft);
    return { draft, step: s.step === "result" && complete ? "result" : steps.some(step => step.id === s.step) ? s.step as string : steps[0].id, ...(activeTask ? { activeTask } : {}) };
  } catch { return null; }
}
export function encodeQuizTransfer(known: KnownCost, now = Date.now()): string {
  const clean = parseKnownCost(known);
  if (!clean) throw new RangeError("Invalid transfer");
  return JSON.stringify({ version: QUIZ_VERSION, savedAt: now, known: clean });
}
export function decodeQuizTransfer(raw: string | null, now = Date.now()): KnownCost | null {
  if (!raw || raw.length > 16000) return null;
  try { const s = record(JSON.parse(raw)); return s && s.version === QUIZ_VERSION && typeof s.savedAt === "number" && Number.isFinite(s.savedAt) && s.savedAt <= now && now - s.savedAt <= TTL ? parseKnownCost(s.known) : null; } catch { return null; }
}
export const initialQuizDraft = (mode: QuizMode) => mode === "labor-cost" ? initialLaborDraft() : initialDiagnosis();
