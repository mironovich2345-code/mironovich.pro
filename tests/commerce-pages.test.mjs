import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("checkout stays disabled during payment onboarding preparation", () => {
  const cfg = read("config/ai-career-commerce.ts");
  assert.match(cfg, /salesEnabled:\s*false/);
  assert.match(cfg, /legalApproved:\s*false/);
  assert.match(cfg, /priceRub:\s*1993/);
  assert.match(cfg, /extensionPriceRub:\s*1490/);
  assert.match(cfg, /phoneHref:\s*"tel:\+79527541498"/);
});

test("commerce information pages and links exist", () => {
  const entries = ["app/offer/ai-career/page.tsx", "app/delivery/page.tsx", "app/refund/page.tsx", "app/requisites/page.tsx"];
  for (const file of entries) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
    assert.match(read(file), /CommerceDocument/);
  }
  const footer = read("components/Footer.tsx");
  assert.match(footer, /seller\.phoneHref/);
  assert.match(read("app/requisites/page.tsx"), /seller\.phone/);
  assert.match(read("app/contact/page.tsx"), /seller\.phoneHref/);
  for (const href of ["/offer/ai-career", "/delivery", "/refund", "/requisites"]) {
    assert.ok(footer.includes(href), href);
  }
});

test("retained 7-day refund and 12-month extension terms", () => {
  assert.match(read("app/refund/page.tsx"), /семи дней/);
  assert.match(read("app/refund/page.tsx"), /10 календарных дней/);
  assert.match(read("app/delivery/page.tsx"), /12 месяцев/);
  assert.match(read("app/delivery/page.tsx"), /1 490 ₽/);
  assert.match(read("app/delivery/page.tsx"), /не суммируются/);
});

test("existing personal data publication is unchanged", () => {
  const guard = read("config/legal.json");
  assert.match(guard, /"published": false/);
});

test("one canonical offer is shared by commerce pages and product, including buyer age", async () => {
  const { aiCareerCommerce: c, commerceCopy } = await import("../config/ai-career-commerce.ts");
  const { productBySlug } = await import("../content/products.ts");
  assert.equal(c.priceRub, 1993);
  assert.equal(c.minimumBuyerAge, 18);
  assert.equal(c.analysesIncluded, 1);
  assert.equal(c.planSteps, 30);
  assert.equal(c.accessDays, 90);
  assert.equal(c.refundWindowDays, 7);
  assert.equal(productBySlug("ai-career").plannedPrice, c.priceRub);
  for (const part of ["1 993 ₽", "один персональный анализ", "30 шагов", "PDF", "90 дней"]) assert.ok(commerceCopy.initialPurchase.includes(part), part);
  for (const file of ["app/offer/ai-career/page.tsx", "app/delivery/page.tsx", "app/refund/page.tsx", "app/requisites/page.tsx", "components/AiCareerProductPage.tsx"]) assert.ok(read(file).includes("commerceCopy.initialPurchase"), file);
  assert.match(read("components/CommerceDocument.tsx"), /commerceCopy\.age/);
});

test("completed draft package remains blocked from legal publication", async () => {
  const { checkRelease } = await import("../lib/release-guard.mjs");
  const legal = JSON.parse(read("config/legal.json"));
  const docs = { privacy: read("content/legal/privacy.md"), consent: read("content/legal/consent.md") };
  assert.equal(legal.published, false);
  const attempt = checkRelease({ env: { NEXT_PUBLIC_SITE_URL: "https://mironovich.pro" }, legal: { ...legal, published: true }, docs });
  assert.ok(attempt.errors.some(e => /незаполненные поля/.test(e)));
  const preview = checkRelease({ env: { LEGAL_PREVIEW: "1", NEXT_PUBLIC_SITE_URL: "https://mironovich.pro" }, legal, docs });
  assert.ok(preview.errors.some(e => /LEGAL_PREVIEW/.test(e)));
  assert.match(docs.privacy, /Railway не предоставляет регион размещения в РФ/);
  assert.match(docs.privacy, /только синтетические/);
  assert.match(docs.privacy, /согласие само по себе не устраняет/i);
});

test("draft consent purposes are separated from offer and optional tracking", () => {
  const consent = read("docs/commerce/ai-career-consents-approval-draft.md");
  assert.match(consent, /Мне исполнилось 18 лет/);
  assert.match(consent, /Данные диагностики/);
  assert.match(consent, /Необязательная аналитика/);
  assert.match(consent, /Маркетинговое согласие не добавляется/);
  assert.match(consent, /Существующий обязательный consent-gate Метрики сохраняется/);
  const related = read("components/CommerceDocument.tsx");
  for (const href of ["/privacy", "/consent", "/offer/ai-career", "/refund", "/delivery", "/requisites"]) assert.ok(related.includes(href), href);
});
