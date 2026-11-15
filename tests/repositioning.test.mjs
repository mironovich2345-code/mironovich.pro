import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solutions, SOLUTION_SLUGS, solutionHref } from '../config/solutions.ts';
import { ctoOffer, additionalServices } from '../config/commercial.ts';
import { allServices } from '../config/services.ts';
import { normalizePagePath, leadDirectionForPage, isLeadDirection } from '../lib/lead.ts';
import { projectEntries, projects, canPublishProject, verifiedProjectDemo } from '../content/projects.ts';
import { solutionServiceSchema } from '../lib/solution-schema.ts';

test('five commercial offers preserve the owner prices and MVP has no invented full price',()=>{
  assert.deepEqual(solutions.map(s=>s.slug),SOLUTION_SLUGS);
  assert.deepEqual(solutions.map(s=>s.pilot),[99000,89000,65000,69000,180000]);
  assert.deepEqual(solutions.map(s=>s.full??null),[290000,190000,160000,180000,null]);
  for(const s of solutions){
    assert.equal(normalizePagePath(solutionHref(s)+'?utm_source=test'),solutionHref(s));
    assert.equal(leadDirectionForPage(solutionHref(s)),s.slug);
    assert.equal(isLeadDirection(s.slug),true);
    const schema=solutionServiceSchema(s,'https://example.invalid');
    assert.equal(schema.offers.priceSpecification.minPrice,s.pilot);
    assert.equal(schema.offers.priceSpecification.priceCurrency,'RUB');
    assert.equal('price' in schema.offers,false); // Starting estimate, not a fixed checkout price.
  }
  assert.equal(normalizePagePath('/solutions/not-published'),'unknown');
  assert.equal(leadDirectionForPage('/solutions/employee-kpi?injected=1'),null);
  assert.equal(normalizePagePath('/prototype/business-map'),'unknown');
});

test('new offerings reference the existing case registry; only EATLYY and CLUB OPS are public',()=>{
  for(const s of solutions){
    const cases=projectEntries.filter(p=>p.slug===s.caseSlug);
    assert.equal(cases.length,1);
    const p=cases[0]; assert.equal(p.solution,s.slug);
    assert.ok(p.task && p.built && p.stage);
    for(const key of ['audience','demoComposition','readiness','permission'])assert.ok(p.caseEvidence[key]);
    assert.ok(p.caseEvidence.sources.length && p.caseEvidence.metrics.length);
    assert.equal(verifiedProjectDemo(p),undefined);
    if(p.slug!=='club-ops'){assert.equal(p.publication,'draft');assert.equal(canPublishProject(p),false);}
  }
  assert.deepEqual(projects.map(p=>p.slug),['eatlyy','club-ops']);
});

test('a demo URL alone or failed check never creates a public link, including approved cases',()=>{
  const p=structuredClone(projects.find(p=>p.slug==='club-ops'));
  p.demoUrl='https://demo.invalid/';assert.equal(verifiedProjectDemo(p),undefined);
  p.demoVerification={available:false,checkedAt:'2026-11-15',permission:'Owner approved synthetic demonstration'};
  assert.equal(verifiedProjectDemo(p),undefined);
  p.demoVerification.available=true;
  assert.equal(verifiedProjectDemo(p),'https://demo.invalid/');
  for(const url of ['http://demo.invalid','javascript:alert(1)','https://user:password@demo.invalid']){
    p.demoUrl=url;assert.equal(verifiedProjectDemo(p),undefined);
  }
  p.demoUrl='https://demo.invalid/';p.publication='draft';assert.equal(verifiedProjectDemo(p),undefined);
});

test('CTO monthly package totals thirty hours; additional services keep real old URLs',()=>{
  assert.equal(ctoOffer.monthlyPrice,150000);assert.equal(ctoOffer.hours,30);
  assert.equal(ctoOffer.allocation.reduce((n,r)=>n+r.hours,0),30);
  assert.equal(additionalServices.length,8);
  for(const s of additionalServices)assert.ok(allServices.some(old=>old.href===s.href.split('#')[0]));
  assert.equal(leadDirectionForPage('/services/cto'),'cto');
});
