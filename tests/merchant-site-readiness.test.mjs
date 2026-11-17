import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("merchant documents exist as stable Next.js routes", () => {
  for (const slug of ["service-prices","service-delivery","service-terms","service-refunds","requisites"]) {
    assert.ok(fs.existsSync(path.join(root, "app", slug, "page.tsx")), slug);
  }
});

test("merchant copy uses known prices and does not enable checkout", () => {
  const prices = read("app/service-prices/page.tsx");
  const data = read("config/solutions.ts");
  assert.match(prices, /150 000 ₽/);
  assert.match(prices, /solutions\.map/);
  for (const n of ["99000", "89000", "65000", "69000", "180000"]) assert.ok(data.includes(n));
  const order = read("app/service-delivery/page.tsx");
  assert.match(order, /До завершения подключения ЮKassa кнопки онлайн-оплаты на сайте нет/);
});

test("contacts and merchant terms remain accessible from footer", () => {
  const footer = read("components/Footer.tsx");
  for (const link of ["/service-prices","/service-delivery","/service-terms","/service-refunds","/requisites"]) {
    assert.ok(footer.includes(link), link);
  }
  assert.match(footer, /tel:\+79527541498/);
  assert.match(footer, /damironovich@mail.ru/);
});

test("unfinished products remain described honestly and excluded from discovery", () => {
  assert.match(read("content/products.ts"), /status:\s*"preparing"/);
  assert.match(read("app/sitemap.ts"), /products\.filter\(p => p\.status !== "preparing"\)/);
  assert.match(read("app/products/\[slug\]/page.tsx"), /noindex:\s*p\.status === "preparing"/);
  assert.match(read("config/site.ts"), /Digital products still preparing/);
});

test("do not claim updated legal policies are approved", () => {
  assert.match(read("config/legal.json"), /"published": false/);
  const draft = read("content/legal/privacy.md");
  assert.match(draft, /\[УТОЧНИТЬ/);
});
