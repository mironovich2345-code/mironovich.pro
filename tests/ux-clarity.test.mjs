import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { directions } from '../config/directions.ts';
import { solutions, solutionHref, entryPrice } from '../config/solutions.ts';
import { additionalServices } from '../config/commercial.ts';
import { allServices } from '../config/services.ts';
import { serviceTopics } from '../content/service-topics.ts';
import { products, productBySlug } from '../content/products.ts';
import { navLinks } from '../config/site.ts';
import { track, trackFormStartOnce } from '../lib/analytics.ts';

test('six directions preserve offer URLs and derive pilot prices from the existing registry', () => {
  assert.deepEqual(directions.map(d => d.title), [
    'Обучение и адаптация сотрудников', 'Рейтинги и мотивация команды',
    'Отчётность и управление финансами', 'Контроль стандартов филиалов',
    'ИИ для поиска и обработки клиентов', 'Внешний технологический директор',
  ]);
  for (const s of solutions) {
    const d = directions.find(d => d.id === s.slug);
    assert.equal(d.href, solutionHref(s));
    assert.equal(d.price, entryPrice(s));
    assert.equal(d.solution, s.slug);
  }
  const cto = directions.find(d => d.id === 'cto');
  assert.equal(cto.href, '/services/cto');
  assert.match(cto.price.replace(/\s/g, ''), /150000₽\/мес\.·до30часов/);
});

test('each additional topic has one real legacy URL, a unique matching anchor and landing copy', () => {
  assert.equal(additionalServices.length, 8);
  assert.equal(new Set(additionalServices.map(s => s.href)).size, 8);
  assert.deepEqual(Object.keys(serviceTopics).sort(), additionalServices.map(s => s.id).sort());
  for (const s of additionalServices) {
    assert.equal(s.href, `/services/${s.service}#${s.id}`);
    assert.ok(allServices.some(old => old.slug === s.service && old.href === s.href.split('#')[0]));
    assert.ok(serviceTopics[s.id].result.length > 30);
    assert.ok(serviceTopics[s.id].scope.length > 30);
  }
  assert.match(serviceTopics['voice-ai'].scope, /правовой проверки/);
  assert.match(serviceTopics['voice-ai'].scope, /холодный рекламный обзвон не входит/);
});

test('ai-career remains the single preparing product at the same URL, with launch price 1990 and a real cover', () => {
  const p = productBySlug('ai-career');
  assert.equal(products.filter(p => p.slug === 'ai-career').length, 1);
  assert.equal(p.title, 'Как стать ценнее для компании с помощью ИИ');
  assert.equal(p.plannedPrice, 1990);
  assert.equal(p.status, 'preparing');
  assert.ok(existsSync(new URL('../public' + p.cover, import.meta.url)));
  assert.match(p.chapters.at(-1), /30 дней/);
  assert.equal(productBySlug('automation-priorities').plannedPrice, 4934);
});


test('homepage separates company and employee journeys and exposes the employee product in navigation', () => {
  const hero = readFileSync(new URL('../components/Hero.tsx', import.meta.url), 'utf8');
  assert.match(hero, /Технологии для бизнеса/);
  assert.match(hero, /ИИ для сотрудников/);
  assert.match(hero, /href="#contact"/);
  assert.match(hero, /href="\/tools\/labor-cost"/);
  assert.match(hero, /href="\/products\/ai-career"/);
  assert.match(hero, /Запросить консультацию/);
  assert.ok(navLinks.some(link => link.href === '/products/ai-career' && link.label === 'Сотрудникам'));
});

test('new entry events carry only allowed identifiers; unknown topics and PII are dropped or redacted', () => {
  const previous = globalThis.window;
  globalThis.window = { location: { pathname: '/' } };
  try {
    track('cta_click', { location: 'hero_calculator', tool: 'labor' });
    track('cta_click', { location: 'hero_product', product: 'ai-career' });
    track('cta_click', { location: 'other_services', service: 'automation', topic: 'crm' });
    track('additional_services_open', { location: 'other_services' });
    track('cta_click', { product: 'buyer@example.com', topic: 'private-company', solution: 'private-project', name: 'Имя', task: 'Произвольный текст', email: 'buyer@example.com', utm_source: 'buyer@example.com' });
    const events = window.mrnvEvents;
    assert.equal(events[0].tool, 'labor');
    assert.equal(events[1].product, 'ai-career');
    assert.equal(events[2].topic, 'crm');
    assert.equal(events[3].event, 'additional_services_open');
    assert.deepEqual(Object.keys(events[4]).sort(), ['event', 'page', 'utm_source']);
    assert.ok(!JSON.stringify(events).includes('buyer@example.com'));
    assert.ok(!JSON.stringify(events).includes('Произвольный текст'));
  } finally { globalThis.window = previous; }
});

test('form_start remains once per session across entry routes', () => {
  const previous = globalThis.window;
  const values = new Map();
  globalThis.window = { location: { pathname: '/solutions/corporate-academy' }, sessionStorage: { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) } };
  try {
    trackFormStartOnce();
    window.location.pathname = '/services/cto';
    trackFormStartOnce();
    assert.equal(window.mrnvEvents.filter(e => e.event === 'form_start').length, 1);
    assert.ok(!window.mrnvEvents.some(e => e.event === 'lead_submit_success'));
  } finally { globalThis.window = previous; }
});
