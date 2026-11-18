import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasTrackingConsent, trackingConsentKey } from "../lib/tracking-consent.ts";

const read = (path) => readFileSync(path, "utf8");

test("two explicit buttons exist even WITHOUT a Metrica counter", () => {
  const consent = read("lib/consent.ts");
  const banner = read("components/ConsentBanner.tsx");
  const layout = read("app/layout.tsx");
  assert.match(consent, /consentRequired = true/);
  assert.match(layout, /<Analytics \/>/);
  assert.match(banner, /Согласен/);
  assert.match(banner, /Не согласен/);
  assert.doesNotMatch(banner, />Понятно</);
  assert.match(banner, /onClick=\{\(\) => choose\("granted"\)\}/);
  assert.match(banner, /onClick=\{\(\) => choose\("denied"\)\}/);
  assert.match(banner, /Не согласен[\s\S]*Подробнее о cookies/);
});

test("consent decision defaults to DENIED and does not reuse old or future-counter choices", () => {
  assert.equal(trackingConsentKey(""), "mrnv_analytics_consent_v3_notice");
  assert.equal(trackingConsentKey("12345"), "mrnv_analytics_consent_v3_12345");
  assert.notEqual(trackingConsentKey("12345"), trackingConsentKey("78901"));
  const oldWindow = globalThis.window;
  try {
    delete globalThis.window;
    assert.equal(hasTrackingConsent(""), false);
    const data = new Map();
    globalThis.window = { localStorage: {getItem:(k)=>data.get(k)??null} };
    assert.equal(hasTrackingConsent(""), false);
    data.set("mrnv_analytics_consent_v2_notice","granted");
    assert.equal(hasTrackingConsent(""), false);
    data.set("mrnv_analytics_consent_v3_notice","denied");
    assert.equal(hasTrackingConsent(""), false);
    data.set("mrnv_analytics_consent_v3_notice","granted");
    assert.equal(hasTrackingConsent(""), true);
    assert.equal(hasTrackingConsent("12345"), false);
    globalThis.window = {localStorage:{getItem:()=>{throw new Error("blocked")}}};
    assert.equal(hasTrackingConsent(""), false);
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
});

test("no optional analytics event, visit attribution or session tracking before consent", () => {
  const analytics = read("lib/analytics.ts");
  const attribution = read("lib/attribution.ts");
  const root = read("components/Analytics.tsx");
  assert.match(analytics, /if \(typeof window === "undefined" \|\| !hasTrackingConsent\(metricaId\)\) return;/);
  assert.match(attribution, /!hasTrackingConsent\(metricaId\)\) return emptyAttribution\(\);/);
  assert.match(root, /if \(initial\) initAttribution\(\);/);
  assert.match(root, /if \(next\) initAttribution\(\);/);
  assert.match(root, /const next = analyticsAllowed\(readConsent\(\)\);/);
  assert.match(root, /allowed && metricaId/); // no third-party JS until opt-in
  assert.match(analytics, /export function trackFormStartOnce\(\)[\s\S]*?hasTrackingConsent/);
});

test("denying or withdrawing consent purges all optional first-party traces", () => {
  const consent = read("lib/consent.ts");
  const banner = read("components/ConsentBanner.tsx");
  assert.match(consent, /function purgeOptionalTracking\(\)/);
  assert.match(consent, /window\.localStorage\.removeItem\("mrnv_attr_v1"\)/);
  assert.match(consent, /window\.sessionStorage\.removeItem\("mrnv_form_start_v1"\)/);
  assert.match(consent, /deleteCookies\(METRICA_COOKIE\)/);
  assert.match(consent, /deleteCookies\(LEGACY_GA_COOKIE\)/);
  assert.match(consent, /window\.location\.reload\(\)/);
  assert.match(banner, /if \(c === "denied"\) purgeOptionalTracking\(\);/);
});

test("footer allows visitors to change consent choice at any time", () => {
  const settings = read("components/ConsentSettingsButton.tsx");
  assert.match(settings, /Настройки cookies/);
  assert.match(settings, /onClick=\{openConsentSettings\}/);
});

test("small-screen cookie choices are in normal page flow, never over the hero CTA", () => {
  const banner = read("components/ConsentBanner.tsx");
  const layout = read("app/layout.tsx");
  assert.match(banner, /className="relative z-\\[55\\] w-full/);
  assert.match(banner, /min-\\[760px\\]:fixed/);
  assert.match(banner, /max-width: 759px/);
  assert.ok(layout.indexOf("<Analytics />") < layout.indexOf("<SiteHeader />"));
});
