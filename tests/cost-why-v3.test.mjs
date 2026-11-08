import assert from "node:assert/strict";
import { test } from "node:test";
import { COST_VERSION, calculateCostWhy, costToGuided, parseCostInput, whyReview } from "../lib/tools/cost-why.ts";
import { buildCostDraft, costDrafts, emptyCostDraft } from "../lib/tools/cost-why-draft.ts";
import { DEFAULT_EMPLOYEES, EMPLOYEE_PRESETS, initialGuided, taskLabels } from "../lib/tools/guided.ts";
import { COST_STORAGE_KEY, decodeCostTransfer, encodeCostTransfer, guidedToCost } from "../lib/tools/cost-why-storage.ts";
import { GUIDED_STORAGE_KEY, decodeGuidedTransfer, encodeGuidedTransfer } from "../lib/tools/storage.ts";
import { parseToolContext, describeToolContext } from "../lib/tools/context.ts";
import { formatLeadMessage } from "../lib/lead-message.ts";

const timing={employees:3,frequency:"day",repetitions:20,minutes:3,periodsPerMonth:22,periodAssumption:false};
const process={timing,cost:{kind:"hourly",hourly:600},independent:false};
const base={tasks:["reporting"],employees:4,systems:[],impact:"unknown",processes:{reporting:process}};
const draft={...emptyCostDraft('4'),employees:'3',allTeam:false,repetitions:'20',minutes:'3',hourly:'600',periodAssumption:false};
const build=(patch={})=>buildCostDraft({tasks:['reporting'],employees:'4',systems:[],impact:'unknown',drafts:{reporting:draft},...patch});

