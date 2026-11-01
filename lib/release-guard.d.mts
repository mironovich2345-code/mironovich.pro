// Types for lib/release-guard.mjs (TypeScript imports it in lib/legal.ts).
export declare const PRODUCTION_ORIGINS: string[];
export declare const DEFAULT_SITE_URL: string;
export declare const PLACEHOLDER_SOURCE: string;
export declare const METRICA_ID: RegExp;
export declare function allPlaceholders(text: string): string[];
export declare function findPlaceholders(text: string): string[];
type Env = Record<string, string | undefined>;
export declare function releaseTarget(env: Env): { production: boolean; reason: string };
export declare function checkRelease(input: {
  env: Env;
  legal: { published: boolean; edition: string };
  docs: Record<string, string>;
}): { errors: string[]; warnings: string[] };
export declare function runReleaseGuard(options?: {
  cwd?: string;
  env?: Env;
  forceProduction?: boolean;
  log?: Pick<Console, "log" | "warn">;
}): { production: boolean; reason: string; errors: string[]; warnings: string[]; blocked: boolean; message?: string };
