import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");

test("four customer information pages exist and are linked from the footer", () => {
  const footer = read("components/Footer.tsx");
  for (const route of ["/offer/ai-career", "/delivery", "/refund", "/requisites"]) {
    const file = "app" + route + "/page.tsx";
    assert.ok(read(file).includes("CommerceDocument"), file);
    assert.ok(footer.includes(route), route);
  }
});

test("prelaunch documents are explicitly not an offer for available checkout", () => {
  const layout = read("components/CommerceDocument.tsx");
  const offer = read("app/offer/ai-career/page.tsx");
  assert.match(layout, /Предварительные условия будущих продаж/);
  assert.match(offer, /не является действующим предложением о покупке/);
  const commerce = read("config/ai-career-commerce.ts");
  assert.match(commerce, /salesEnabled: false/);
  assert.match(commerce, /legalApproved: false/);
  const legal = JSON.parse(read("config/legal.json"));
  assert.equal(legal.published, false, "unfinished privacy and consent must remain unpublished");
});

test("published pages have no legal placeholders or live payment links", () => {
  for (const route of ["/offer/ai-career", "/delivery", "/refund", "/requisites"]) {
    const page = read("app" + route + "/page.tsx");
    assert.doesNotMatch(page, /\[(?:УТОЧНИТЬ|ПОДТВЕРДИТЬ|ОПИСАТЬ)/);
    assert.doesNotMatch(page, /salesEnabled: true|createPayment\(/);
  }
});

test("employee product honestly says 18+ and payments are not yet available", () => {
  const page = read("components/AiCareerProductPage.tsx");
  assert.match(page, /18\+/);
  assert.match(page, /Платформа разрабатывается/);
  assert.match(page, /Заказы и оплата пока недоступны/);
});