test('v3 defaults preserve team presets, empty pay and explicit editable assumptions',()=>{
 assert.equal(DEFAULT_EMPLOYEES,4);assert.deepEqual(EMPLOYEE_PRESETS,[4,10,25,50]);
 const d=emptyCostDraft('4');assert.equal(d.hourly,'');assert.equal(d.monthly,'');assert.equal(d.repetitions,'');assert.equal(d.minutes,'');assert.equal(d.periods,'22');assert.equal(d.periodAssumption,true);assert.equal(d.paidHours,'160');assert.equal(d.hoursAssumption,true);
});
test('documented example yields 66 hours, 39600/month, 475200/year, 30/operation',()=>{
 const r=calculateCostWhy(base),row=r.rows[0];assert.equal(row.hours,66);assert.equal(row.cost,39600);assert.equal(row.annualCost,475200);assert.equal(row.costPerOperation,30);assert.equal(row.operations,1320);assert.equal(r.totalHours,66);assert.equal(r.totalCost,39600);assert.equal(r.cashSavings,null);assert.equal(r.freedHours,null);
});
test('monthly loaded employee cost derives rate without rounding it before calculation',()=>{
 const source={...base,processes:{reporting:{...process,cost:{kind:'monthly',monthly:96000,hours:160,hoursAssumption:true}}}};
 assert.equal(calculateCostWhy(source).rows[0].hourlyRate,600);assert.equal(calculateCostWhy(source).rows[0].cost,39600);
 const fractional={...base,processes:{reporting:{...process,cost:{kind:'monthly',monthly:100001,hours:176,hoursAssumption:false}}}};
 const row=calculateCostWhy(fractional).rows[0];assert.equal(row.cost,Math.round(66*100001/176*100)/100);assert.equal(row.annualCost,Math.round(row.cost*12*100)/100);
});
test('unknown rate, unknown time, explicit zero and conditional scenarios stay distinct',()=>{
 const unknown={...base,processes:{reporting:{...process,cost:{kind:'unknown'}}}};
 assert.equal(calculateCostWhy(unknown).rows[0].cost,null);assert.equal(calculateCostWhy(unknown).rows[0].hours,66);
 const empty={...base,processes:{reporting:{timing:null,cost:{kind:'unknown'},independent:false}}};assert.equal(calculateCostWhy(empty).rows[0].hours,null);assert.equal(calculateCostWhy(empty).rows[0].cost,null);
 const zero={...base,processes:{reporting:{...process,cost:{kind:'hourly',hourly:0}}}};assert.equal(calculateCostWhy(zero).rows[0].cost,0);
 const scenario=structuredClone(unknown);scenario.processes.reporting.cost={kind:'hourly',hourly:1000};assert.equal(calculateCostWhy(scenario).rows[0].cost,66000);assert.equal(calculateCostWhy(unknown).rows[0].cost,null);
});
test('day/week/month have explicit conversion periods, no hidden schedule',()=>{
 for(const [frequency,repetitions,periodsPerMonth,hours] of [['day',1,20,20],['week',1,4.5,4.5],['month',1,1,1]]){
  const input={...base,processes:{reporting:{...process,timing:{...timing,employees:1,frequency,repetitions,minutes:60,periodsPerMonth}}}};assert.equal(calculateCostWhy(input).rows[0].hours,hours);
 }
 assert.equal(parseCostInput({...base,processes:{reporting:{...process,timing:{...timing,frequency:'month',periodsPerMonth:2}}}}),null);
});
test('partial process data never produce a false overall total',()=>{
 const partial={...base,tasks:['reporting','transfer'],processes:{reporting:{...process,independent:true},transfer:{timing:null,cost:{kind:'unknown'},independent:true}}};
 const r=calculateCostWhy(partial);assert.equal(r.rows[0].cost,39600);assert.equal(r.rows[1].hours,null);assert.equal(r.totalHours,null);assert.equal(r.totalCost,null);assert.equal(r.complete,false);
});
test('overlap or unchecked independence blocks totals while preserving rows',()=>{
 const multiple={...base,tasks:['reporting','transfer'],processes:{reporting:process,transfer:process}};
 assert.equal(calculateCostWhy(multiple).canSum,false);assert.equal(calculateCostWhy(multiple).totalCost,null);assert.equal(calculateCostWhy(multiple).rows.length,2);
 multiple.processes={reporting:{...process,independent:true},transfer:{...process,independent:true}};assert.equal(calculateCostWhy(multiple).totalHours,132);assert.equal(calculateCostWhy(multiple).totalCost,79200);assert.equal(calculateCostWhy(multiple).totalAnnualCost,950400);
});
test('complete independent hours can sum but an unknown rate cannot become zero cost',()=>{
 const input={...base,tasks:['reporting','transfer'],processes:{reporting:{...process,independent:true},transfer:{...process,cost:{kind:'unknown'},independent:true}}};
 const r=calculateCostWhy(input);assert.equal(r.totalHours,132);assert.equal(r.totalCost,null);assert.equal(r.totalAnnualCost,null);
});
test('implausible employee/team workload blocks aggregation; impossible schedules rejected',()=>{
 const busy={...process,timing:{...timing,employees:1,frequency:'month',repetitions:210,minutes:60,periodsPerMonth:1},independent:true};
 const input={...base,tasks:['reporting','transfer'],employees:1,processes:{reporting:busy,transfer:busy}};
 assert.equal(calculateCostWhy(input).overCapacity,true);assert.equal(calculateCostWhy(input).canSum,false);
 assert.equal(parseCostInput({...base,processes:{reporting:{...process,timing:{...timing,repetitions:100000}}}}),null);
});
test('strict v3 input rejects malformed structures, inactive fields and forged assumptions',()=>{
 for(const input of [null,[],{...base,extra:'field'},{...base,tasks:['reporting','reporting']},{...base,employees:0},{...base,systems:['none','crm']},{...base,processes:{}},{...base,processes:{...base.processes,transfer:process}},{...base,processes:{reporting:{...process,independent:'true'}}},{...base,processes:{reporting:{...process,cost:{kind:'unknown',hourly:999}}}},{...base,processes:{reporting:{...process,timing:{...timing,periodAssumption:'yes'}}}}])assert.equal(parseCostInput(input),null);
});
for(const [key,values] of [['employees',[0,-1,1.5,5,Infinity]],['repetitions',[-1,1.5,Infinity,NaN]],['minutes',[-1,Infinity,10081]],['periodsPerMonth',[0,32,Infinity]]]){
 test(`timing boundaries: ${key}`,()=>{for(const v of values)assert.equal(parseCostInput({...base,processes:{reporting:{...process,timing:{...timing,[key]:v}}}}),null);});
}
test('cost boundaries reject zero paid hours, non-finite/negative and excessive values',()=>{
 for(const cost of [{kind:'hourly',hourly:-1},{kind:'hourly',hourly:Infinity},{kind:'hourly',hourly:'600'},{kind:'hourly',hourly:1000001},{kind:'monthly',monthly:96000,hours:0,hoursAssumption:true},{kind:'monthly',monthly:96000,hours:745,hoursAssumption:true},{kind:'monthly',monthly:-1,hours:160,hoursAssumption:true}])assert.equal(parseCostInput({...base,processes:{reporting:{...process,cost}}}),null);
});
test('draft accepts decimal comma, preserves selected period and flags unfinished input',()=>{
 assert.equal(build().input.processes.reporting.timing.repetitions,20);
 const input=build({drafts:{reporting:{...draft,minutes:'3,5',hourly:'600,25'}}}).input;assert.equal(input.processes.reporting.timing.minutes,3.5);assert.equal(input.processes.reporting.cost.hourly,600.25);
 for(const patch of [{minutes:''},{repetitions:'1e2'},{minutes:'Infinity'},{employees:'5'},{periods:'32'},{hourly:'-1'}])assert.equal(build({drafts:{reporting:{...draft,...patch}}}).input,null);
 assert.ok(build({drafts:{reporting:emptyCostDraft('4')}}).input);
 assert.equal(build({tasks:[]}).input,null);assert.equal(build({employees:'4.5'}).input,null);
});
test('draft monthly/unknown modes discard inactive hourly data and validate their own inputs',()=>{
 const monthly={...draft,costMode:'monthly',hourly:'999999',monthly:'96000',paidHours:'160'};
 assert.equal(calculateCostWhy(build({drafts:{reporting:monthly}}).input).rows[0].cost,39600);
 assert.equal(build({drafts:{reporting:{...monthly,paidHours:''}}}).input,null);
 const unknown=build({drafts:{reporting:{...monthly,costMode:'unknown'}}}).input;assert.deepEqual(unknown.processes.reporting.cost,{kind:'unknown'});
});
test('editing round trip preserves source values, monthly assumptions and independent status',()=>{
 const input={...base,processes:{reporting:{...process,independent:true,cost:{kind:'monthly',monthly:96000,hours:160,hoursAssumption:true}}}};
 const next=build({drafts:costDrafts(input)}).input;assert.deepEqual(next,input);
 assert.equal(costDrafts(input).reporting.allTeam,false,'imported measurements must not silently scale with a later team change');
});
test('why explanations are conditional and do not prescribe a technology or invent losses',()=>{
 for(const task of Object.keys(taskLabels)){
  const input={...base,tasks:[task],processes:{[task]:process}},why=whyReview(task,input);assert.equal(why.questions.length,2);assert.doesNotMatch(why.reason+why.possibility,/вам нужна разработка|Готовый сервис|потери составляют|гарантированная экономия|настройте API/i);
 }
 assert.match(whyReview('reporting',{...base,processes:{reporting:{...process,timing:null}}}).reason,/не измерено/);
 assert.match(whyReview('reporting',{...base,processes:{reporting:{...process,timing:{...timing,repetitions:0}}}}).reason,/равны нулю/);
});
test('v3 transfer excludes free text/scenarios, expires, rejects future/old format and survives editing',()=>{
 assert.notEqual(COST_STORAGE_KEY,GUIDED_STORAGE_KEY);const raw=encodeCostTransfer({...base,description:'private',scenarioRate:12345},100);
 assert.equal(raw.includes('private'),false);assert.equal(raw.includes('12345'),false);assert.deepEqual(decodeCostTransfer(raw,101),base);assert.equal(decodeCostTransfer(raw,99),null);assert.equal(decodeCostTransfer(raw,86400101),null);
 assert.equal(decodeCostTransfer(encodeGuidedTransfer(costToGuided(base),100),101),null);
});
test('PR9 stable boundary preserves v2 tasks, measurements and storage without importing AI code',()=>{
 const guided=costToGuided(base);assert.equal(guided.measurements.reporting.hourlyCost,600);assert.equal(guided.measurements.reporting.periodsPerMonth,22);assert.deepEqual(decodeGuidedTransfer(encodeGuidedTransfer(guided)),guided);
 const old=guidedToCost(guided);assert.equal(calculateCostWhy(old).rows[0].cost,39600);assert.equal(old.processes.reporting.timing.periodAssumption,false);
 const unknown=guidedToCost({...initialGuided(),tasks:['other']});assert.equal(calculateCostWhy(unknown).rows[0].hours,null);
});
test('lead contract whitelists v3 inputs, recalculates money/year and discards forged results',()=>{
 const context=parseToolContext({tool:'labor-cost',version:COST_VERSION,input:base,result:{cost:999999},plan:'unsafe'});assert.ok(context);assert.equal('result' in context,false);assert.equal('plan' in context,false);
 const text=describeToolContext(context);assert.match(text,/пересчитано сервером/);assert.match(text,/66 ч\/мес/);assert.match(text,/39600 ₽\/мес/);assert.match(text,/475200 ₽\/год/);assert.match(text,/не денежная экономия/);
 assert.match(text,/3 чел × 20\/день × 3 мин × 22 период\/мес/);
 assert.equal(parseToolContext({tool:'labor-cost',version:COST_VERSION,input:{...base,employees:0}}),null);
});
test('max selected processes fit Telegram safely with hostile lead text and all process labels',()=>{
 const tasks=Object.keys(taskLabels);const input={...base,tasks,processes:Object.fromEntries(tasks.map(task=>[task,process]))};
 const context=describeToolContext(parseToolContext({tool:'automation-cost',version:COST_VERSION,input}));
 const message=formatLeadMessage({name:'<'.repeat(100),phone:'&'.repeat(40),company:'&'.repeat(120),direction:'<'.repeat(100),task:'<&>'.repeat(666),page:'/tools/automation-cost',date:'08.11.2026',consentVersion:'v'.repeat(80),attribution:Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','referrer','landingPage'].map(k=>[k,'&'.repeat(100)])),context});
 assert.ok(message.length<=4096,message.length);assert.ok(!message.includes('<script>'));for(const task of tasks)assert.ok(message.includes(taskLabels[task]),task);
});
