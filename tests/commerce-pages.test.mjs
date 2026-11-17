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
  assert.match(cfg, /priceRub:\s*1990/);
  assert.match(cfg, /extensionPriceRub:\s*1490/);
});

test("commerce information pages and links exist", () => {
  const entries = ["app/offer/ai-career/page.tsx", "app/delivery/page.tsx", "app/refund/page.tsx", "app/requisites/page.tsx"];
  for (const file of entries) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
    assert.match(read(file), /CommerceDocument/);
  }
  const footer = read("components/Footer.tsx");
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
