import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seller } from "../config/ai-career-commerce.ts";

const source = (path) => readFileSync(path, "utf8");

test("seller's public contact configuration excludes personal telephone details", () => {
  const config = source("config/ai-career-commerce.ts");
  const requisites = source("app/requisites/page.tsx");
  assert.ok(seller.email && seller.telegram && seller.postalAddress && seller.taxId);
  assert.ok(!Object.hasOwn(seller, "phone"));
  assert.ok(!Object.hasOwn(seller, "phoneHref"));
  for (const text of [config, requisites]) {
    assert.doesNotMatch(text, /(?:phoneHref|seller\.phone|tel:\+?\d|Контактный телефон)/);
    assert.doesNotMatch(text, /\+7[\s()-]*\d{3}[\s()-]*\d{3}[\s()-]*\d{2}[\s()-]*\d{2}/);
  }
  assert.match(requisites, /seller\.email/);
  assert.match(requisites, /seller\.telegram/);
  assert.match(requisites, /seller\.postalAddress/);
  assert.match(requisites, /seller\.taxId/);
});

test("consumer's own phone field remains covered by lead-form privacy/consent", () => {
  const privacy = source("app/privacy/page.tsx");
  const consent = source("app/consent/page.tsx");
  assert.match(privacy, /номер телефона/);
  assert.match(consent, /номера телефона/);
});
