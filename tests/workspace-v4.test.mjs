import test from 'node:test';
import assert from 'node:assert/strict';
import { initialWorkspaceDraft, emptyMeasure, taskWorkspaceState, buildQuizLabor, laborSteps } from '../lib/tools/quiz-draft.ts';
import { calculateQuizLabor } from '../lib/tools/quiz-model.ts';
import { encodeCheckpoint, decodeCheckpoint } from '../lib/tools/quiz-state.ts';
import { parseToolContext, describeToolContext } from '../lib/tools/context.ts';

const control = () => {
  const d = initialWorkspaceDraft();
  d.month = '2026-11';
  Object.assign(d.groups[0], {
    employees: '4', schedule: '2/2', shiftHours: '8', amount: '120000',
    measures: { reporting: { ...emptyMeasure(), repetitions: '20', duration: '5' } },
  });
  return d;
};

test('workspace has one default task but no invented workload, salary or schedule', () => {
  const d = initialWorkspaceDraft();
  assert.deepEqual(d.tasks, ['reporting']);
  assert.equal(d.groups[0].employees, '4');
  assert.equal(d.groups[0].amount, '');
  assert.equal(d.groups[0].shiftHours, '');
  assert.equal(d.groups[0].schedule, '');
  assert.equal(taskWorkspaceState(d, 'reporting').hours, null);
  assert.equal(taskWorkspaceState(d, 'reporting').missing.kind, 'frequency');
});

test('independent November control: 4 people, 20 x 5 min, average 15 shifts, salary 120000, 8 h', () => {
  const expectedHours = 4 * 20 * 5 / 60 * 15;
  const expectedRate = 120000 / (15 * 8);
  const s = taskWorkspaceState(control(), 'reporting');
  assert.equal(expectedHours, 100);
  assert.equal(s.hours, expectedHours);
  assert.equal(s.result.groups[0].paidHours, 120);
  assert.equal(s.result.groups[0].rate, expectedRate);
  assert.equal(s.row.cost, expectedHours * expectedRate);
  assert.equal(s.row.annualCost, 1200000);
  assert.equal(s.missing, null);
});

for (const actualShifts of [14, 15, 16]) test(`actual ${actualShifts} shifts: no double period multiplication`, () => {
  const d = control();
  Object.assign(d.groups[0], { useActual: true, actualShifts: String(actualShifts) });
  const s = taskWorkspaceState(d, 'reporting');
  assert.equal(s.hours, Math.round(4 * 20 * 5 / 60 * actualShifts * 100) / 100);
  assert.equal(s.result.groups[0].paidHours, actualShifts * 8);
  assert.equal(s.row.cost, 100000);
});

test('selected completed task keeps its money while a second task is incomplete', () => {
  const d = control();
  d.tasks.push('transfer');
  d.groups[0].measures.transfer = emptyMeasure();
  assert.equal(buildQuizLabor(d), null);
  assert.equal(taskWorkspaceState(d, 'reporting').row.cost, 100000);
  assert.equal(taskWorkspaceState(d, 'transfer').row, null);
  d.groups[0].measures.transfer = { ...emptyMeasure(), repetitions: '10', duration: '3' };
  const all = calculateQuizLabor(buildQuizLabor(d));
  assert.deepEqual(all.rows.map(r => r.cost), [100000, 30000]);
  assert.equal(all.totalCost, null, 'overlapping tasks never acquire an implicit total');
});

test('a completed selected task restores on result without trusting an unfinished task', () => {
  const d = control(); d.tasks.push('transfer');
  const raw = encodeCheckpoint('labor-cost', d, 'result', 100, 'reporting');
  const restored = decodeCheckpoint('labor-cost', raw, 101);
  assert.equal(restored.step, 'result');
  assert.equal(restored.activeTask, 'reporting');
  assert.equal(taskWorkspaceState(restored.draft, restored.activeTask).row.cost, 100000);
  const unfinished = decodeCheckpoint('labor-cost', encodeCheckpoint('labor-cost', d, 'result', 100, 'transfer'), 101);
  assert.notEqual(unfinished.step, 'result');
  const tampered = JSON.parse(raw); tampered.activeTask = 'private free text';
  assert.ok(!JSON.stringify(decodeCheckpoint('labor-cost', JSON.stringify(tampered), 101)).includes('private free text'));
});

