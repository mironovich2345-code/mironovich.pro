/**
 * Analytics consent — always required, not a setting.
 *
 * Always require an explicit GRANTED or DENIED choice before any optional
 * analytics, attribution or form-start tracking. If a Metrica counter is added
 * later, its different key prompts for consent again. Strict opt-in by default.
 *
 * The former switch NEXT_PUBLIC_ANALYTICS_CONSENT is no longer read: analytics
 * can no longer load without consent because a variable was missed.
 */

import { metricaId } from "./analytics";
import { trackingConsentKey } from "./tracking-consent";

export type ConsentChoice = "granted" | "denied";

/**
 * Preview only (NEXT_PUBLIC_CONSENT_PREVIEW=1, no Metrica ID): show the banner and
 * «Настройки аналитики» so the design can be checked, while nothing can load —
 * there is no counter. A production build with this variable is refused
 * (lib/release-guard.mjs).
 */
export const consentPreview = !metricaId && process.env.NEXT_PUBLIC_CONSENT_PREVIEW === "1";

export const consentRequired = true; // show two equally available choices even without a counter

const KEY = trackingConsentKey(metricaId);
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

/** Whether optional tracking may run: only after explicit «Согласен». */
export const analyticsAllowed = (choice: ConsentChoice | null) => choice === "granted";

/** Footer «Настройки cookies» reopens the banner through this event. */
export const CONSENT_OPEN_EVENT = "mrnv:consent-open";

export const openConsentSettings = () => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));

/** Yandex Metrica cookies on this site's domain. */
const METRICA_COOKIE = /^_ym/;
/** GA4 cookies left in visitors' browsers by the previous version of the site. */
const LEGACY_GA_COOKIE = /^(_ga|_gid|_gat)/;

function deleteCookies(match: RegExp) {
  const parts = window.location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push("; domain=." + parts.slice(i).join("."));
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (!match.test(name)) continue;
    for (const d of domains) document.cookie = name + "=; Max-Age=0; path=/" + d;
  }
}

/** GA4 is gone: remove its leftover cookies from earlier visits, whatever the consent state. */
export const clearLegacyGaCookies = () => deleteCookies(LEGACY_GA_COOKIE);

/**
 * Clear stale optional tracking data, including records created by pre-consent
 * versions of the site. Can run before a choice or after rejection/revocation.
 * The only retained local entry after rejection is the essential choice itself.
 */
export function purgeOptionalTracking() {
  if (typeof window === "undefined") return;
  deleteCookies(METRICA_COOKIE);
  deleteCookies(LEGACY_GA_COOKIE);
  try {
    window.localStorage.removeItem("mrnv_attr_v1");
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith("_ym")) window.localStorage.removeItem(k);
    }
  } catch { /* storage blocked */ }
  try {
    window.sessionStorage.removeItem("mrnv_form_start_v1");
  } catch { /* storage blocked */ }
}

/** Revoke consent, clean all optional storage and stop an already loaded tag. */
export function revokeConsent() {
  saveConsent("denied");
  purgeOptionalTracking();
  window.location.reload();
}

/**
 * Runs in <head> before the first paint (when Metrica is configured): marks <html>
 * when a choice is already stored, so the server-rendered banner stays hidden for
 * returning visitors instead of flashing until hydration.
 */
export const consentPrecheckScript = `try{var c=localStorage.getItem("${KEY}");if(c==="granted"||c==="denied")document.documentElement.classList.add("mrnv-consent-set")}catch(e){}`;
