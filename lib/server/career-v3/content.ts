// Server adapter: reads AI Career 3.0 content from content/career/v3 and builds the library and
// diagnostic context for one profession. Only the repository content root is ever read here —
// test fixtures are passed to the pure engine directly and can never reach this loader.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { buildLibrary } from "../../career-v3/library.ts";
import { validateDiagnosticConfig, type DiagnosticContext } from "../../career-v3/diagnostic.ts";
import { validateEngineConfig, type EngineContext } from "../../career-v3/engine.ts";
import type {
  Curriculum, DiagnosticDefinition, LessonDocument, LibraryIndex, ProfessionConfig, ProfessionRegistry, RoleMatrix,
} from "../../career-v3/types.ts";
import { fixtureLibraryEnabled, loadFixtureSources } from "./dev-modes.ts";
import { demoConfig } from "../career-demo/config.ts";
import { demoPreviewSources } from "../career-demo/preview-library.ts";

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
  /** Library used for selection and plans: the real content, or the local synthetic fixture. */
  library: LibraryIndex;
  libraryMode: "content" | "synthetic_fixture" | "demo_review_preview";
  /** Always the real repository content (used for review preview). */
  contentLibrary: LibraryIndex;
  /** Raw documents of all lessons by ID, for the learner view and the review preview. */
  lessonDocuments: Map<string, { path: string; document: LessonDocument; source: "content" | "synthetic_fixture" }>;
  diagnostic: DiagnosticContext;
  engine: EngineContext;
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
  const contentLibrary = buildLibrary({
    professionId, today, curriculum, role, lessonSchema, stepSchema, lessons, planCandidates,
    fileExists: (rel) => rel.startsWith(CONTENT_PREFIX) && !rel.includes("..") && existsSync(path.join(repoRoot(), rel)),
  });
  const lessonDocuments: ProfessionBundle["lessonDocuments"] = new Map();
  for (const l of lessons) {
    const id = (l.document as { id?: unknown })?.id;
    if (typeof id === "string") lessonDocuments.set(id, { path: l.path, document: l.document as LessonDocument, source: "content" });
  }
  let library = contentLibrary;
  let libraryMode: ProfessionBundle["libraryMode"] = "content";
  const fixture = fixtureLibraryEnabled() ? loadFixtureSources(repoRoot()) : null;
  if (fixture) {
    library = buildLibrary({
      professionId, today, curriculum: fixture.curriculum, role, lessonSchema, stepSchema,
      lessons: fixture.lessons, planCandidates: fixture.planCandidates,
      fileExists: (rel) => fixture.downloadPaths.includes(rel) && existsSync(path.join(repoRoot(), rel)),
    });
    libraryMode = "synthetic_fixture";
    for (const l of fixture.lessons) {
      const id = (l.document as { id?: unknown })?.id;
      if (typeof id === "string") lessonDocuments.set(id, { path: l.path, document: l.document as LessonDocument, source: "synthetic_fixture" });
    }
    hash.update("synthetic-fixture").update(JSON.stringify(fixture.lessons.map((l) => l.path)));
  }
  if (!fixture && demoConfig()?.reviewPreview) {
    // Closed cloud demo: route building on an in-memory preview copy of the lessons in review (content untouched).
    const preview = demoPreviewSources(curriculum, lessons, today);
    library = buildLibrary({
      professionId, today, curriculum: preview.curriculum, role, lessonSchema, stepSchema, lessons: preview.lessons, planCandidates,
      fileExists: (rel) => rel.startsWith(CONTENT_PREFIX) && !rel.includes("..") && existsSync(path.join(repoRoot(), rel)),
    });
    libraryMode = "demo_review_preview";
    hash.update("demo-review-preview");
  }
  const diagnostic: DiagnosticContext = { professionId, definition, role, curriculum, binding: config.diagnosticBinding };
  const engine: EngineContext = {
    professionId, role, curriculum, definition, binding: config.diagnosticBinding, engine: config.engine,
    modulePhases: registry.shared.modulePhases, templateKindPhases: registry.shared.templateKindPhases,
  };
  return { config, library, libraryMode, contentLibrary, lessonDocuments, diagnostic, engine, contentHash: hash.digest("hex"),
    configIssues: [...validateDiagnosticConfig(diagnostic), ...validateEngineConfig(engine)] };
}
