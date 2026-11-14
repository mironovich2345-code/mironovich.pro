import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateBusinessMap, validateModel } from "../lib/business-map/calculate.ts";
import { parseBusinessMap } from "../lib/business-map/validation.ts";
import { transferCalculator } from "../lib/business-map/transfer.ts";
import { businessMapModel } from "../config/business-map-model.ts";
import { dec } from "../lib/business-map/decimal.ts";
import { calculateLabor, LABOR_VERSION } from "../lib/tools/labor.ts";
import { calculateQuizLabor, QUIZ_VERSION } from "../lib/tools/quiz-model.ts";
const company = { industry: "IT", headcount: "1-10", goal: "cost", systems: ["crm"], salary: 60000 };
const process = { id: "p1", name: "Отчёты", employees: 3, operations: 10, period: "day", minutes: 12, source: "measured", mechanical: "from50to75", systems: ["crm"], regulation: "yes", exceptions: "from10to30", error: "minor", judgment: "rare", access: "available", personalData: "no", independent: true, overlapsWith: [] };
const costs = { implementation: [80000,120000], training: [0,0], licenses: [3000,3000], maintenance: [0,0], external: [0,0] };
const cash = { disposition: "reduce-contractor", replaceableHours: 10, replacementRate: 700, cancelledPayments: 0 };
const run = (changes = {}, companyChanges = {}) => calculateBusinessMap({ company: { ...company, ...companyChanges }, processes: [{ ...process, ...changes }] });
const row = (changes = {}, companyChanges = {}) => run(changes, companyChanges).processes[0];
const close = (a, b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const vals = (r, key) => r.scenarios.map(s => s[key].value);

test("T1/E1 exact hours, rates, time capacity and separate zero cash", () => {
  const r = row();
  assert.equal(r.hours.value,42); close(r.hourlyRate.value,472.7272727272727); close(r.timeCost.value,19854.545454545456);
  assert.equal(r.timeCost.display,19900);
  assert.deepEqual(vals(r,"freedHours"),[10.29,16.8,25.515]);
  assert.deepEqual(vals(r,"residualHours"),[31.71,25.2,16.485]);
  assert.deepEqual(r.scenarios.map(s=>s.fte.display),[0.062,0.102,0.155]);
  assert.deepEqual(r.scenarios.map(s=>Math.round(s.freedTimeValue.value)),[4864,7942,12062]);
  assert.deepEqual(r.scenarios.map(s=>s.freedTimeValue.display),[4900,7900,12100]);
  assert.ok(r.scenarios.every(s=>s.cashReduction.value===0 && s.payback.status==="not-calculated"));
  assert.equal(r.value,"medium"); assert.equal(r.group,"first");
});
test("T2/E2 confirmed cancellable external hours, no second residual-labor deduction", () => {
  const r = row({cash,costs}); assert.deepEqual(vals(r,"cashReduction"),[7000,7000,7000]);
  assert.deepEqual(r.scenarios.map(s=>s.payback.months.value),[30,25,20]); assert.equal(r.longPayback,true); assert.equal(r.paybackRange.min.display,20); assert.equal(r.paybackRange.max.display,30);
});
test("T3/E3 cash savings are capped by freed hours before rounding", () => {
  const r=row({cash:{...cash,replaceableHours:30},costs});
  assert.deepEqual(vals(r,"cashReduction"),[7203,11760,17860.5]);
  assert.deepEqual(r.scenarios.map(s=>s.payback.months.display),[29,11,5]);
  close(r.scenarios[0].payback.months.value,120000/4203);
});
test("T4/E4 missing and partial costs do not invent payback",()=>{
  assert.ok(row({cash}).scenarios.every(s=>s.payback.status==="not-calculated"));
  const r=row({cash,costs:{licenses:[3000,3000]}});
  assert.ok(r.scenarios.every(s=>s.payback.months===null && s.payback.missing.includes("costs.training")));
});
test("T5/E5 nonpositive net cash does not recover; known O is sufficient",()=>{
  for (const cancelledPayments of [0,2000,3000]) {
    const r=row({cash:{...cash,disposition:"retained",cancelledPayments},costs:{licenses:[3000,3000],maintenance:[0,0],external:[0,0]}});
    assert.ok(r.scenarios.every(s=>s.payback.status==="not-recoverable" && s.payback.months===null));
  }
});
test("T6 category uses unrounded exact FTE even if displayed hours coincide",()=>{
  const a=row({period:"month",operations:82.5,minutes:30}), b=row({period:"month",operations:82.4,minutes:30});
  assert.equal(a.hours.value,41.25); assert.equal(a.scenarios[1].freedHours.value,16.5); assert.equal(a.value,"medium");
  assert.equal(b.value,"low"); assert.equal(b.scenarios[1].freedHours.display,16.5);
});
test("T7/T8 calendar factors are exact and independent of number of employees",()=>{
  const a=row({period:"week",operations:5,minutes:30}); close(a.hours.value,65/6); assert.equal(a.hours.exact,"65/6"); assert.equal(a.hours.display,10.8);
  assert.equal(row({period:"month",operations:8,minutes:45}).hours.value,6);
  assert.equal(row({employees:50}).hours.exact,row({employees:1}).hours.exact);
});
for (const [id,change,group,reason] of [
  ["T9",{operations:null},"insufficient","G1"], ["T10",{mechanical:"unknown"},"insufficient","G2"],
  ["T11",{exceptions:"over50"},"prepare","G3"], ["T12",{systems:["paper","voice"]},"prepare","G4"],
  ["T13",{error:"critical"},"excluded","G5"], ["T14",{error:"serious",judgment:"mostly"},"excluded","G6"],
]) test(`${id}: ${reason} overrides matrix with an explicit reason`,()=>{
  const r=row(change); assert.equal(r.group,group); assert.ok(r.reasons.includes(`R-${reason}`));
  if (reason==="G3") assert.deepEqual(r.scenarios,[]);
});
test("T15 high risk demotes high value/low complexity",()=>{
  const r=row({operations:40,error:"serious",personalData:"yes"}); assert.equal(r.value,"high"); assert.equal(r.complexity.level,"low");
  assert.equal(r.matrixGroup,"first"); assert.equal(r.group,"later"); assert.equal(r.risk.score,3);
});
test("T16 low confidence does not alter numbers; unknown personal data forces low confidence",()=>{
  const a=row(), b=row({source:"unknown",personalData:"unknown"});
  assert.deepEqual(vals(a,"freedHours"),vals(b,"freedHours")); assert.equal(b.confidence,"low"); assert.equal(b.group,"preliminary"); assert.ok(b.missing.includes("personalData"));
  const unknown=row({regulation:"unknown",judgment:"unknown"}); assert.equal(unknown.complexity.score,null); assert.equal(unknown.group,"insufficient");
});
test("T17 deterministic sorting: F then confidence, complexity, risk, name and stable ID",()=>{
  const items=[{...process,id:"b",name:"Бета"},{...process,id:"a",name:"Альфа"},{...process,id:"estimate",source:"estimate"}];
  const r=calculateBusinessMap({company,processes:items}); assert.deepEqual(r.ranking,["a","b","estimate"]);
  assert.deepEqual(r,calculateBusinessMap({company,processes:items}));
  assert.deepEqual(r.ranking,calculateBusinessMap({company,processes:[...items].reverse()}).ranking);
  const varied = [
    {...process,id:"r",error:"noticeable"}, {...process,id:"c",regulation:"partial"},
    {...process,id:"e",source:"estimate"}, {...process,id:"h",operations:11}, {...process,id:"best"},
  ];
  assert.deepEqual(calculateBusinessMap({company,processes:varied}).ranking,["h","best","r","c","e"]);
});
test("T18 missing salary keeps hours and FTE; direct hourly rate is already fully loaded",()=>{
  const r=row({}, {salary:null}); assert.equal(r.timeCost,null); assert.equal(r.hourlyRate,null); assert.equal(r.scenarios[1].freedTimeValue,null);
  assert.equal(r.scenarios[1].freedHours.value,16.8); assert.equal(row({hourlyRate:700},{salary:null}).timeCost.value,29400);
});
test("T19 config version and bit-identical JSON; numeric configuration is injectable",()=>{
  assert.equal(JSON.stringify(run()),JSON.stringify(run())); assert.equal(run().modelVersion,"business-map-v1.1");
  const r=calculateBusinessMap({company,processes:[process]},{...businessMapModel,version:"test-hours",monthlyHours:160});
  assert.equal(r.modelVersion,"test-hours"); assert.equal(r.processes[0].hourlyRate.value,487.5);
  assert.throws(()=>validateModel({...businessMapModel,monthlyHours:0}),RangeError);
});
test("T20 transfer validates originals, ignores forged results and converts per-person volume ONCE",()=>{
  const input={employees:3,operationsPerDay:10,minutesPerOperation:12,workingDays:21,hourlyCost:600,automationPercent:99};
  const transferred=transferCalculator({tool:"labor-cost",version:LABOR_VERSION,input,result:{monthlyHours:99999}});
  assert.equal(transferred.processes[0].operations,30); assert.equal(transferred.processes[0].mechanical,"unknown");
  const r=calculateBusinessMap({company,processes:transferred.processes}).processes[0];
  assert.equal(r.hours.value,calculateLabor(input).monthlyHours); assert.equal(r.timeCost.value,calculateLabor(input).monthlyCost);
});
test("v4 transfer retains actual calendar, team volumes, user hourly cost and discards automation claims",()=>{
  for (const kind of ["salary","employer"]) {
    const input={tasks:["reporting"],month:"2026-11",groupsDistinct:true,independent:["reporting"],groups:[{id:"g1",employees:3,schedule:"other",actualShifts:15,shiftHours:8,pay:{kind,amount:60000},measures:{reporting:{frequency:"shift",repetitions:10,minutes:12}}}]};
    const old=calculateQuizLabor(input);
    const imported=transferCalculator({tool:"labor-cost",version:QUIZ_VERSION,input:{kind:"labor",data:input}});
    const result=calculateBusinessMap({company,processes:imported.processes}).processes[0];
    assert.equal(result.hours.value,old.rows[0].hours); close(result.timeCost.value,old.rows[0].cost); assert.equal(result.hourlyRate.value,500);
  }
});
test("T21 rejects invalid ranges, strings, NaN and non-finite values without mutating input",()=>{
  for (const change of [{operations:-1},{minutes:0},{minutes:1440},{employees:0},{employees:51},{operations:10000,period:"day"},{operations:Infinity},{minutes:NaN},{employees:"3"},{minutesRange:[20,10]},{minutesRange:[1,5]},{overlapsWith:["no-such-id"]},{cash:{...cash,replacementRate:-1}},{costs:{licenses:[5,1]}},{mechanical:"toString"}]) {
    const raw={company,processes:[{...process,...change}]}; const before=structuredClone(raw);
    assert.equal(parseBusinessMap(raw).ok,false,JSON.stringify(change)); assert.throws(()=>calculateBusinessMap(raw),RangeError); assert.deepEqual(raw,before);
  }
});
test("unknown properties including client results are discarded at every object boundary",()=>{
  const parsed=parseBusinessMap({company:{...company,secret:"x"},processes:[{...process,result:{cashReduction:999},cash:{...cash,forged:true},costs:{...costs,hidden:[1,2]}}],result:999});
  assert.equal(parsed.ok,true); assert.equal(JSON.stringify(parsed.value).includes("secret"),false); assert.equal(JSON.stringify(parsed.value).includes("forged"),false); assert.equal(JSON.stringify(parsed.value).includes("hidden"),false);
});
test("overlapping or unconfirmed processes have no combined totals; asymmetry still blocks summation",()=>{
  const p2={...process,id:"p2",name:"Other"};
  for (const p1 of [{...process,overlapsWith:["p2"]},{...process,independent:false}]) {
    const r=calculateBusinessMap({company,processes:[p1,p2]}); assert.equal(r.totals,null); assert.ok(r.totalBlockers.includes("OVERLAP-OR-UNCONFIRMED-INDEPENDENCE"));
  }
  assert.equal(calculateBusinessMap({company,processes:[process,p2]}).totals.hours.value,84);
});
test("scenario range, zero quantities, zero costs and override working hours",()=>{
  const r=row({minutesRange:[10,15],cash,costs:{implementation:[0,0],training:[0,0],licenses:[0,0],maintenance:[0,0],external:[0,0]}});
  assert.deepEqual(vals(r,"hours"),[35,42,52.5]); assert.equal(r.scenarios[1].payback.months.value,0);
  assert.ok(row({operations:0}).scenarios.every(s=>s.freedHours.value===0));
  assert.equal(row({}, {monthlyHours:160,salaryLoad:1}).hourlyRate.value,375);
  assert.ok(row({employees:1,minutes:600,operations:100}).flags.includes("W-CAPACITY"));
});
test("limits, all gates preserved, exclusions cannot become recommended or fallback",()=>{
  assert.equal(parseBusinessMap({company,processes:[]}).ok,false);
  assert.equal(parseBusinessMap({company,processes:Array.from({length:6},(_,i)=>({...process,id:String(i)}))}).ok,false);
  const r=run({error:"critical",systems:["paper"],mechanical:"unknown"});
  assert.equal(r.recommendedId,null); assert.equal(r.fallbackId,null); assert.deepEqual(r.ranking,[]);
  assert.ok(["R-G2","R-G4","R-G5"].every(k=>r.processes[0].reasons.includes(k)));
});
test("decimal half-up rounds at display only, repeating fractions retain exact value",()=>{
  assert.equal(dec("1.005").round(0.01),1.01); assert.equal(dec(100500).round(1000),101000);
  assert.equal(dec("0.1").add(dec("0.2")).exact(),"3/10");
  assert.equal(dec(52).div(12).mul(12).number(),52);
});

test("all nine value/complexity matrix cells match specification",()=>{
  const expected = {high:["first","first","later"],medium:["first","later","not-now"],low:["later","not-now","not-now"]};
  for (const [value, operations] of [["low",5],["medium",10],["high",40]]) {
    for (const [i, changes] of [
      {regulation:"yes",access:"available",judgment:"rare",systems:["crm"]},
      {regulation:"no",access:"manual",judgment:"rare",systems:["crm"]},
      {regulation:"no",access:"manual",judgment:"sometimes",systems:["crm","erp","mail"]},
    ].entries()) {
      const r=row({...changes,operations}); assert.equal(r.value,value); assert.equal(r.complexity.level,["low","medium","high"][i]); assert.equal(r.matrixGroup,expected[value][i]); assert.equal(r.group,expected[value][i]);
    }
  }
});
test("confidence follows source and unknown counts; suitability never creates an automation percentage",()=>{
  assert.equal(row({source:"estimate"}).confidence,"medium");
  assert.equal(row({operations:null}).confidence,"low");
  assert.equal(row({source:"measured",access:"unknown"}).confidence,"low");
  assert.equal(row({source:"estimate",access:"unknown"}).confidence,"medium");
  assert.equal(row({source:"estimate",access:"unknown",regulation:"unknown"}).confidence,"low");
  assert.equal(row({access:"unknown"}).scenarios[1].freedHours.value,16.8);
});
test("Russian alphabetical tie-break puts Ё between Е and Ж; IDs break identical names",()=>{
  const r=calculateBusinessMap({company,processes:[{...process,id:"z",name:"Журнал"},{...process,id:"e",name:"Единица"},{...process,id:"yo",name:"Ёлка"}]});
  assert.deepEqual(r.ranking,["e","yo","z"]);
});
test("small finite decimals never create NaN; exact rational survives serialization",()=>{
  const r=row({operations:1e-310,hourlyRate:1e-310});
  assert.ok(!JSON.stringify(r).includes('"value":null'));
  assert.equal(Number.isFinite(r.scenarios[1].freedTimeValue.value),true);
  assert.equal(r.scenarios[1].freedTimeValue.value,0);
  assert.equal(dec("1e-310").mul(dec("1e-310")).mul(dec("1e300")).number(),1e-320);
});
test("imported actual working hours control capacity; mixed salary/employer bases never sum money",()=>{
  const group={id:"g1",employees:1,schedule:"other",actualShifts:1,shiftHours:8,pay:{kind:"salary",amount:60000},measures:{reporting:{frequency:"month",repetitions:20,minutes:60}}};
  const input={tasks:["reporting"],month:"2026-11",groupsDistinct:true,independent:["reporting"],groups:[group]};
  const imported=transferCalculator({tool:"labor-cost",version:QUIZ_VERSION,input:{kind:"labor",data:input}});
  const r=calculateBusinessMap({company,processes:imported.processes});
  assert.equal(imported.processes[0].monthlyHours,8); assert.ok(r.processes[0].flags.includes("W-CAPACITY")); assert.equal(r.totals,null);
  const p1={...process,rateSource:"calculator-salary",monthlyHours:120},p2={...process,id:"p2",rateSource:"calculator-employer"};
  const mixed=calculateBusinessMap({company,processes:[p1,p2]}); assert.equal(mixed.totals.hours.value,84); assert.equal(mixed.totals.timeCost,null); assert.ok(mixed.totalBlockers.includes("MIXED-COST-BASES"));
});
test("all m/e buckets conserve time, stay bounded and maintain scenario order",()=>{
  for (const mechanical of ["under25","from25to50","from50to75","over75"]) {
    for (const exceptions of ["under10","from10to30","from30to50"]) {
      const r=row({mechanical,exceptions,cash:{...cash,replaceableHours:30}});
      let previous=-1;
      for (const s of r.scenarios) {
        assert.ok(s.freedHours.value>=0 && s.freedHours.value<=s.hours.value);
        close(s.freedHours.value+s.residualHours.value,s.hours.value);
        assert.ok(s.freedHours.value>=previous); previous=s.freedHours.value;
        assert.ok(s.cashReduction.value<=30*700); assert.ok(s.cashReduction.value<=s.freedHours.value*700+1e-8);
      }
    }
  }
});
test("unrepresentable aggregate payback is rejected rather than serialized as Infinity/null",()=>{
  const zeroCosts={implementation:[1e9,1e9],training:[0,0],licenses:[0,0],maintenance:[0,0],external:[0,0]};
  assert.throws(()=>row({cash:{...cash,replacementRate:1e-310},costs:zeroCosts}),/слишком велик/);
});

// A capacity warning alone used to leave the matrix first-priority recommendation intact.
test("W-CAPACITY never recommends first; exact fund boundary remains eligible",()=>{
  const over=run({employees:1,operations:831,period:"month",minutes:12});
  const r=over.processes[0];
  assert.equal(r.matrixGroup,"first"); assert.equal(r.confidence,"low");
  assert.equal(r.group,"preliminary"); assert.equal(over.recommendedId,null);
  assert.ok(r.reasons.includes("R-CAPACITY")); assert.ok(r.missing.includes("workloadCapacity"));
  assert.equal(r.hours.value,166.2); assert.equal(r.scenarios[1].freedHours.value,66.48);
  const boundary=run({employees:1,operations:825,period:"month",minutes:12});
  assert.equal(boundary.processes[0].hours.value,165);
  assert.equal(boundary.processes[0].confidence,"high"); assert.equal(boundary.recommendedId,"p1");
});
