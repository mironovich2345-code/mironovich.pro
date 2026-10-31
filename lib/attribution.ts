/**
 * First-touch attribution. Written once, on the very first page view of a
 * browser, and never overwritten — so navigating the site cannot lose the
 * source. No fingerprinting: only URL parameters, document.referrer and a
 * timestamp, all kept in the visitor's own localStorage.
 */

import { REDACTED, looksPersonal } from "./lead";

const KEY = "mrnv_attr_v1";

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

export type Attribution = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  referrer: string;
  landingPage: string;
  firstSeenAt: string;
};

const DIRECT = "direct";
const UNKNOWN = "unknown";

export const emptyAttribution = (): Attribution => ({
  utm_source: DIRECT,
  utm_medium: DIRECT,
  utm_campaign: UNKNOWN,
  utm_content: UNKNOWN,
  utm_term: UNKNOWN,
  referrer: DIRECT,
  landingPage: UNKNOWN,
  firstSeenAt: UNKNOWN,
});

/** Printable text only, capped; values that look like an e-mail or phone are replaced. */
const cleanUtm = (v: string | null) => {
  const t = (v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 100);
  return looksPersonal(t) ? REDACTED : t;
};

/** Referrer reduced to its origin: full referring URLs can carry personal data in the path or query. */
function refOrigin(ref: string): string {
  try {
    const u = new URL(ref);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : "";
  } catch {
    return "";
  }
}

/** Reads the current URL + referrer into a first-touch record. */
function capture(): Attribution {
  const url = new URL(window.location.href);
  const p = url.searchParams;
  const val = (k: UtmKey) => cleanUtm(p.get(k));

  const hasUtm = UTM_KEYS.some((k) => val(k) !== "");
  const origin = refOrigin(document.referrer || "");
  const external = origin !== "" && origin !== window.location.origin;

  return {
    utm_source: val("utm_source") || (hasUtm ? UNKNOWN : external ? new URL(origin).hostname : DIRECT),
    utm_medium: val("utm_medium") || (external ? "referral" : DIRECT),
    utm_campaign: val("utm_campaign") || UNKNOWN,
    utm_content: val("utm_content") || UNKNOWN,
    utm_term: val("utm_term") || UNKNOWN,
    referrer: external ? origin : DIRECT,
    // path only — the query string may hold anything, UTM values are kept above
    landingPage: url.pathname.slice(0, 200),
    firstSeenAt: new Date().toISOString(),
  };
}

/**
 * Called once per page view. Stores the record only if nothing is stored yet
 * (first touch wins), then returns whatever is stored.
 */
export function initAttribution(): Attribution {
  if (typeof window === "undefined") return emptyAttribution();
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored) return { ...emptyAttribution(), ...(JSON.parse(stored) as Attribution) };
    const fresh = capture();
    window.localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    // private mode / storage disabled — attribution is best-effort, never fatal
    return capture();
  }
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return emptyAttribution();
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored) return { ...emptyAttribution(), ...(JSON.parse(stored) as Attribution) };
  } catch {
    /* ignore */
  }
  return initAttribution();
}
