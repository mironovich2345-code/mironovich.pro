import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aiCareerCommerce } from "../config/ai-career-commerce.ts";
import { products, publicStorefrontProducts } from "../content/products.ts";

const read = (p) => readFileSync(p, "utf8");
const productPage = () => read("components/AiCareerProductPage.tsx");

test("the payment application storefront lists exactly one employee digital product", () => {
  assert.deepEqual(publicStorefrontProducts.map((p) => p.slug), ["ai-career"]);
  assert.equal(publicStorefrontProducts[0].plannedPrice, aiCareerCommerce.priceRub);
  assert.ok(products.some((p) => p.slug === "automation-priorities"), "the future business concept is retained internally");
  const catalog = read("app/products/page.tsx");
  assert.match(catalog, /publicStorefrontProducts\.map/);
  assert.match(catalog, /только цифровой продукт для сотрудников/);
  const route = read("app/products/[slug]/page.tsx");
  assert.match(route, /return publicStorefrontProducts\.map/);
  assert.match(route, /dynamicParams = false/);
  assert.match(route, /notFound\(\)/);
});

test("current price and buy button appear below the 30-step program, not in home hero", () => {
  const page = productPage();
  const steps = page.indexOf('id="product-steps-title"');
  const price = page.indexOf('id="ai-career-price-heading"');
  const buy = page.indexOf("Купить за {rubles(price.priceRub)}");
  assert.ok(steps >= 0 && price > steps && buy > price);
  assert.match(page, /<AiCareerPrice price=\{price\} \/>/);
  assert.match(page, /const price = await readCurrentPrice\(\)/);
  assert.match(page, /<button\s+type="button"\s+disabled/s);
  assert.match(page, /aria-describedby="ai-career-payment-status"/);
  assert.match(page, /Приём онлайн-платежей через ЮKassa ещё подключается/);
  assert.doesNotMatch(page, /плановая стандартная стоимость|<del\b/, "old discount explanation removed");
  const hero = read("components/Hero.tsx");
  assert.doesNotMatch(hero, /career\.plannedPrice|rub\(career/);
  assert.equal(aiCareerCommerce.priceRub, 1993);
  assert.equal(aiCareerCommerce.salesEnabled, false);
  assert.equal(aiCareerCommerce.legalApproved, false);
  assert.doesNotMatch(page, /от 1\s?993 ₽/);
});

test("purchase instructions and delivery conditions cover price, email, age and access", () => {
  const p = productPage();
  for(const x of ["Как будет проходить покупка", "01 / Оформление", "02 / Оплата", "03 / Доступ", "подтвердите возраст 18+", "30 шагов", "скачать PDF"]) {
    assert.ok(p.includes(x), x);
  }
  for(const x of ["/offer/ai-career", "/delivery", "/refund", "/requisites", "/privacy"]) {
    assert.ok(p.includes(x), "missing customer legal link " + x);
  }
  const delivery = read("app/delivery/page.tsx");
  assert.match(delivery, /действующая цена указана на странице продукта и фиксируется в заказе до оплаты/);
  assert.match(delivery, /учётную запись по email/);
  assert.match(delivery, /Оплата пока выключена|Онлайн-оплата пока выключена/);
});

test("company services cannot be purchased in employee storefront", () => {
  const business = read("app/solutions/page.tsx");
  const listings = read("components/Services.tsx");
  const seller = read("app/requisites/page.tsx");
  assert.match(business, /Онлайн-оплата корпоративных услуг через сайт не предусмотрена/);
  assert.match(listings, /не товары интернет-магазина/);
  assert.match(listings, /согласуем объём, стоимость и отдельный договор/);
  assert.match(seller, /Онлайн-оплата через ЮKassa подключается исключительно для цифрового продукта сотрудников/);
  assert.match(seller, /Консультации и разработка для компаний через магазин не продаются/);
});

test("payments and real personal data remain disabled until launch approval", () => {
  const commerce = read("config/ai-career-commerce.ts");
  assert.match(commerce, /salesEnabled: false/);
  assert.match(commerce, /legalApproved: false/);
  const product = productPage();
  assert.match(product, /Заказы и оплата пока недоступны/);
  assert.match(product, /<button\s+type="button"\s+disabled/s);
  assert.doesNotMatch(product, /fetch\(["']\/api\/career|href=["']https:\/\/yoomoney/);
});
