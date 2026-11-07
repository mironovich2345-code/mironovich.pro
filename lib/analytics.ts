/**
 * The single seam between the UI and analytics (Yandex Metrica only — GA4 was
 * removed for good on 2026-11-01). Components call track(...) /
 * trackPageView(...) and never touch ym directly.
 *
 * Privacy rules enforced here, not left to callers:
 * - only the event names below exist;
 * - only whitelisted parameter keys are sent, every value is reduced to a short
 *   [a-z0-9_.-/] token — no names, contacts, task text, emails or free text;
 * - page is always a normalised site path (lib/lead → normalizePagePath).
 *
 * Page views: Metrica is initialised without its automatic hit (defer); the
 * init script sends the first one and PageViewTracker one per App Router
 * navigation, via trackPageView().
 */

import type { ServiceSlug } from "../config/services";
import { REDACTED, looksPersonal, normalizePagePath } from "./lead";

export type AnalyticsEvent =
  | "tool_calculate"
  | "service_view"
  | "cta_click"
  | "form_start"
  | "lead_submit_success"
  | "lead_submit_error"
  | "contact_click";

export type CtaLocation =
  | "hero" | "sticky" | "header" | "about" | "article" | "blog"
  | "problems" | "services" | "diagnostics" | "not_found" | "service_page" | "services_index" | "projects" | "tools";

export type ContactLocation = "footer" | "contact_page" | "form_fallback";

/** Only non-identifying, low-cardinality values belong in here. */
export type EventParams = {
  location?: CtaLocation | ContactLocation;
  service?: ServiceSlug;
  channel?: "telegram" | "instagram";
  reason?: "validation" | "network" | "delivery";
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

const ALLOWED_KEYS = ["location", "service", "channel", "reason", "utm_source", "utm_medium", "utm_campaign"] as const;

/** The ID is interpolated into an inline script and the CSP, so anything malformed disables Metrica. */
const rawMetrica = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID?.trim() || "";
export const metricaId = /^\d{5,12}$/.test(rawMetrica) ? rawMetrica : "";
export const analyticsEnabled = Boolean(metricaId);

type Ym = (id: number, action: string, ...rest: unknown[]) => void;
type AnalyticsWindow = { ym?: Ym; mrnvEvents?: unknown[] };

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

  // Debug trace for tests and ?_ym_debug sessions
  (w.mrnvEvents = w.mrnvEvents || []).push({ event, ...payload });

  if (metricaId && typeof w.ym === "function") w.ym(Number(metricaId), "reachGoal", event, payload);
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
