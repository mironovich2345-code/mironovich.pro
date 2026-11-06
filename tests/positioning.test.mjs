import assert from "node:assert/strict";
import { test } from "node:test";
import { allServices, services, serviceBySlug, isServiceSlug } from "../config/services.ts";
import { normalizePagePath } from "../lib/lead.ts";
import { tools, toolsNavigation } from "../config/tools.ts";

test("every published service is recognised by lead attribution", () => {
  for (const service of allServices) {
    assert.equal(normalizePagePath(service.href + "?utm_source=test"), service.href);
    assert.equal(serviceBySlug(service.slug).href, service.href);
    assert.equal(isServiceSlug(service.slug), true);
  }
  assert.equal(new Set(allServices.map((s) => s.href)).size, allServices.length);
  assert.equal(normalizePagePath("/services/not-published"), "unknown");
});

test("primary directions coexist with original published specialisations", () => {
  assert.deepEqual(services.map((s) => s.slug), ["cto", "development", "support", "expertise"]);
  for (const slug of ["automation", "apps", "training"]) {
    assert.equal(serviceBySlug(slug).href, "/services/" + slug);
  }
});

test("future tools and their catalogue stay unavailable until implemented", () => {
  assert.equal(toolsNavigation.enabled, false);
  assert.equal(tools.length, 2);
  assert.ok(tools.every((tool) => tool.status === "coming-soon"));
});
