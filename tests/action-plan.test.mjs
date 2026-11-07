import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultAutomation, calculateAutomation } from '../lib/tools/automation.ts';
import { buildActionPlan } from '../lib/tools/action-plan.ts';
import { parseDiagnosis, applyDiagnosis, PROGRAM_NAMES_LIMIT } from '../lib/tools/diagnosis.ts';
import { automationAnswers, diagnosisAnswers } from '../lib/tools/wizard.ts';
import { describeToolContext, parseToolContext } from '../lib/tools/context.ts';
import { calculateLabor } from '../lib/tools/labor.ts';
import { automationModel } from '../config/automation-model.ts';
import { formatLeadMessage } from '../lib/lead-message.ts';

const input = { ...defaultAutomation, api: 'yes', data: 'clean', integrations: 1 };
const diagnosis = { systems: ['crm'], programNames: 'Битрикс24', goal: 'time', errorImpact: 'fixable', actions: ['transfer'] };
const labor = { employees: 3, operationsPerDay: 20, minutesPerOperation: 3, workingDays: 22, hourlyCost: 600, automationPercent: 50 };
const scenarios = [
  ['reporting', { api: 'yes' }, { goal: 'control', actions: ['reports'] }, 'Интеграция существующих систем', 'ручным отчётом'],
  ['transfer', { integrations: 0 }, { systems: ['manual'] }, 'Скрипт или небольшой внутренний инструмент', 'тестовую запись'],
  ['documents', { data: 'poor' }, { actions: ['analysis', 'documents'], errorImpact: 'financial' }, 'ИИ-автоматизация', 'обязательные поля'],
  ['requests', {}, { goal: 'service', actions: ['transfer'] }, 'Готовый SaaS-сервис', 'одной заявки'],
  ['knowledge', { data: 'mixed' }, { actions: ['answers'] }, 'ИИ-автоматизация', 'ссылки на источники'],
  ['custom', { interface: true }, { actions: ['other'] }, 'Разработка приложения', 'границы задачи'],
  ['reporting', { integrations: 0, load: 'high' }, { systems: ['manual'], actions: ['reports'] }, 'Обычная автоматизация', 'ручным отчётом'],
];
for (const [task, changes, answers, approach, pilot] of scenarios) {
  test(`personal plan: ${task}, ${approach}`, () => {
    const i = { ...input, ...changes, processType: task }, d = { ...diagnosis, ...answers };
    const plan = buildActionPlan(i, d);
    assert.equal(plan.recommendation.approach, approach);
    assert.equal(plan.steps.length, 6);
    assert.equal(plan.checks.length, 5);
    assert.ok(plan.steps.some(s => s.includes(pilot)));
    assert.equal(calculateAutomation(i, undefined, undefined, d).recommendation.approach, approach);
  });
}
test('structured analysis and template documents do not imply AI; semantic questions do', () => {
  for (const task of ['reporting', 'transfer', 'documents', 'knowledge']) {
    const plan = buildActionPlan({ ...input, processType: task, ai: true }, { ...diagnosis, actions: ['analysis', 'documents'] });
    assert.equal(plan.recommendation.usesAI, false);
  }
  assert.equal(buildActionPlan({ ...input, processType: 'knowledge' }, { ...diagnosis, actions: ['answers'] }).recommendation.usesAI, true);
  assert.equal(buildActionPlan({ ...input, processType: 'knowledge', data: 'unknown' }, { ...diagnosis, actions: ['analysis'] }).recommendation.usesAI, false);
});
test('business goal changes the route and measurable success criterion', () => {
  const i = { ...input, processType: 'requests' };
  const sales = buildActionPlan(i, { ...diagnosis, goal: 'sales' });
  const time = buildActionPlan(i, diagnosis);
  assert.equal(sales.recommendation.approach, 'Готовый SaaS-сервис');
  assert.equal(time.recommendation.approach, 'Интеграция существующих систем');
  assert.match(sales.steps.join(' '), /без обещания роста выручки/);
  assert.match(time.steps.join(' '), /Замерить время/);
});
for (const errorImpact of ['client', 'financial', 'serious', 'unknown']) {
  test(`risk ${errorImpact} overrides unchecked human review`, () => {
    const plan = buildActionPlan({ ...input, humanReview: false, processType: 'knowledge' }, { ...diagnosis, actions: ['answers'], errorImpact });
    assert.equal(plan.humanControl, true);
    assert.match(plan.steps[4], /подтверждающего результат до внешних действий/);
    assert.match(plan.steps[5], /под контролем человека/);
    assert.match(plan.recommendation.reason, /бесконтрольный запуск не рекомендуется/);
  });
}
test('low risk respects choice, but still prescribes testing and rollback', () => {
  const plan = buildActionPlan({ ...input, humanReview: false }, { ...diagnosis, errorImpact: 'low' });
  assert.equal(plan.humanControl, false);
  assert.match(plan.steps[4], /Протестировать ошибки/);
  assert.match(plan.steps[5], /откат/);
});
test('unknown answers and unsupported connectivity require verification, not made-up capabilities', () => {
  const d = { ...diagnosis, goal: 'unknown', errorImpact: 'unknown' };
  const i = { ...input, api: 'unknown', data: 'unknown', load: 'unknown' };
  const plan = buildActionPlan(i, d);
  assert.match(plan.uncertainty, /Нужна техническая проверка/);
  assert.match(plan.steps.join(' '), /Выбрать бизнес-цель/);
  assert.match(plan.checks[0], /Подключение не подтверждено/);
  assert.match(plan.checks[1], /Состояние данных неизвестно/);
  assert.equal(calculateAutomation(i, undefined, undefined, d).stages.length, 0);
  assert.ok(!plan.recommendation.reason.includes('Битрикс24 поддерживает'));
});
test('interface requirement is retained even for an AI solution', () => {
  const plan = buildActionPlan({ ...input, processType: 'knowledge', interface: true }, { ...diagnosis, actions: ['answers'] });
  assert.match(plan.steps[1], /прототип экрана/);
});
test('custom process does not imply that a bespoke app is already necessary', () => {
  const plan = buildActionPlan({ ...input, processType: 'custom' }, diagnosis);
  assert.equal(plan.recommendation.approach, 'Обычная автоматизация');
  assert.match(plan.uncertainty, /техническая проверка/);
});
for (const bad of [null, [], { ...diagnosis, goal: 'toString' }, { ...diagnosis, errorImpact: 'invalid' }, { ...diagnosis, systems: ['crm', 'manual'] }, { ...diagnosis, systems: ['crm', 'crm'] }, { ...diagnosis, actions: [] }, { ...diagnosis, actions: ['__proto__'] }, { ...diagnosis, programNames: [] }, { ...diagnosis, programNames: 'x'.repeat(PROGRAM_NAMES_LIMIT + 1) }, { ...diagnosis, programNames: 'CRM\nsecret' }]) {
  test(`diagnosis rejects invalid payload ${JSON.stringify(bad)}`, () => assert.equal(parseDiagnosis(bad), null));
}
test('manual choice drops stale program/API/integration data; whitelisting removes invented results', () => {
  const d = parseDiagnosis({ ...diagnosis, systems: ['manual'], programNames: 'stale', plan: 'forged', budget: 1 });
  assert.equal(d.programNames, '');
  assert.equal(d.plan, undefined);
  const i = applyDiagnosis(input, d);
  assert.equal(i.api, 'unknown'); assert.equal(i.integrations, 0);
});
test('wizard saves answers in memory and produces the same typed answers for UI and server', () => {
  const answers = { task: 'knowledge', systems: ['crm'], programNames: 'amoCRM', api: 'yes', data: 'mixed', load: 'low', employees: '3', integrations: '1', actions: ['answers'], ui: false, review: false, support: true, description: '', goal: 'service', errorImpact: 'serious' };
  const p = automationAnswers(answers), d = diagnosisAnswers(answers);
  assert.ok(p.ok); assert.equal(p.value.ai, true);
  const c = parseToolContext({ tool: 'automation-cost', version: automationModel.version, input: p.value, diagnosis: d, plan: ['forged'], recommendation: 'fake' });
  assert.deepEqual(c.diagnosis, d);
  assert.match(describeToolContext(c), /под контролем человека/);
  assert.ok(!describeToolContext(c).includes('forged'));
  assert.equal(parseToolContext({ ...c, diagnosis: { ...d, goal: 'invalid' } }), null);
});
test('server re-derives AI and documents instead of trusting contradictory browser booleans', () => {
  const c = parseToolContext({ tool: 'automation-cost', version: automationModel.version, input: { ...input, ai: true, documents: true }, diagnosis });
  assert.equal(c.input.ai, false); assert.equal(c.input.documents, false);
});
test('server context includes plan, goal, programs, impact, constraints and labor numbers', () => {
  const text = describeToolContext({ tool: 'automation-cost', version: automationModel.version, input, diagnosis, labor });
  for (const expected of ['Сократить ручную работу', 'Битрикс24', 'Сотрудник сможет исправить', 'План:', '6.', 'Ограничения:', '39600 ₽/мес', '66 ч/мес', 'потенциал 33 ч']) assert.ok(text.includes(expected), expected);
});
test('diagnostic Telegram payload is escaped and remains under the Telegram limit with hostile maximum fields', () => {
  for (const [task, changes, answers] of scenarios) {
    const context = describeToolContext({ tool: 'automation-cost', version: automationModel.version, input: { ...input, ...changes, processType: task }, diagnosis: { ...diagnosis, ...answers, programNames: '<script>&'.repeat(16) }, labor });
    const text = formatLeadMessage({ context, name: '<'.repeat(100), phone: '&'.repeat(40), company: '<'.repeat(120), direction: '<'.repeat(100), task: '<&>'.repeat(666), page: '/tools/automation-cost', date: '07.11.2026', consentVersion: 'v'.repeat(80), attribution: Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','referrer','landingPage'].map(k => [k, '&'.repeat(100)])) });
    assert.ok(text.length < 4096, text.length);
    assert.ok(!text.includes('<script>'));
    assert.ok(text.includes('6.'));
    assert.ok(text.includes('Ограничения:'));
    assert.ok(text.includes('39600 ₽/мес'));
    assert.ok(text.includes('&lt;script&gt;'));
  }
});
test('original hand-checked formulas and publication gates remain unchanged', () => {
  assert.deepEqual(calculateLabor(labor), { monthlyHours: 66, monthlyCost: 39600, annualCost: 475200, freedHours: 33, freedTimeValue: 19800 });
  const original = calculateAutomation({ ...input, integrations: 0, support: false });
  assert.deepEqual(original.hours, [24, 68]);
  assert.equal(automationModel.approvedByOwner, false);
  assert.equal(automationModel.publicPricingEnabled, false);
  assert.equal(original.budget, null); assert.equal(original.paybackMonths, null);
  assert.equal(buildActionPlan(input, diagnosis).economics, null);
  assert.equal(buildActionPlan(input, diagnosis, { ...labor, hourlyCost: null }).economics.monthlyCost, null);
});
test('full plan, labor and program names survive escaped Telegram context budget', () => {
  const d = { systems: ['tables', 'crm', 'messages', 'several', 'other'], programNames: '&'.repeat(160), goal: 'sales', errorImpact: 'serious', actions: ['answers', 'analysis', 'decisions', 'documents'] };
  const context = describeToolContext({ tool: 'automation-cost', version: automationModel.version, input: { ...input, processType: 'training', interface: true, api: 'unknown', data: 'unknown' }, diagnosis: d, labor });
  const text = formatLeadMessage({ context, name: 'Тест', phone: '@test_user', task: 'Проверить план', company: '', direction: '', page: '/tools/automation-cost', date: '07.11.2026', consentVersion: 'v1', attribution: {} });
  assert.ok(text.includes('&amp;'.repeat(160) + '.'));
  assert.ok(!text.includes('…'));
  assert.ok(text.length < 4096);
});
test('zero employees prompts clarification instead of assuming a process owner', () => {
  const plan = buildActionPlan({ ...input, employees: 0 }, diagnosis);
  assert.match(plan.checks.join(' '), /ноль сотрудников/);
});
test('normal diagnostic leads retain an 800-character task when the message has room', () => {
  const context = describeToolContext({ tool: 'automation-cost', version: automationModel.version, input, diagnosis });
  const task = 'я'.repeat(800);
  const text = formatLeadMessage({ context, name: 'Тест', phone: '@test_user', task, company: '', direction: '', page: '/tools/automation-cost', date: '07.11.2026', consentVersion: 'v1', attribution: {} });
  assert.ok(text.includes(task));
  assert.ok(text.length < 4096);
});