test('missing shift length is named, hours remain visible and money is not invented', () => {
  const d = control(); d.groups[0].shiftHours = '';
  const s = taskWorkspaceState(d, 'reporting');
  assert.equal(s.missing.kind, 'shift_hours');
  assert.equal(s.hours, 100);
  assert.equal(s.row, null);
});

test('unknown salary retains valid hours and context, never creates rubles', () => {
  const d = control(); Object.assign(d.groups[0], { payKind: 'unknown', amount: '' });
  const s = taskWorkspaceState(d, 'reporting');
  assert.equal(s.hours, 100);
  assert.equal(s.row.cost, null);
  assert.equal(s.missing, null);
  assert.equal(s.input.groups[0].pay.kind, 'unknown');
});

for (const [period, hours] of [['week', 28.57], ['month', 6.67]]) test(`partial ${period} hours do not require a schedule or fake rate`, () => {
  const d = control();
  Object.assign(d.groups[0], { schedule: '', shiftHours: '', amount: '' });
  d.groups[0].measures.reporting.frequency = period;
  const s = taskWorkspaceState(d, 'reporting');
  assert.equal(s.hours, hours);
  assert.equal(s.row, null);
});

test('invalid actual shifts and excessive/unknown operations never leak partial false hours', () => {
  const d = control(); Object.assign(d.groups[0], { useActual: true, actualShifts: '31' });
  assert.equal(taskWorkspaceState(d, 'reporting').hours, null);
  d.groups[0].useActual = false;
  d.groups[0].measures.reporting.repetitions = '100000';
  assert.equal(taskWorkspaceState(d, 'reporting').hours, null);
  d.groups[0].measures.reporting.frequencyUnknown = true;
  assert.equal(taskWorkspaceState(d, 'reporting').hours, null);
});

test('zero operations stay zero even without a duration', () => {
  const d = control(); Object.assign(d.groups[0].measures.reporting, { repetitions: '0', duration: '' });
  const s = taskWorkspaceState(d, 'reporting');
  assert.equal(s.hours, 0);
  assert.equal(s.row.cost, 0);
});

test('salary and full employer expenses use the same explicit rate but retain their basis', () => {
  const d = control(); d.groups[0].payKind = 'employer';
  const s = taskWorkspaceState(d, 'reporting');
  assert.equal(s.result.basis, 'employer');
  assert.equal(s.row.cost, 100000);
});

test('selected complete task context is independently recalculated by existing server parser', () => {
  const d = control(); d.tasks.push('transfer');
  const s = taskWorkspaceState(d, 'reporting');
  const c = parseToolContext({ tool: 'labor-cost', version: 'tools-quiz-4.0.0', quiz: true, input: { kind: 'labor', data: s.input }, cost: 1 });
  assert.ok(c);
  const text = describeToolContext(c);
  assert.match(text, /100000/);
  assert.match(text, /1200000/);
  assert.deepEqual(c.input.data.tasks, ['reporting']);
});

test('conditional actual-shift and zero-frequency steps keep honest progress', () => {
  const d = control();
  assert.equal(laborSteps(d).length, 7);
  d.groups[0].schedule = 'other';
  assert.equal(laborSteps(d).length, 8);
  assert.ok(laborSteps(d).some(s => s.kind === 'actual_shifts'));
  d.groups[0].measures.reporting.repetitions = '0';
  assert.equal(laborSteps(d).length, 7);
  assert.ok(!laborSteps(d).some(s => s.kind === 'duration'));
});
