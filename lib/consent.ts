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
