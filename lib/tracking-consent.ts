/**
 * Single source of truth for consent-gated OPTIONAL storage and tracking.
 * No external requests, cookies or visitor attributes are created here.
 * A different Metrica counter needs a fresh choice; pre-existing notice choices
 * and legacy v1/v2 values never authorize future tracking.
 */
export const trackingConsentKey = (counterId: string): string =>
  "mrnv_analytics_consent_v3_" + (counterId || "notice");

export function hasTrackingConsent(counterId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(trackingConsentKey(counterId)) === "granted";
  } catch {
    return false;
  }
}
