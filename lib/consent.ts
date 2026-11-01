/**
 * Analytics consent — always required, not a setting.
 *
 * Whenever Yandex Metrica is configured (NEXT_PUBLIC_YANDEX_METRICA_ID), the
 * banner is shown and nothing is loaded until the visitor presses «Разрешить»;
 * the choice is kept in localStorage. Declining loads nothing. Without a Metrica
 * ID there is nothing to consent to: no banner, no analytics.
 *
 * The former switch NEXT_PUBLIC_ANALYTICS_CONSENT is no longer read: analytics
 * can no longer load without consent because a variable was missed.
 */

import { metricaId } from "./analytics";

export type ConsentChoice = "granted" | "denied";

export const consentRequired = Boolean(metricaId);

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

/** Whether analytics may load right now: only after an explicit «Разрешить». */
export const analyticsAllowed = (choice: ConsentChoice | null) => choice === "granted";

/** Footer «Настройки аналитики» reopens the banner through this event. */
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
 * Withdrawal: store «denied», delete the counters' first-party cookies on this
 * host and its parent domains, then reload so no analytics code stays in memory.
 */
export function revokeConsent() {
  saveConsent("denied");
  deleteCookies(METRICA_COOKIE);
  deleteCookies(LEGACY_GA_COOKIE);
  // Metrica's own localStorage entries (_ym_uid, _ym<id>_lsid, _ym_retryReqs, …)
  try {
    for (const k of Object.keys(window.localStorage)) if (k.startsWith("_ym")) window.localStorage.removeItem(k);
  } catch {
    /* storage blocked */
  }
  window.location.reload();
}

/**
 * Runs in <head> before the first paint (when Metrica is configured): marks <html>
 * when a choice is already stored, so the server-rendered banner stays hidden for
 * returning visitors instead of flashing until hydration.
 */
export const consentPrecheckScript = `try{var c=localStorage.getItem("${KEY}");if(c==="granted"||c==="denied")document.documentElement.classList.add("mrnv-consent-set")}catch(e){}`;
