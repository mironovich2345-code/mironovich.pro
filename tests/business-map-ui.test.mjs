import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prototypeAvailable } from '../lib/business-map/prototype-policy.ts';
import { demoNames, loadDemo } from '../lib/business-map/demo.ts';
import { calculateBusinessMap } from '../lib/business-map/calculate.ts';

test('local prototype requires explicit dev opt-in; plain production remains closed',()=>{
  for(const env of ['production','test',undefined])for(const flag of ['1','0',undefined])assert.equal(prototypeAvailable(env,flag),false);
  assert.equal(prototypeAvailable('development','1'),true);
  assert.equal(prototypeAvailable('development',undefined),false);
});

test('synthetic examples cover honest incomplete, risk, cash, capacity and priority states',()=>{
  for(const key of Object.keys(demoNames))assert.doesNotThrow(()=>calculateBusinessMap(loadDemo(key)));
  const portfolio=calculateBusinessMap(loadDemo('portfolio'));
  assert.deepEqual(portfolio.processes.map(p=>p.group),['first','later','not-now']);
  assert.equal(calculateBusinessMap(loadDemo('missing')).recommendedId,null);
  const risk=calculateBusinessMap(loadDemo('risk'));assert.equal(risk.processes[0].risk.level,'high');assert.equal(risk.recommendedId,null);
  assert.ok(calculateBusinessMap(loadDemo('payback')).processes[0].scenarios.every(s=>s.payback.status==='not-recoverable'));
  const capacity=calculateBusinessMap(loadDemo('capacity'));assert.equal(capacity.recommendedId,null);assert.equal(capacity.processes[0].confidence,'low');
  const isolated=loadDemo('portfolio');isolated.processes[0].operations=999;
  assert.equal(loadDemo('portfolio').processes[0].operations,40);
});
