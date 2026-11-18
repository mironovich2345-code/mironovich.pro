import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");

test("cookie notice remains available when no Metrica counter is configured", () => {
  const consent = read("lib/consent.ts");
  const banner = read("components/ConsentBanner.tsx");
  const layout = read("app/layout.tsx");
  assert.match(consent, /consentRequired = true/);
  assert.match(layout, /<Analytics \/>/);
  assert.match(banner, /Яндекс Метрика пока не подключена/);
  assert.match(banner, /Понятно/);
});

test("analytics still requires explicit consent and the site has a counter-scoped choice", () => {
  const consent = read("lib/consent.ts");
  const analytics = read("components/Analytics.tsx");
  assert.match(consent, /mrnv_analytics_consent_v2_/);
  assert.match(consent, /metricaId \|\| "notice"/);
  assert.match(analytics, /allowed && metricaId/);
  assert.match(consent, /analyticsAllowed = \(choice.*\) => choice === "granted"/);
  const banner = read("components/ConsentBanner.tsx");
  assert.match(banner, /Разрешить/);
  assert.match(banner, /Отклонить/);
});
