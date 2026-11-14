import { prototypeMode } from "./prototype-policy.ts";

/** Server-only inputs. Never expose these values through NEXT_PUBLIC_* or page props. */
export type PreviewEnvironment = {
  NODE_ENV?: string;
  RAILWAY_ENVIRONMENT_NAME?: string;
  BUSINESS_MAP_PROTOTYPE?: string;
  SITE_NOINDEX?: string;
  BUSINESS_MAP_PREVIEW_USERNAME?: string;
  BUSINESS_MAP_PREVIEW_PASSWORD?: string;
};
export type PreviewAccess = "allow" | "challenge" | "hidden";
export const PREVIEW_REALM = 'Basic realm="Business Map Preview", charset="UTF-8"';

export const previewResponseHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Vary": "Authorization, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Url",
} as const;

export function credentialsConfigured(env: PreviewEnvironment): boolean {
  // Avoid ambiguous Basic user names and accidental whitespace/control-only configuration.
  return typeof env.BUSINESS_MAP_PREVIEW_USERNAME === "string"
    && /^[A-Za-z0-9._-]{1,64}$/.test(env.BUSINESS_MAP_PREVIEW_USERNAME)
    && typeof env.BUSINESS_MAP_PREVIEW_PASSWORD === "string"
    && env.BUSINESS_MAP_PREVIEW_PASSWORD.length >= 16
    && env.BUSINESS_MAP_PREVIEW_PASSWORD.length <= 1024
    && env.BUSINESS_MAP_PREVIEW_PASSWORD.trim().length > 0
    && !/[\u0000-\u001f\u007f]/.test(env.BUSINESS_MAP_PREVIEW_PASSWORD);
}

function parseBasic(authorization: string | null): { username: string; password: string } | null {
  if (!authorization || authorization.length > 8192) return null;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
  if (!match || match[1].length % 4 !== 0) return null;
  try {
    const binary = atob(match[1]);
    if (btoa(binary) !== match[1]) return null;
    const value = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
    const separator = value.indexOf(":");
    if (separator <= 0) return null;
    const username = value.slice(0, separator), password = value.slice(separator + 1);
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(username)) return null;
    return { username, password };
  } catch { return null; }
}

/** Fixed-size digest comparison works in both Next middleware (Edge) and the Node renderer. */
async function matchesCredentials(actual: { username: string; password: string }, env: PreviewEnvironment): Promise<boolean> {
  const encode = (username: string, password: string) => new TextEncoder().encode(`${username}\0${password}`);
  const [received, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encode(actual.username, actual.password)),
    crypto.subtle.digest("SHA-256", encode(env.BUSINESS_MAP_PREVIEW_USERNAME!, env.BUSINESS_MAP_PREVIEW_PASSWORD!)),
  ]);
  const a = new Uint8Array(received), b = new Uint8Array(expected);
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}

/** No cookies, URL tokens, forwarded grant headers, stored sessions or client-side password checks. */
export async function authorizePrototype(env: PreviewEnvironment, authorization: string | null): Promise<PreviewAccess> {
  const mode = prototypeMode(env.NODE_ENV, env.BUSINESS_MAP_PROTOTYPE, env.RAILWAY_ENVIRONMENT_NAME, env.SITE_NOINDEX);
  if (mode === "development") return "allow";
  if (mode !== "preview" || !credentialsConfigured(env)) return "hidden";
  const credentials = parseBasic(authorization);
  return credentials && await matchesCredentials(credentials, env) ? "allow" : "challenge";
}

/** Recognize the document, descendants and legacy Next data aliases even without a Referer. */
export function isPrototypePath(pathname: string): boolean {
  let path = pathname;
  try { path = decodeURIComponent(pathname); } catch { /* malformed paths cannot enable a mode */ }
  return /^\/prototype\/business-map(?:\/|\.(?:rsc|json)$|$)/.test(path)
    || /^\/_next\/data\/[^/]+\/prototype\/business-map(?:\.json|\/)/.test(path);
}
