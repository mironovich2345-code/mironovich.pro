#!/usr/bin/env node
// Content quality gate for AI Career v3. No external dependencies, production APIs or PII.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const errors = [];
const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);

function schemaCheck(rule, value, loc, issues=[]) {
  if (rule.anyOf) {
    if (!rule.anyOf.some(candidate => {
      const trial = []; schemaCheck(candidate,value,loc,trial); return trial.length===0;
    })) issues.push(loc + ": no valid anyOf branch");
    return issues;
  }
  const type=rule.type;
  if (type==="null"&&value!==null) issues.push(loc+": expected null");
  if (type==="boolean"&&typeof value!=="boolean") issues.push(loc+": expected boolean");
  if (type==="integer"&&!Number.isInteger(value)) issues.push(loc+": expected integer");
  if (type==="string"&&typeof value!=="string") issues.push(loc+": expected string");
  if (type==="array"&&!Array.isArray(value)) issues.push(loc+": expected array");
  if (type==="object"&&!isObject(value)) issues.push(loc+": expected object");
  if (rule.const!==undefined&&value!==rule.const) issues.push(loc+": bad constant");
  if (rule.enum&&!rule.enum.includes(value)) issues.push(loc+": invalid enum");
  if (type==="string"&&typeof value==="string") {
    if (rule.minLength!==undefined && value.trim().length<rule.minLength)
      issues.push(loc+": too short");
    if (rule.pattern && !new RegExp(rule.pattern).test(value))
      issues.push(loc+": invalid pattern");
    if (rule.format==="date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(value+"T00:00:00.000Z").toISOString().slice(0,10)!==value))
      issues.push(loc+": bad date");
  }
  if (type==="integer"&&typeof value==="number") {
    if (rule.minimum!==undefined&&value<rule.minimum) issues.push(loc+": below minimum");
    if (rule.maximum!==undefined&&value>rule.maximum) issues.push(loc+": above maximum");
  }
  if (type==="array"&&Array.isArray(value)) {
    if (rule.minItems!==undefined&&value.length<rule.minItems)
      issues.push(loc+": missing required items");
    if (rule.items) value.forEach((item,i)=>schemaCheck(rule.items,item,loc+"["+i+"]",issues));
  }
  if (type==="object"&&isObject(value)) {
    for (const key of rule.required || [])
      if (!Object.hasOwn(value,key)) issues.push(loc+"."+key+": missing");
    for (const [key,val] of Object.entries(value)) {
      if (!(key in (rule.properties||{}))) {
        if (rule.additionalProperties===false) issues.push(loc+"."+key+": unknown property");
      } else schemaCheck(rule.properties[key],val,loc+"."+key,issues);
    }
  }
  return issues;
}

export function validateCatalog(catalog, role, lesson, step, lessonSchema, stepSchema) {
  const e=[];
  const good=(value,msg)=>{if(!value)e.push(msg);};
  const modules=catalog.modules||[],slots=catalog.slots||[];
  good(catalog.usableForPaidUser===false,"MVP catalog must not claim readiness");
  good(modules.length===5,"expected all five product modules");
  good(new Set(modules.map(m=>m.id)).size===modules.length,"duplicate module IDs");
  good(slots.length>=20,"fewer than 20 lesson slots");
  good(new Set(slots.map(s=>s.id)).size===slots.length,"duplicate lesson slot IDs");
  for(const m of modules) {
    good(typeof m.purpose==="string"&&m.purpose.length>=35,"module purpose missing: "+m.id);
    good(typeof m.outcome==="string"&&m.outcome.length>=20,"module outcome missing: "+m.id);
    good(slots.filter(s=>s.moduleId===m.id).length>=3,"module needs at least three slots: "+m.id);
  }
  for(const s of slots) {
    good(modules.some(m=>m.id===s.moduleId),"unknown module in slot "+s.id);
    good(s.status==="planned"&&s.publishedLessonId===null,
      "unreviewed slots cannot be advertised as published: "+s.id);
    if(s.scenarioId!==null)good(role.scenarios.some(x=>x.id===s.scenarioId),
      "unknown role scenario: "+s.id);
  }
  const mapped=slots.filter(s=>s.scenarioId!==null).map(s=>s.scenarioId);
  good(mapped.length===7&&new Set(mapped).size===7,"seven unique sales scenarios are required");
  for(const x of role.scenarios)good(mapped.includes(x.id),"missing scenario slot "+x.id);
  good(catalog.selectionPolicy.onlyApprovedLessons===true,"no approved lesson gate");
  good(catalog.selectionPolicy.safetyMustComeFirst===true,"safety cannot be optional");
  good(catalog.selectionPolicy.doNotInferMissingContent===true,"cannot invent missing lessons");

  schemaCheck(lessonSchema,lesson,"lesson",e);
  schemaCheck(stepSchema,step,"step",e);
  good(lesson.status!=="prototype"||!lesson.quality.canBePublished,
      "prototype lesson must remain unpublished");
  good(lesson.status!=="prototype"||lesson.quality.reviewedOn===null,
      "prototype cannot claim complete review");
  good(lesson.audience.roleIds.includes(role.roleId),"lesson must match sales role");
  good(lesson.audience.taskIds.every(id=>role.tasks.some(t=>t.id===id)),"unknown task in lesson");
  good(lesson.audience.scenarioId===null ||
    role.scenarios.some(x=>x.id===lesson.audience.scenarioId),
    "unknown scenario in lesson");
  good(lesson.security.allowEmployerData===false,"employer data must be prohibited in prototype");
  good(lesson.security.requireHumanReview===true,"human review must be mandatory");
  const ids=arr=>new Set(arr.map(x=>x.id));
  const content=lesson.content;
  const idGroups=["workedExamples","procedure","templates","exercises","quiz"];
  for(const section of idGroups) {
    const arr=content[section]||[];
    good(ids(arr).size===arr.length,"duplicate IDs in "+section);
  }
  for(const q of content.quiz||[]) {
    good(new Set(q.options.map(x=>x.id)).size===q.options.length,"duplicate quiz option "+q.id);
    good(q.options.some(x=>x.id===q.correctId),"quiz lacks correct choice "+q.id);
  }
  good(step.lessonId===lesson.id,"step references missing lesson");
  good(ids(content.exercises||[]).has(step.exerciseId),"step references missing exercise");
  good(ids(content.templates||[]).has(step.templateId),"step references missing template");
  good(step.linkedTaskId===null||role.tasks.some(x=>x.id===step.linkedTaskId),
    "step references nonexistent sales task");
  good(step.metricId===null||role.metrics.some(x=>x.id===step.metricId),
    "step references nonexistent metric");
  good(step.isCalendarDay===false,"plan steps must not be converted into calendar days");
  good(step.position===1&&step.stepId==="STEP-01","example step must keep canonical ID");
  good(!lesson.sourcePolicy.factualClaimsChecked||lesson.quality.reviewedOn!==null,
    "claimed fact-check needs completed review");
  good(!lesson.sourcePolicy.timeSensitive || lesson.sourcePolicy.nextReviewOn!==null,
    "trend articles need next review deadline");
  good(!lesson.quality.canBePublished||(
    lesson.status==="approved" && lesson.quality.reviewedOn!==null &&
    lesson.sourcePolicy.factualClaimsChecked===true &&
    lesson.downloads.length>=1 && lesson.downloads.every(x=>
      typeof x.repositoryPath==="string" && !x.repositoryPath.includes("..") &&
      existsSync(new URL("../../"+x.repositoryPath, import.meta.url)))
  ),"published lesson requires approvals, sources and resources");

  return e;
}


// ------------------------------------------------------------------ real lessons (#42+)
const REVIEW_STATES=["draft","review"];
export function validateLesson(lesson, role, lessonSchema, exists=(p)=>existsSync(new URL("../../"+p, import.meta.url))) {
  const e=[];
  const good=(value,msg)=>{if(!value)e.push(lesson.id+": "+msg);};
  schemaCheck(lessonSchema,lesson,lesson.id||"lesson",e);
  if(e.length) return e;
  good(lesson.audience.roleIds.includes(role.roleId),"lesson must match sales role");
  good(lesson.audience.taskIds.every(id=>role.tasks.some(t=>t.id===id)),"unknown task in lesson");
  good(lesson.audience.subtypeIds.every(id=>role.subtypes.some(t=>t.id===id)),"unknown subtype in lesson");
  good(lesson.audience.scenarioId===null||role.scenarios.some(x=>x.id===lesson.audience.scenarioId),"unknown scenario in lesson");
  good(lesson.security.allowEmployerData===false,"employer data must stay prohibited until a reviewed policy exists");
  good(lesson.security.requireHumanReview===true,"human review must be mandatory");
  const ids=arr=>new Set(arr.map(x=>x.id));
  for(const section of ["workedExamples","procedure","templates","exercises","quiz"]) {
    const arr=lesson.content[section];
    good(ids(arr).size===arr.length,"duplicate IDs in "+section);
  }
  for(const q of lesson.content.quiz) {
    good(new Set(q.options.map(x=>x.id)).size===q.options.length,"duplicate quiz option "+q.id);
    good(q.options.some(x=>x.id===q.correctId),"quiz lacks correct choice "+q.id);
  }
  for(const d of lesson.downloads)
    good(!d.repositoryPath.includes("..")&&exists(d.repositoryPath),"download file missing: "+d.repositoryPath);
  good(new Set(lesson.downloads.map(d=>d.id)).size===lesson.downloads.length,"duplicate download IDs");
  good(lesson.sources.length>=1,"lesson needs dated sources");
  if(REVIEW_STATES.includes(lesson.status)) {
    good(lesson.quality.canBePublished===false,"unreviewed lesson cannot be published");
    good(lesson.quality.reviewedOn===null,"unreviewed lesson cannot claim a completed review");
  }
  good(lesson.status!=="prototype","real lessons must not use the prototype status");
  good(!lesson.sourcePolicy.factualClaimsChecked||lesson.quality.reviewedOn!==null,"claimed fact-check needs completed review");
  good(!lesson.sourcePolicy.timeSensitive||lesson.sourcePolicy.nextReviewOn!==null,"time-sensitive lesson needs next review date");
  good(!lesson.quality.canBePublished||(lesson.status==="approved"&&lesson.quality.reviewedOn!==null&&
    lesson.sourcePolicy.factualClaimsChecked===true&&lesson.downloads.length>=1),"published lesson requires approvals, sources and resources");
  return e;
}

export function validateSafetyModule(lessons, catalog, registry) {
  const e=[];
  const good=(value,msg)=>{if(!value)e.push("safety module: "+msg);};
  const slots=catalog.slots.filter(s=>s.moduleId==="safety");
  good(lessons.length===slots.length,"every safety slot needs a lesson");
  for(const s of slots) good(lessons.some(l=>l.id===s.draftLessonId&&l.id===s.id),"slot "+s.id+" must point to its draft lesson");
  for(const l of lessons) good(l.moduleId==="safety","lesson "+l.id+" is not in the safety module");
  const all=k=>lessons.flatMap(l=>l.content[k]);
  for(const k of ["workedExamples","procedure","templates","exercises","quiz"])
    good(new Set(all(k).map(x=>x.id)).size===all(k).length,"IDs in "+k+" must be unique across the module");
  good(all("workedExamples").length>=7,"at least seven worked cases");
  good(all("exercises").length>=4,"at least four practice tasks");
  good(all("quiz").length>=10,"at least ten test questions");
  good(all("templates").filter(t=>t.kind==="prompt").length>=5,"five ready prompts");
  good(all("templates").some(t=>t.kind==="checklist"),"a safety checklist");
  good(all("templates").some(t=>t.kind==="script"),"a request template for the manager");
  const correct=all("quiz").map(q=>q.correctId);
  good(new Set(correct).size>=3,"correct answers must not all sit in the same position");
  const known=new Map(registry.sources.map(s=>[s.id,s]));
  for(const l of lessons) for(const s of l.sources) {
    const r=known.get(s.id);
    good(r&&r.url===s.url&&r.checkedOn===s.checkedOn,"source "+s.id+" in "+l.id+" must match sources.json");
    good(r&&["confirmed","partially_confirmed"].includes(r.status),"source "+s.id+" is not confirmed");
  }
  return e;
}

if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const catalog=json("../../content/career/v3/curriculum.json");
  const role=json("../../content/career/v3/roles/sales-manager.json");
  const lesson=json("../../content/career/v3/examples/safety-lesson.prototype.json");
  const step=json("../../content/career/v3/examples/plan-step.prototype.json");
  const lessonSchema=json("../../content/career/v3/schemas/lesson.schema.json");
  const stepSchema=json("../../content/career/v3/schemas/plan-step.schema.json");
  errors.push(...validateCatalog(catalog,role,lesson,step,lessonSchema,stepSchema));
  const safety=["SAF-01","SAF-02","SAF-03","SAF-04"].map(id=>json("../../content/career/v3/lessons/"+id+".json"));
  for(const l of safety) errors.push(...validateLesson(l,role,lessonSchema));
  errors.push(...validateSafetyModule(safety,catalog,json("../../content/career/v3/materials/safety/sources.json")));
  if(errors.length) {
    for(const issue of errors)console.error("FAIL content: "+issue);
    process.exitCode=1;
  } else {
    console.log("PASS: five modules; "+catalog.slots.length+" planned slots; seven mapped sales scenarios");
    console.log("PASS: lesson structure, safety, human review, exercise, quiz and step references");
    console.log("PASS: safety module SAF-01..04 — structure, links, downloads, sources");
    console.log("NOT FOR SALE: lessons are drafts in review, not approved teaching materials");
  }
}
