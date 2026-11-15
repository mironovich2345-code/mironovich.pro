/** OWNER-ONLY optional live acceptance. No deploy or Railway calls. Never prints text/secrets.
 * Run only with a separate, limited OpenAI project and synthetic data (see live-ai-checklist.md).
 * Three sequential provider calls; exercises the real handler/orchestrator, not the Railway edge.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createChatHandler } from '../lib/business-map/dialog/chat-handler.ts';
import { initialConversation, addScenarios, focusProcess, offerInterpretation, acceptInterpretation, insight } from '../lib/business-map/dialog/engine.ts';

if (process.env.BUSINESS_MAP_LIVE_ACCEPTANCE !== 'synthetic-only-dedicated-project'
    || !process.env.OPENAI_API_KEY?.trim() || !process.env.BUSINESS_MAP_AI_MODEL?.trim()) {
  console.error('NOT RUN: a dedicated limited project, explicit synthetic-only opt-in, key and model are required. See live-ai-checklist.md.');
  process.exit(2);
}
const env = {
  NODE_ENV:'production', RAILWAY_ENVIRONMENT_NAME:'preview', BUSINESS_MAP_PROTOTYPE:'1', SITE_NOINDEX:'1',
  BUSINESS_MAP_AI_ENABLED:'1', BUSINESS_MAP_AI_MODEL:process.env.BUSINESS_MAP_AI_MODEL,
  OPENAI_API_KEY:process.env.OPENAI_API_KEY,
  BUSINESS_MAP_PREVIEW_USERNAME:randomBytes(12).toString('hex'),
  BUSINESS_MAP_PREVIEW_PASSWORD:randomBytes(32).toString('base64url'),
};
const cases = [
  {name:'A-free-description',intent:'interpret',scenarioId:null,question:null,message:'У меня три фитнес-клуба. Менеджеры работают в Craft, руководители ежедневно собирают отчёты вручную, а часть заявок из разных каналов остаётся без внимания'},
  {name:'C-per-person',intent:'interpret',scenarioId:'reporting',question:'volume',message:'Четыре операции в день на одного сотрудника. Десять сотрудников. Двенадцать минут на операцию.'},
  {name:'F-qualitative-plan',intent:'advise',scenarioId:'reporting',question:null,message:'Синтетический пример: руководитель вручную собирает отчёт. Сначала рассмотрите порядок работы и возможности существующей программы. Подготовьте проверяемый план без финансовых обещаний.'},
];
const report={mode:'LIVE official OpenAI; synthetic fixtures; local in-process handler; NOT Railway HTTP or usability acceptance',model:env.BUSINESS_MAP_AI_MODEL,startedAt:new Date().toISOString(),cases:[],passed:false};
let providerMeta=null;
const handler=createChatHandler({env:()=>env,fetcher:async(url,init)=>{
  const started=performance.now();
  const response=await fetch(url,init);
  providerMeta={httpStatus:response.status,usage:null};
  try {
    const raw=await response.clone().json();
    const usage=raw?.usage;
    if(usage && ['input_tokens','output_tokens','total_tokens'].every(k=>Number.isSafeInteger(usage[k])&&usage[k]>=0))
      providerMeta.usage=Object.fromEntries(['input_tokens','output_tokens','total_tokens'].map(k=>[k,usage[k]]));
  } catch { /* no raw body/error/text is emitted */ }
  providerMeta.elapsedMs=Math.round(performance.now()-started);
  return response;
}});
try {
  for(const fixture of cases){
    providerMeta=null;
    const started=performance.now();
    const response=await handler(new Request('https://local.invalid/api/business-map/chat',{
      method:'POST',headers:{'content-type':'application/json',origin:'https://local.invalid',
        authorization:'Basic '+Buffer.from(`${env.BUSINESS_MAP_PREVIEW_USERNAME}:${env.BUSINESS_MAP_PREVIEW_PASSWORD}`).toString('base64')},
      body:JSON.stringify({requestId:randomUUID(),intent:fixture.intent,message:fixture.message,industry:'fitness',
        scenarioId:fixture.scenarioId,facts:[],question:fixture.question,risk:'unknown'}),
    }));
    const data=await response.json();
    const row={name:fixture.name,httpStatus:response.status,elapsedMs:Math.round(performance.now()-started),
      provider:providerMeta,code:data.ok?'validated':data.code,accepted:false};
    report.cases.push(row);
    if(!response.ok||!data.ok)break; // No retry and no further paid calls after failure.
    if(fixture.name==='A-free-description'){
      assert.equal(data.interpretation.industry,'fitness');
      assert.equal(data.interpretation.locations,3);
      assert.ok(data.interpretation.systems.some(s=>s.evidence.includes('Craft')));
      for(const id of ['reporting','missed-leads'])assert.ok(data.interpretation.hypotheses.some(h=>h.scenarioId===id));
      for(const workload of data.interpretation.workloads)
        for(const field of ['employees','operations','minutes'])assert.equal(workload[field],null);
    }else if(fixture.name==='C-per-person'){
      const w=data.interpretation.workloads.find(w=>w.scenarioId==='reporting');
      assert.ok(w);assert.equal(w.operations,4);assert.equal(w.employees,10);assert.equal(w.minutes,12);assert.equal(w.scope,'per-person');
      const state=acceptInterpretation(offerInterpretation(focusProcess(addScenarios(initialConversation(),['reporting']),'process-reporting'),data.interpretation));
      assert.equal(insight(state.processes[0],null).hours.exact,'168/1');
      assert.equal(insight(state.processes[0],null).timeCost,null);
    }else assert.ok(['organize','existing','wait'].includes(data.advice.approach));
    assert.ok(providerMeta?.usage,'Actual token usage is required for live acceptance');
    row.accepted=true;
  }
  report.passed=report.cases.length===cases.length&&report.cases.every(c=>c.accepted);
}catch{report.failure='Acceptance assertion/transport failed; inspect synthetic dialogue manually. Raw content intentionally omitted.';}
await writeFile(process.env.BUSINESS_MAP_LIVE_REPORT??'docs/products/business-map/ai-dialog/acceptance/live-ai-check.json',JSON.stringify(report,null,2)+'\n');
console.log(`Live synthetic acceptance: ${report.passed?'passed':'NOT ACCEPTED'}; ${report.cases.length} attempts. No secrets or dialogue text in report.`);
if(!report.passed)process.exitCode=1;
