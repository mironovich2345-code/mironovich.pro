import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { headerGroups, projectsPublished } from "../config/site.ts";
import { toolsNavigation } from "../config/tools.ts";
import { contactHref } from "../config/routes.ts";

const header = readFileSync(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");
const mobile = readFileSync(new URL("../components/MobileMenu.tsx", import.meta.url), "utf8");
const dropdown = readFileSync(new URL("../components/ServicesMenu.tsx", import.meta.url), "utf8");

test("top-level navigation is three audience groups and a single task-review CTA", () => {
  assert.deepEqual(headerGroups.map(g => g.label), ["Бизнесу", "Сотрудникам", "Обо мне"]);
  assert.deepEqual(headerGroups.map(g => g.id), ["business", "employees", "about"]);
  assert.ok(header.includes('Разбор задачи'));
  assert.ok(mobile.includes('Разбор задачи'));
  assert.equal(contactHref, "/contact");
  assert.match(header, /headerGroups\.map/);
  assert.match(mobile, /groups\.map/);
});

test("business, employee and about links are sorted by intended audience", () => {
  const byId = Object.fromEntries(headerGroups.map(g => [g.id, g.links.map(l => l.href)]));
  for(const route of ["/solutions", "/services", "/services/cto", "/services/expertise", "/products/automation-priorities"]) {
    assert.ok(byId.business.includes(route), route);
  }
  assert.equal(byId.business.includes("/projects"), projectsPublished);
  assert.equal(byId.business.includes("/tools"), toolsNavigation.enabled);
  assert.deepEqual(byId.employees, ["/products/ai-career"]);
  assert.deepEqual(byId.about, ["/about", "/blog"]);
  assert.ok(!byId.business.includes("/products/ai-career"));
  assert.ok(!byId.employees.includes("/products/automation-priorities"));
  for(const group of headerGroups) {
    assert.equal(new Set(group.links.map(l => l.href)).size, group.links.length);
    assert.ok(group.links.every(l => l.href.startsWith("/") && !l.href.startsWith("//") && l.label.trim()));
  }
});

test("dropdowns preserve accessible disclosure; mobile menu preserves Escape and focus handling", () => {
  assert.match(dropdown, /aria-expanded/);
  assert.match(dropdown, /aria-controls=\{menuId\}/);
  assert.match(dropdown, /Escape/);
  assert.match(mobile, /aria-labelledby=/);
  assert.match(mobile, /aria-controls="mobile-menu"/);
  assert.match(mobile, /document\.body\.style\.overflow/);
  assert.match(mobile, /Escape/);
  assert.match(mobile, /onClick=\{close\}/);
});
