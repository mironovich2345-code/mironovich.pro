/**
 * One thin seam between the UI and whatever analytics provider is configured.
 * Components call track(...) and never touch ym / gtag directly, so adding or
 * swapping a provider — or gating it behind a consent prompt later — is a
 * change in this file only.
 *
 * Nothing personal is ever passed here: no name, contact or task text.
 */

export type AnalyticsEvent =
  | "cta_click"
  | "form_start"
  | "lead_submit_success"
  | "lead_submit_error"
  | "telegram_fallback_click";

export type CtaLocation = "hero" | "sticky" | "first_review" | "secondary";

/** Only non-identifying, low-cardinality values belong in here. */
export type EventParams = {
  location?: CtaLocation;
  reason?: "validation" | "network" | "delivery";
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export const metricaId = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID?.trim() || "";
export const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim() || "";
export const analyticsEnabled = Boolean(metricaId || gaId);

type Ym = (id: number, action: string, ...rest: unknown[]) => void;
type Gtag = (command: string, ...rest: unknown[]) => void;

export function track(event: AnalyticsEvent, params: EventParams = {}) {
  if (typeof window === "undefined") return;

  const w = window as unknown as { ym?: Ym; gtag?: Gtag; dataLayer?: unknown[] };

  // Always leave a trace in dataLayer — works for GTM and for local debugging
  // even when no provider id is configured.
  (w.dataLayer = w.dataLayer || []).push({ event, ...params });

  if (metricaId && typeof w.ym === "function") {
    w.ym(Number(metricaId), "reachGoal", event, params);
  }
  if (gaId && typeof w.gtag === "function") {
    w.gtag("event", event, params);
  }
}

/** form_start must fire once per session, on the first real field interaction. */
const FORM_START_KEY = "mrnv_form_start_v1";

export function trackFormStartOnce() {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(FORM_START_KEY)) return;
    window.sessionStorage.setItem(FORM_START_KEY, "1");
  } catch {
    /* storage disabled — fall through and just send it */
  }
  track("form_start");
}
