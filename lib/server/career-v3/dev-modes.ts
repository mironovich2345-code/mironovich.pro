// Local-only development modes of the AI Career 3.0 cabinet. Both are OFF unless explicitly enabled
// AND the synthetic sandbox runs on 127.0.0.1 with the fixture payment simulator — never on Railway,
// never with real payments. Neither mode publishes anything:
//  - synthetic fixture library: replaces the lesson library with the in-test approved fixture so the
//    route and lessons can be exercised in browser tests. The JSON is generated into a git-ignored
//    folder by scripts/career/v3-fixture-library.mjs and is not part of any build.
//  - review preview: lets an admitted tester read lessons that are still in review/draft/prototype,
//    labelled "Черновик на проверке". Preview never enters the selection or the plan.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { sandboxVisible } from "../career/config.ts";
import type { Curriculum, LessonFile } from "../../career-v3/types.ts";

export const FIXTURE_FILE = ".career-v3-fixture/library.json";

export function localSyntheticSandbox(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!sandboxVisible(env)) return false;
  if (env.CAREER_PAYMENT_MODE !== "fixture") return false;
  if ((env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID)) return false;
  try {
    return new URL(env.CAREER_APP_ORIGIN || "").hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function fixtureLibraryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CAREER_V3_FIXTURE_LIBRARY === "1" && localSyntheticSandbox(env);
}

export function reviewPreviewEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CAREER_V3_REVIEW_PREVIEW === "1" && localSyntheticSandbox(env);
}

export interface FixtureSources {
  curriculum: Curriculum;
  lessons: LessonFile[];
  planCandidates: { path: string; document: unknown }[];
  downloadPaths: string[];
}

/** Reads the generated synthetic fixture; refuses anything that is not explicitly marked as such. */
export function loadFixtureSources(root = process.cwd()): FixtureSources | null {
  const file = path.join(root, FIXTURE_FILE);
  if (!existsSync(file)) return null;
  const data = JSON.parse(readFileSync(file, "utf8")) as FixtureSources & { syntheticFixture?: boolean; notForUsers?: boolean };
  if (data.syntheticFixture !== true || data.notForUsers !== true) return null;
  return { curriculum: data.curriculum, lessons: data.lessons, planCandidates: data.planCandidates, downloadPaths: data.downloadPaths ?? [] };
}
