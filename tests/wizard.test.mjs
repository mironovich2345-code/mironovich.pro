import {test} from 'node:test';
import assert from 'node:assert/strict';
import {laborAnswers,automationAnswers} from '../lib/tools/wizard.ts';
import {calculateLabor} from '../lib/tools/labor.ts';
import {calculateAutomation} from '../lib/tools/automation.ts';
const labor={task:'reporting',other:'',employees:'3',operations:'20',days:'22',minutes:'3',costMode:'hourly',hourly:'600',monthly:'',paidHours:'',percent:'50'};
test('wizard preserves documented example',()=>{const p=laborAnswers(labor);assert.ok(p.ok);assert.equal(calculateLabor(p.value).monthlyHours,66);assert.equal(calculateLabor(p.value).monthlyCost,39600);});
test('unknown price is null, not zero or an assumed salary',()=>{const p=laborAnswers({...labor,costMode:'unknown'});assert.ok(p.ok);assert.equal(p.value.hourlyCost,null);assert.equal(calculateLabor(p.value).monthlyCost,null);assert.equal(calculateLabor(p.value).monthlyHours,66);});
test('monthly costs and hours convert to hourly cost; hidden hourly value ignored',()=>{const p=laborAnswers({...labor,costMode:'monthly',monthly:'96000',paidHours:'160',hourly:'-9'});assert.ok(p.ok);assert.equal(p.value.hourlyCost,600);assert.equal(laborAnswers({...labor,costMode:'monthly',monthly:'100',paidHours:'0'}).ok,false);});
const auto={task:'transfer',systems:['manual'],api:'yes',data:'unknown',load:'unknown',employees:'3',integrations:'999',actions:['transfer'],ui:false,review:true,support:true,description:''};
test('conditional manual flow drops stale integration and API answers',()=>{const p=automationAnswers(auto);assert.ok(p.ok);assert.equal(p.value.integrations,0);assert.equal(p.value.api,'unknown');assert.equal(p.value.ai,false);const r=calculateAutomation(p.value);assert.equal(r.budget,null);assert.equal(r.stages.length,0);});
test('semantic document processing can recommend AI, simple transfer does not',()=>{const p=automationAnswers({...auto,task:'documents',actions:['analysis','documents'],data:'poor',load:'low'});assert.ok(p.ok);assert.equal(calculateAutomation(p.value).recommendation.usesAI,true);});

import {parseToolContext,describeToolContext} from '../lib/tools/context.ts';
import {LABOR_VERSION} from '../lib/tools/labor.ts';
import {automationModel} from '../config/automation-model.ts';
test('unknown wage survives server context validation without a fabricated amount',()=>{const p=laborAnswers({...labor,costMode:'unknown'});const c=parseToolContext({tool:'labor-cost',version:LABOR_VERSION,input:p.value});assert.ok(c);const text=describeToolContext(c);assert.ok(text.includes('стоимость неизвестна'));assert.ok(!text.includes('null ₽'));});
test('unknown automation factors do not become zero hours in server message',()=>{const p=automationAnswers(auto);const c=parseToolContext({tool:'automation-cost',version:automationModel.version,input:p.value});assert.ok(c);const text=describeToolContext(c);assert.ok(text.includes('трудоёмкость неизвестна'));assert.ok(!text.includes('0–0 ч'));});
