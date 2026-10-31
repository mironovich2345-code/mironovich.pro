/**
 * Analytics consent. Two modes, chosen by NEXT_PUBLIC_ANALYTICS_CONSENT:
 *
 * - unset / "none" (current production behaviour): analytics loads on page load,
 *   as before. No banner.
 * - "required": nothing is loaded until the visitor accepts in the banner; the
 *   choice is kept in localStorage. Declining loads nothing.
 *
 * Switching to "required" needs the approved banner text and privacy policy.
 */

export type ConsentChoice = "granted" | "denied";

export const consentRequired = process.env.NEXT_PUBLIC_ANALYTICS_CONSENT === "required";

const KEY = "mrnv_analytics_consent_v1";
export const CONSENT_EVENT = "mrnv:consent";

export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: the choice holds for this page view only */
  }
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }));
}

/** Whether analytics may load right now. */
export const analyticsAllowed = (choice: ConsentChoice | null) => !consentRequired || choice === "granted";

/** Footer «Настройки аналитики» reopens the banner through this event. */
export const CONSENT_OPEN_EVENT = "mrnv:consent-open";

export const openConsentSettings = () => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));

/** Cookie names set by Yandex Metrica and GA4 on this site's domain. */
const ANALYTICS_COOKIE = /^(_ym|_ga|_gid|_gat)/;

/**
 * Withdrawal: store «denied», delete the counters' first-party cookies on this
 * host and its parent domains, then reload so no analytics code stays in memory.
 */
export function revokeConsent() {
  saveConsent("denied");
  const host = window.location.hostname;
  const parts = host.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push("; domain=." + parts.slice(i).join("."));
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (!ANALYTICS_COOKIE.test(name)) continue;
    for (const d of domains) document.cookie = name + "=; Max-Age=0; path=/" + d;
  }
  window.location.reload();
}
