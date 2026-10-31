/**
 * The single seam between the UI and the analytics providers (Yandex Metrica
 * and GA4). Components call track(...) / trackPageView(...) and never touch
 * ym or gtag directly.
 *
 * Privacy rules enforced here, not left to callers:
 * - only the event names below exist;
 * - only whitelisted parameter keys are sent, every value is reduced to a short
 *   [a-z0-9_.-/] token — no names, contacts, task text, emails or free text;
 * - page is always a normalised site path (lib/lead → normalizePagePath).
 *
 * Page views:
 * - Metrica is initialised without its automatic hit (defer) and every page view,
 *   the first included, is sent once from PageViewTracker via trackPageView().
 * - GA4 keeps its own page_view: the initial one from `config` and the App Router
 *   navigations through Enhanced Measurement («page changes based on browser
 *   history events»). We never send page_view to GA ourselves, so it cannot be
 *   counted twice.
 */

import { REDACTED, looksPersonal, normalizePagePath } from "./lead";

export type AnalyticsEvent =
  | "service_view"
  | "cta_click"
  | "form_start"
  | "lead_submit_success"
  | "lead_submit_error"
  | "contact_click";

export type CtaLocation =
  | "hero" | "sticky" | "header" | "about" | "article" | "blog"
  | "problems" | "services" | "diagnostics" | "not_found" | "service_page" | "services_index" | "projects";

export type ContactLocation = "footer" | "contact_page" | "form_fallback";

/** Only non-identifying, low-cardinality values belong in here. */
export type EventParams = {
  location?: CtaLocation | ContactLocation;
  service?: "automation" | "apps" | "training";
  channel?: "telegram" | "instagram";
  reason?: "validation" | "network" | "delivery";
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

const ALLOWED_KEYS = ["location", "service", "channel", "reason", "utm_source", "utm_medium", "utm_campaign"] as const;

/** IDs are interpolated into inline scripts and the CSP, so anything malformed disables the provider. */
const rawMetrica = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID?.trim() || "";
const rawGa = process.env.NEXT_PUBLIC_GA_ID?.trim() || "";
export const metricaId = /^\d{5,12}$/.test(rawMetrica) ? rawMetrica : "";
export const gaId = /^G-[A-Z0-9]{4,20}$/.test(rawGa) ? rawGa : "";
export const analyticsEnabled = Boolean(metricaId || gaId);

type Ym = (id: number, action: string, ...rest: unknown[]) => void;
type Gtag = (command: string, ...rest: unknown[]) => void;
type AnalyticsWindow = { ym?: Ym; gtag?: Gtag; mrnvEvents?: unknown[] };

/** Short, safe token: lowercase latin, digits and _ . - / ; anything else is dropped. */
export const safeToken = (v: unknown, max = 60): string =>
  typeof v === "string" ? v.toLowerCase().replace(/[^a-z0-9_./-]/g, "").slice(0, max) : "";

function clean(params: EventParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ALLOWED_KEYS) {
    const raw = params[k];
    // check before tokenising: «ivan@mail.ru» would otherwise survive as «ivanmail.ru»
    const v = typeof raw === "string" && looksPersonal(raw) ? REDACTED : safeToken(raw);
    if (v) out[k] = v;
  }
  return out;
}

const currentPage = () => normalizePagePath(window.location.pathname);

export function track(event: AnalyticsEvent, params: EventParams = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as AnalyticsWindow;
  const payload = { ...clean(params), page: currentPage() };

  // Debug trace in our own array — not gtag's dataLayer, which could turn it into extra GA events.
  (w.mrnvEvents = w.mrnvEvents || []).push({ event, ...payload });

  if (metricaId && typeof w.ym === "function") w.ym(Number(metricaId), "reachGoal", event, payload);
  if (gaId && typeof w.gtag === "function") w.gtag("event", event, payload);
}

/** One Metrica hit per page view (see the note at the top). */
export function trackPageView(path: string, referrer: string) {
  if (typeof window === "undefined") return;
  const w = window as unknown as AnalyticsWindow;
  const url = window.location.origin + path;
  (w.mrnvEvents = w.mrnvEvents || []).push({ event: "page_view", page: normalizePagePath(path) });
  if (metricaId && typeof w.ym === "function") {
    w.ym(Number(metricaId), "hit", url, { title: document.title, referer: referrer });
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
