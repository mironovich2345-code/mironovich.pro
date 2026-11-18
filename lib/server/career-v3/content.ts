// Server adapter: reads AI Career 3.0 content from content/career/v3 and builds the library and
// diagnostic context for one profession. Only the repository content root is ever read here —
// test fixtures are passed to the pure engine directly and can never reach this loader.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { buildLibrary } from "../../career-v3/library.ts";
import { validateDiagnosticConfig, type DiagnosticContext } from "../../career-v3/diagnostic.ts";
import type {
  Curriculum, DiagnosticDefinition, LibraryIndex, ProfessionConfig, ProfessionRegistry, RoleMatrix,
} from "../../career-v3/types.ts";

export const REGISTRY_PATH = "content/career/v3/professions.json";
const CONTENT_PREFIX = "content/career/v3/";

export class ProfessionUnavailableError extends Error {
  status = 404;
}

function repoRoot(): string {
  return process.cwd();
}

function safePath(relative: string): string {
  if (!relative.startsWith(CONTENT_PREFIX) || relative.includes("..") || path.isAbsolute(relative))
    throw new Error(`content path outside ${CONTENT_PREFIX}: ${relative}`);
  return path.join(repoRoot(), relative);
}

const readJson = <T>(relative: string): T => JSON.parse(readFileSync(safePath(relative), "utf8")) as T;

function jsonFiles(dir: string): string[] {
  const abs = safePath(dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const name of readdirSync(abs).sort()) {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(abs, name)).isDirectory()) out.push(...jsonFiles(rel));
    else if (name.endsWith(".json")) out.push(rel);
  }
  return out;
}

export function loadRegistry(): ProfessionRegistry {
  return readJson<ProfessionRegistry>(REGISTRY_PATH);
}

/** Returns the profession config only for professions implemented in this release (pilot). */
export function professionConfig(professionId: string, registry = loadRegistry()): ProfessionConfig {
  const p = registry.professions.find((x) => x.id === professionId);
  if (!p || p.status !== "pilot") throw new ProfessionUnavailableError(`Профессия ${professionId} пока недоступна`);
  return p;
}

export interface ProfessionBundle {
  config: ProfessionConfig;
  library: LibraryIndex;
  diagnostic: DiagnosticContext;
  contentHash: string;
  configIssues: string[];
}

export function loadProfessionBundle(professionId: string, today = new Date().toISOString().slice(0, 10)): ProfessionBundle {
  const registry = loadRegistry();
  const config = professionConfig(professionId, registry);
  const hash = createHash("sha256");
  const read = <T>(rel: string): T => {
    const text = readFileSync(safePath(rel), "utf8");
    hash.update(rel).update("\0").update(text);
    return JSON.parse(text) as T;
  };
  const role = read<RoleMatrix>(config.files.role);
  const curriculum = read<Curriculum>(config.files.curriculum);
  const definition = read<DiagnosticDefinition>(config.files.diagnostic);
  const lessonSchema = read<Record<string, unknown>>(registry.shared.lessonSchema);
  const stepSchema = read<Record<string, unknown>>(registry.shared.planStepSchema);
  const lessonPaths = [registry.shared.prototypeDir, ...config.lessonDirs]
    .flatMap(jsonFiles)
    .filter((p) => !p.startsWith(registry.shared.prototypeDir) || p.endsWith(".prototype.json"))
    .filter((p) => !p.endsWith("plan-step.prototype.json"));
  const lessons = lessonPaths.map((p) => ({ path: p, document: read<unknown>(p) }));
  const planCandidates = config.planCandidateDirs.flatMap(jsonFiles).map((p) => ({ path: p, document: read<unknown>(p) }));
  const library = buildLibrary({
    professionId, today, curriculum, role, lessonSchema, stepSchema, lessons, planCandidates,
    fileExists: (rel) => rel.startsWith(CONTENT_PREFIX) && !rel.includes("..") && existsSync(path.join(repoRoot(), rel)),
  });
  const diagnostic: DiagnosticContext = { professionId, definition, role, curriculum, binding: config.diagnosticBinding };
  return { config, library, diagnostic, contentHash: hash.digest("hex"), configIssues: validateDiagnosticConfig(diagnostic) };
}
