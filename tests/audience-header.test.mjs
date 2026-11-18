import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { navLinks } from "../config/site.ts";

const read = path => fs.readFileSync(path,"utf8");

test("primary navigation has exactly three clear audience destinations",()=>{
  assert.deepEqual(navLinks,[
    {href:"/solutions",label:"Бизнесу"},
    {href:"/products/ai-career",label:"Сотрудникам"},
    {href:"/about",label:"Кто я"},
  ]);
  assert.equal(new Set(navLinks.map(x=>x.href)).size,3);
});

test("header uses one CTA without the old catalog dropdown",()=>{
  const header=read("components/SiteHeader.tsx");
  assert.match(header,/navLinks\.map/);
  assert.match(header,/Обсудить задачу/);
  assert.doesNotMatch(header,/<ServicesMenu/);
  assert.match(header,/<MobileMenu links=\{navLinks\}/);
  assert.match(header,/min-\[860px\]:flex/);
});

test("mobile menu shares the same three destinations and closes on navigation",()=>{
  const menu=read("components/MobileMenu.tsx");
  assert.match(menu,/links\.map/);
  assert.doesNotMatch(menu,/services\.map/);
  assert.doesNotMatch(menu,/Решения — все направления/);
  assert.match(menu,/onClick=\{close\}/);
  assert.match(menu,/min-\[860px\]:hidden/);
  assert.match(menu,/Обсудить задачу/);
});

test("existing business and editorial links remain accessible through footer",()=>{
  const footer=read("components/Footer.tsx");
  for(const href of ['/solutions','/services','/projects','/blog','/tools','/about']){
    assert.ok(footer.includes(href),'missing footer link '+href);
  }
});

test("hero matches the 30-step offer, not the old 30-day plan",()=>{
  const hero=read("components/Hero.tsx");
  assert.match(hero,/план из 30 шагов/);
  assert.doesNotMatch(hero,/план на 30 дней/);
});
