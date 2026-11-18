import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { initialLaborDraft, laborSteps } from "../lib/tools/quiz-draft.ts";
import { laborInsight } from "../lib/tools/quiz-insight.ts";

const read = (p) => readFileSync(p, "utf8");

// Regressions for the full-site UX audit (docs/audits/full-site-ux-audit-2026-11.md).

test("sitemap lists only product pages that exist (no 404 from sitemap.xml)", () => {
  const sitemap = read("app/sitemap.ts");
  assert.match(sitemap, /publicStorefrontProducts\.map/);
  assert.doesNotMatch(sitemap, /\.\.\.products\.map/);
  assert.match(read("app/products/[slug]/page.tsx"), /publicStorefrontProducts\.map/);
});

test("AI Career cover says 30 steps; the old «30 days» cover is gone", () => {
  assert.match(read("content/products.ts"), /cover: "\/products\/ai-career-v3\.png"/);
  assert.ok(existsSync("public/products/ai-career-v3.png"));
  assert.ok(!existsSync("public/products/ai-career-v2.png"), "ai-career-v2.png had «план развития на 30 дней» baked in");
  const cover = read("scripts/audit/render-product-cover.mjs");
  assert.match(cover, /<div class="s">[^<]*план из 30 шагов<\/div>/);
  assert.doesNotMatch(cover.slice(cover.indexOf("const html")), /30 дней/);
});

test("home hero says who and what the visitor gets, without the CTO abbreviation", () => {
  const hero = read("components/Hero.tsx");
  assert.match(hero, /Данил Миронович/);
  assert.match(hero, /меньше ручной работы/);
  assert.doesNotMatch(hero, /внешний CTO для компаний/);
});

test("services list starts with the choice; the legal note stays under it", () => {
  const s = read("components/Services.tsx");
  assert.ok(s.indexOf("Выберите задачу, похожую на вашу") < s.indexOf("<ol"));
  assert.ok(s.indexOf("не товары интернет-магазина") > s.indexOf("</ol>"));
});

test("/solutions lists five business tasks; /services keeps CTO and one compact services list", () => {
  const solutions = read("app/solutions/page.tsx");
  const list = read("components/Services.tsx");
  const services = read("app/services/page.tsx");
  assert.match(list, /directions\.filter\(\(d\) => d\.solution\)/);
  assert.match(list, /label="Пять решений"/);
  assert.doesNotMatch(solutions, /<CtoOffer\s*\/>|<OtherServices\s*\/>/);
  assert.match(solutions, /Посмотреть услуги и внешний CTO/);
  assert.match(services, /<CtoOffer\s*\/>/);
  assert.match(services, /allServices\.filter\(\(s\) => s\.slug !== "cto"\)/);
  assert.doesNotMatch(services, /<OtherServices\s*\/>|Решения для компании/);
  assert.doesNotMatch(services, /Прежние специализации|Каталог прежних услуг/);
});

test("calculator pages show a visible title on phones", () => {
  const tool = read("components/tools/ToolPage.tsx");
  assert.doesNotMatch(tool, /max-\[900px\]:sr-only/);
});

test("no 11px text remains in pages and components", () => {
  for (const f of ["components/Hero.tsx", "components/SectionLabel.tsx", "components/Footer.tsx", "components/PostList.tsx", "app/blog/[slug]/page.tsx"]) {
    assert.doesNotMatch(read(f), /text-\[11px\]/, f);
  }
});

test("shift-hours preview is not shown for a value the step rejects", () => {
  const d = initialLaborDraft();
  d.tasks = ["reports"];
  const g = d.groups[0];
  g.schedule = "5/2"; g.shiftHours = "50000";
  g.measures = { reports: { repetitions: "3", frequency: "shift", frequencyUnknown: false, duration: "5", durationUnit: "minutes", durationUnknown: false } };
  const step = laborSteps(d).find((s) => s.kind === "shift_hours");
  assert.ok(step);
  assert.notEqual(laborInsight(d, step).label, "Рабочих часов на сотрудника / месяц");
  g.shiftHours = "8";
  assert.equal(laborInsight(d, step).label, "Рабочих часов на сотрудника / месяц");
});

test("commercial flags stay off", () => {
  const commerce = read("config/ai-career-commerce.ts");
  assert.match(commerce, /salesEnabled:\s*false/);
  assert.match(commerce, /legalApproved:\s*false/);
});

test("crawler metadata is rendered in head without disabling streaming for all clients", () => {
  const cfg = read("next.config.mjs");
  assert.match(cfg, /htmlLimitedBots: \/Googlebot\|/);
  assert.match(cfg, /Lighthouse\|Bingbot/);
  assert.doesNotMatch(cfg, /htmlLimitedBots: \/\.\*\//);
});

test("home hero does not promise an all-in-one deployed platform", () => {
  const hero = read("components/Hero.tsx");
  assert.match(hero, /помогаю автоматизировать обучение/);
  assert.doesNotMatch(hero, /заявки клиентов в одной системе/);
});
