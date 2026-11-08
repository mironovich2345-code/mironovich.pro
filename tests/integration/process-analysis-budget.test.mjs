import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { PostgresAnalysisBudget } from "../../lib/tools/process-analysis-budget.ts";
import { processAnalysisPolicy as policy } from "../../config/process-analysis.ts";

const connectionString=process.env.PROCESS_ANALYSIS_TEST_DATABASE_URL;
if(!connectionString || !["localhost","127.0.0.1","[::1]"].includes(new URL(connectionString).hostname))throw Error("An explicit loopback-only disposable test database is required");
const schema="analysis_test_"+randomUUID().replaceAll("-","");
const admin=new Pool({connectionString});
const options={connectionString,options:`-c search_path=${schema}`,max:8,connectionTimeoutMillis:1000,query_timeout:2000};

test("shared durable PostgreSQL budget: replicas, races, restart, failure and limits",async t=>{
 await admin.query(`CREATE SCHEMA ${schema}`);
 const a=new Pool(options),b=new Pool(options);
 try{
  await a.query(await readFile(new URL("../../docs/tools/process-analysis-budget.sql",import.meta.url),"utf8"));
  async function funded(patch={}){
   const row={id:randomUUID(),enabled:true,model:policy.model,maxRequests:50,maxMicroUsd:policy.reservationMicroUsd*50,...patch};
   await a.query(`INSERT INTO process_analysis_budgets(id,enabled,model,starts_at,ends_at,reservation_micro_usd,max_requests,max_micro_usd) VALUES($1,$2,$3,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',$4,$5,$6)`,[row.id,row.enabled,row.model,policy.reservationMicroUsd,row.maxRequests,row.maxMicroUsd]);return row.id;
  }
  await t.test("parallel replicas cannot overspend a single reservation",async()=>{
   const id=await funded({maxMicroUsd:policy.reservationMicroUsd});const replicas=[new PostgresAnalysisBudget(a,id),new PostgresAnalysisBudget(b,id)];
   const attempts=await Promise.all(Array.from({length:20},(_,i)=>replicas[i%2].reserve()));assert.equal(attempts.filter(x=>x.ok).length,1);
   const first=attempts.find(x=>x.ok);await replicas[0].finish(first.id,"completed",{inputTokens:2300,outputTokens:950});
   assert.equal((await replicas[1].reserve()).ok,false);
   const {rows:[row]}=await a.query("SELECT used_requests,reserved_micro_usd FROM process_analysis_budgets WHERE id=$1",[id]);assert.equal(row.used_requests,1);assert.equal(Number(row.reserved_micro_usd),policy.reservationMicroUsd);
  });
  await t.test("concurrency is global; release does not refund spend",async()=>{
   const id=await funded();const x=new PostgresAnalysisBudget(a,id),y=new PostgresAnalysisBudget(b,id);
   const results=await Promise.all(Array.from({length:10},(_,i)=>(i%2?x:y).reserve()));assert.equal(results.filter(r=>r.ok).length,2);
   await x.finish(results.find(r=>r.ok).id,"failed",null);assert.equal((await y.reserve()).ok,true);
   const {rows:[row]}=await a.query("SELECT used_requests FROM process_analysis_budgets WHERE id=$1",[id]);assert.equal(row.used_requests,3);
  });
  await t.test("fresh application pool after restart cannot reset quota",async()=>{
   const id=await funded({maxRequests:1});const first=new Pool(options);const x=new PostgresAnalysisBudget(first,id);const reserved=await x.reserve();assert.equal(reserved.ok,true);await x.finish(reserved.id,"failed",null);await first.end();
   const restarted=new Pool(options);try{assert.deepEqual(await new PostgresAnalysisBudget(restarted,id).reserve(),{ok:false,reason:"limit"});}finally{await restarted.end();}
  });
  await t.test("separate application processes share a spent crash reservation",async()=>{
   const id=await funded({maxRequests:1});
   const code=`import {Pool} from 'pg'; import {PostgresAnalysisBudget} from './lib/tools/process-analysis-budget.ts'; const pool=new Pool({connectionString:process.env.PROCESS_ANALYSIS_TEST_DATABASE_URL,options:process.env.ANALYSIS_TEST_OPTIONS}); console.log(JSON.stringify(await new PostgresAnalysisBudget(pool,process.env.ANALYSIS_TEST_ID).reserve())); await pool.end();`;
   const run=()=>JSON.parse(execFileSync(process.execPath,["--experimental-strip-types","--input-type=module","-e",code],{cwd:new URL("../../",import.meta.url),env:{...process.env,ANALYSIS_TEST_OPTIONS:options.options,ANALYSIS_TEST_ID:id},encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
   assert.equal(run().ok,true);assert.deepEqual(run(),{ok:false,reason:"limit"});
  });
  await t.test("missing/disabled/expired/model-mismatched budgets fail closed",async()=>{
   assert.deepEqual(await new PostgresAnalysisBudget(a,randomUUID()).reserve(),{ok:false,reason:"unavailable"});
   for(const patch of [{enabled:false},{model:"other"}])assert.equal((await new PostgresAnalysisBudget(a,await funded(patch)).reserve()).reason,"unavailable");
   const id=await funded();await a.query("UPDATE process_analysis_budgets SET ends_at=clock_timestamp()-interval '1 minute' WHERE id=$1",[id]);assert.equal((await new PostgresAnalysisBudget(a,id).reserve()).reason,"unavailable");
   const wrong=await funded();await a.query("UPDATE process_analysis_budgets SET reservation_micro_usd=1 WHERE id=$1",[wrong]);assert.equal((await new PostgresAnalysisBudget(a,wrong).reserve()).reason,"unavailable");
  });
  await t.test("shared minute and UTC daily limits survive replicas",async()=>{
   for(const [count,age] of [[5,"1 second"],[30,"61 seconds"]]){
    const id=await funded();
    // Owner-only fixture setup, no real requests or user data.
    await a.query(`INSERT INTO process_analysis_reservations(id,budget_id,reserved_micro_usd,outcome,created_at) SELECT md5($1||g::text)::uuid,$1,$2,'failed',clock_timestamp()-$3::interval FROM generate_series(1,$4) g`,[id,policy.reservationMicroUsd,age,count]);
    assert.equal((await new PostgresAnalysisBudget(b,id).reserve()).reason,"limit");
   }
  });
  await t.test("abandoned lease expires but reservation remains spent",async()=>{
   const id=await funded({maxRequests:2});const x=new PostgresAnalysisBudget(a,id);const first=await x.reserve();await a.query("UPDATE process_analysis_reservations SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[first.id]);
   const second=await new PostgresAnalysisBudget(b,id).reserve();assert.equal(second.ok,true);assert.equal((await x.reserve()).ok,false);
  });
  await t.test("circuit breaker disables all replicas",async()=>{
   const id=await funded();await new PostgresAnalysisBudget(a,id).trip();assert.equal((await new PostgresAnalysisBudget(b,id).reserve()).reason,"unavailable");
  });
  await t.test("insert failure rolls back budget increment atomically",async()=>{
   const id=await funded();await a.query(`CREATE FUNCTION fail_fixture_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.budget_id='${id}' THEN RAISE EXCEPTION 'synthetic'; END IF; RETURN NEW; END $$`);await a.query("CREATE TRIGGER fail_fixture BEFORE INSERT ON process_analysis_reservations FOR EACH ROW EXECUTE FUNCTION fail_fixture_insert()");
   assert.equal((await new PostgresAnalysisBudget(b,id).reserve()).reason,"unavailable");const {rows:[row]}=await a.query("SELECT used_requests FROM process_analysis_budgets WHERE id=$1",[id]);assert.equal(row.used_requests,0);
  });
  await t.test("database unavailable fails closed",async()=>{
   const closed=new Pool(options);await closed.end();assert.deepEqual(await new PostgresAnalysisBudget(closed,"missing").reserve(),{ok:false,reason:"unavailable"});
  });
 }finally{await a.end();await b.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
