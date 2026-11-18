import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const diagnostic=JSON.parse(readFileSync("content/career/v3/diagnostic-sales.json","utf8"));
const role=JSON.parse(readFileSync("content/career/v3/roles/sales-manager.json","utf8"));
const spec=readFileSync("docs/products/ai-career-v3/diagnostic-sales.md","utf8");
const primary=diagnostic.primaryQuestions;
const optional=diagnostic.followUps;
const known=new Set(primary.map(q=>q.id));
const allowedEffects=new Set(["roleSubtypes","taskCandidates","taskRanking","lessonOrdering","lessonLevel","metricSelection",
  "impactStory","safetyMode","humanApproval","riskControls","toolAvailability","learningPace","goal"]);

test("exactly eighteen primary questions and no more than two conditional followups",()=>{
  assert.equal(primary.length,18);
  assert.equal(optional.length,2);
  assert.equal(diagnostic.maxTotalQuestions,20);
  assert.equal(diagnostic.noFreeText,true);
  assert.equal(diagnostic.status,"content_design_only_no_public_ui");
  assert.deepEqual(primary.map(q=>q.id),Array.from({length:18},(_,i)=>"Q"+String(i+1).padStart(2,"0")));
  assert.deepEqual(optional.map(q=>q.id),["F01","F02"]);
});

test("every qualifying question is understandable and changes a concrete product outcome",()=>{
  for(const q of [...primary,...optional]){
    assert.ok(q.prompt.length>30,q.id+" question too terse");
    assert.ok(q.help.length>65,q.id+" needs a clear explanation");
    assert.ok(q.why.length>60,q.id+" should explain why");
    assert.ok(q.affects.length>0&&q.affects.every(x=>allowedEffects.has(x)),q.id+" has unknown effects");
    assert.ok(["single","multi","matrix_task_multi"].includes(q.kind),q.id+" bad kind");
    assert.ok(Array.isArray(q.options),q.id+" missing options");
    if(q.kind!=="matrix_task_multi"){
      assert.ok(q.options.length>=3,q.id+" too few choices");
      assert.equal(new Set(q.options.map(o=>o.value)).size,q.options.length,q.id+" duplicated option IDs");
      for(const o of q.options)assert.ok(o.label.length>=9,q.id+" truncated choice");
    }else{
      assert.deepEqual(q.options,[],q.id+" dynamic list must not be hard-coded");
      assert.ok(q.maxVisible<=10,q.id+" has too many displayed task options");
      assert.ok(q.maxSelected<=3,q.id+" has too many chosen tasks");
    }
    assert.ok(!["text","textarea","file"].includes(q.kind),q.id+" cannot collect freeform employer data");
    if(q.kind==="multi")assert.ok(q.maxSelected<=4&&q.minSelected===1,q.id+" selection limits");
    if(q.exclusiveOptions)assert.ok(q.exclusiveOptions.every(x=>q.options.some(o=>o.value===x)),q.id+" invalid exclusive option");
  }
});

test("conditional questions have valid triggers and remain within 20 total",()=>{
  for(const q of optional){
    assert.ok(known.has(q.showWhen?.questionId),q.id+" missing primary condition");
    const main=primary.find(p=>p.id===q.showWhen.questionId);
    assert.ok(q.showWhen.valueIn.every(x=>main.options.some(opt=>opt.value===x)),q.id+" invalid trigger");
  }
  const subtype=primary.find(q=>q.id==="Q01");
  assert.deepEqual(subtype.options.filter(o=>o.value!=="mixed").map(o=>o.value).sort(),
    role.subtypes.map(s=>s.id).sort());
});

test("dynamic task shortlist maps all existing stages to user-friendly work areas",()=>{
  const opts=diagnostic.optionsSourceRules.matrix_task_multi;
  assert.ok(opts.showMax<=10&&opts.selectedMax<=3);
  assert.equal(opts.stageFilterQuestion,"Q03");
  assert.equal(opts.subtypeQuestion,"Q01");
  const stageOptions=new Set(primary.find(q=>q.id==="Q03").options.map(o=>o.value));
  assert.deepEqual(Object.keys(opts.areaStageAliases).sort(),[...stageOptions].sort());
  const coveredStages=new Set(Object.values(opts.areaStageAliases).flat());
  assert.ok(role.tasks.every(t=>coveredStages.has(t.stage)),"some sales tasks cannot be selected");
  for(const task of role.tasks) {
    const matchedSub=role.subtypes.some(s=>
      task.subtypeIds.includes(s.id)&&opts.roleFilters[s.id].includes(s.id));
    assert.ok(matchedSub,task.id+" cannot be shown for its own subtype");
  }
  assert.match(opts.fallback,/учебн/);
  assert.match(opts.invalidatedAnswers,/перепроверить/);
});

test("all safety and personalization gates are explicit; no output is presented as real AI",()=>{
  assert.equal(diagnostic.safetyRules.length,5);
  const safety=JSON.stringify(diagnostic.safetyRules);
  assert.match(safety,/prohibited,unknown,general_only/);
  assert.match(safety,/personal,transcripts/);
  assert.match(safety,/human review mandatory/);
  assert.match(safety,/Never infer job loss probability/);
  assert.ok(diagnostic.selectionRules.length>=8);
  assert.match(spec,/не готовый генератор/);
  assert.match(spec,/не спрашивать у человека данные работодателя/);
  assert.doesNotMatch(spec,/[0-9]+% вероятност[ьи] увольнения/i);
});

test("contrasting demo personas include meaningful safety and outcome differences",()=>{
  assert.equal(diagnostic.sampleProfiles.length,3);
  const ids=new Set(diagnostic.sampleProfiles.map(p=>p.id));
  assert.equal(ids.size,3);
  assert.ok(diagnostic.sampleProfiles.some(p=>p.answers.Q12==="unknown"));
  assert.ok(diagnostic.sampleProfiles.some(p=>p.answers.Q12==="prohibited"));
  assert.ok(diagnostic.sampleProfiles.some(p=>p.answers.Q12==="approved_specific"));
  for(const p of diagnostic.sampleProfiles){
    assert.ok(role.subtypes.some(s=>s.id===p.answers.Q01));
    assert.ok(p.expected.length>85,p.id+" lacks observable expectations");
  }
});
