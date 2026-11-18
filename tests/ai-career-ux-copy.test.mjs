import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("product benefits are four distinct accessible cards and 30 steps are grouped clearly", () => {
  const page = read("components/AiCareerProductPage.tsx");
  assert.match(page, /Что входит/);
  assert.match(page, /features\.map/);
  assert.match(page, /<article key=\{number\}/);
  assert.match(page, /30 шагов — от задачи до результата/);
  for (const group of ["01–06", "07–14", "15–23", "24–30"]) {
    assert.ok(page.includes(group), "missing step group: " + group);
  }
  assert.doesNotMatch(page, /30 дней — один рабочий эксперимент/);
  assert.doesNotMatch(page, /Дни 22–30/);
});

test("all public product terms promise steps, not a calendar, but retain real access and storage periods", () => {
  const names = ["components/AiCareerProductPage.tsx", "content/products.ts",
    "config/ai-career-commerce.ts", "app/offer/ai-career/page.tsx", "app/delivery/page.tsx"];
  for (const name of names) {
    const source = read(name);
    assert.match(source, /30 шагов/);
    assert.doesNotMatch(source, /план (?:развития |практики |действий )?на 30 дней/i, name);
  }
  const commerce = read("config/ai-career-commerce.ts");
  assert.match(commerce, /planSteps: 30/);
  assert.doesNotMatch(commerce, /planDays:/);
  assert.match(commerce, /accessDays: 90/);
  assert.match(commerce, /retentionDaysAfterExpiry: 30/);
  assert.match(commerce, /salesEnabled: false/);
  assert.match(commerce, /legalApproved: false/);
});

test("documents have a short heading and keep dispute-resolution and refund content", () => {
  const product = read("components/AiCareerProductPage.tsx");
  assert.match(product, /Документы<\/h2>/);
  assert.doesNotMatch(product, /Возврат и документы/);
  for (const name of ["components/AiCareerProductPage.tsx", "components/CommerceDocument.tsx", "components/Footer.tsx"]) {
    assert.match(read(name), /Порядок разрешения разногласий/, name);
  }
  const dispute = read("app/refund/page.tsx");
  assert.match(dispute, /title="Порядок разрешения разногласий"/);
  assert.match(dispute, /Как урегулировать разногласие/);
  assert.match(dispute, /Семь дней на отказ/);
  assert.match(dispute, /Срок и способ возврата/);
});

test("privacy document explains cookie consent without raw technical storage labels", () => {
  const privacy = read("content/legal/privacy.md");
  const section = privacy.split("## 5. Cookies и настройки конфиденциальности")[1].split("## 6.")[0];
  assert.match(section, /Если вы согласились/);
  assert.match(section, /Если вы отказались/);
  assert.match(section, /Согласен/);
  assert.match(section, /Не согласен/);
  assert.doesNotMatch(section, /\b(?:localStorage|sessionStorage|mrnv_[a-z0-9_]+)\b/);
  assert.match(privacy, /edition: 2026-11-18/);
  assert.equal(JSON.parse(read("config/legal.json")).published, true);
});

test("employee price is below the steps, and all public prelaunch prices agree",()=>{
  const product=read("components/AiCareerProductPage.tsx");
  assert.ok(product.indexOf('id="ai-career-price-heading"') > product.indexOf('id="product-steps-title"'));
  assert.match(product, /<del className=/);
  const commerce=read("config/ai-career-commerce.ts");
  assert.match(commerce, /priceRub: 1993/);
  assert.match(commerce, /referencePriceRub: 3990/);
  assert.match(commerce, /salesEnabled: false/);
  assert.match(commerce, /legalApproved: false/);
  for (const p of ["config/ai-career-commerce.ts", "app/offer/ai-career/page.tsx", "app/refund/page.tsx"]) {
    assert.match(read(p), /1 993 ₽/, p);
  }
  assert.match(read("content/products.ts"), /plannedPrice: 1993/);
});
