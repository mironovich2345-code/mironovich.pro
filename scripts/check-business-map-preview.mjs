/** Local HTTP integration check of an existing production build. No Railway calls or deployment.
 * Test credentials are generated in memory, passed only through child-process environment,
 * and never included in reports, URLs, files, console output or process arguments.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as pause } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const report={build:'existing production build',node:process.version,cases:[]};
const credentials=()=>({BUSINESS_MAP_PREVIEW_USERNAME:randomBytes(12).toString('hex'),BUSINESS_MAP_PREVIEW_PASSWORD:randomBytes(32).toString('base64url')});
const header=env=>'Basic '+Buffer.from(`${env.BUSINESS_MAP_PREVIEW_USERNAME}:${env.BUSINESS_MAP_PREVIEW_PASSWORD}`,'utf8').toString('base64');
const good=credentials(),other=credentials();
const preview={NODE_ENV:'production',RAILWAY_ENVIRONMENT_NAME:'preview',BUSINESS_MAP_PROTOTYPE:'1',SITE_NOINDEX:'1',...good};
const trackedEnv=['BUSINESS_MAP_PROTOTYPE','SITE_NOINDEX','RAILWAY_ENVIRONMENT_NAME','RAILWAY_ENVIRONMENT','BUSINESS_MAP_PREVIEW_USERNAME','BUSINESS_MAP_PREVIEW_PASSWORD'];
let active=null;

async function unusedPort(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise((resolve,reject)=>s.close(e=>e?reject(e):resolve()));return port;}
async function stop(){if(!active)return;const child=active;active=null;if(child.exitCode!==null)return;child.kill('SIGTERM');await Promise.race([once(child,'exit'),pause(3000).then(()=>{if(child.exitCode===null)child.kill('SIGKILL');})]);}
async function start(overrides){
  const env={...process.env};for(const k of trackedEnv)delete env[k];Object.assign(env,overrides);
  const port=await unusedPort(),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  active=child;child.stdout.resume();child.stderr.resume();
  const until=Date.now()+25000;
  while(Date.now()<until){
    if(child.exitCode!==null)throw Error('Local integration server exited before readiness');
    try{await fetch(base+'/healthz',{signal:AbortSignal.timeout(1000)});return base;}catch{await pause(100);}
  }
  throw Error('Local integration server did not become ready');
}
function privateHeaders(response,label){
  assert.match(response.headers.get('cache-control')??'',/no-store/,label+' cache-control');
  assert.doesNotMatch(response.headers.get('cache-control')??'',/public|immutable/,label+' cache-control');
  assert.match(response.headers.get('x-robots-tag')??'',/noindex/,label+' noindex');
  assert.equal(response.headers.get('cdn-cache-control'),'no-store',label+' CDN cache');
}
async function check(base,label,url,expected,{auth,headers={},method='GET',isPrivate=true,flight=false}={}){
  const response=await fetch(base+url,{method,headers:{...headers,...(auth?{authorization:auth}:{})},redirect:'manual'});
  assert.equal(response.status,expected,label+' status');
  if(isPrivate)privateHeaders(response,label);
  if(expected===401)assert.match(response.headers.get('www-authenticate')??'',/^Basic /,label+' challenge');
  if(flight)assert.match(response.headers.get('content-type')??'',/text\/x-component/,label+' RSC type');
  const text=method==='HEAD'?'':await response.text();
  for(const secret of [good.BUSINESS_MAP_PREVIEW_USERNAME,good.BUSINESS_MAP_PREVIEW_PASSWORD,other.BUSINESS_MAP_PREVIEW_USERNAME,other.BUSINESS_MAP_PREVIEW_PASSWORD])assert.equal(text.includes(secret),false,label+' secret disclosure');
  if(expected!==200)assert.equal(text.includes('Какой процесс разберём?'),false,label+' private HTML disclosure');
  report.cases.push({label,path:url,method,status:response.status,privateCache:isPrivate,authorizationVary:response.headers.get('vary')?.toLowerCase().includes('authorization')??false});
  return {text,response};
}

try{
  let base=await start(preview);
  await check(base,'health probe has no application data','/healthz',200);
  await check(base,'HTML without authentication','/prototype/business-map',401);
  await check(base,'HTML wrong authentication','/prototype/business-map',401,{auth:header(other)});
  const {text}=await check(base,'HTML correct authentication','/prototype/business-map',200,{auth:header(good)});
  assert.ok(text.includes('Какой процесс разберём?'),'authenticated prototype markup missing');
  const assets=[...new Set([...text.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1].replaceAll('&amp;','&')).filter(url=>url.startsWith('/_next/')))];
  assert.ok(assets.some(url=>url.endsWith('.js')),'JS assets missing');assert.ok(assets.some(url=>url.endsWith('.css')),'CSS assets missing');
  for(const asset of assets){
    await check(base,'private asset without Referer',asset,401);
    const {response}=await check(base,'private asset with authentication',asset,200,{auth:header(good)});
    const etag=response.headers.get('etag');
    if(etag)await check(base,'conditional asset cannot bypass auth',asset,401,{headers:{'if-none-match':etag}});
  }
  for(const headers of [{RSC:'1'},{RSC:'1','Next-Router-Prefetch':'1'},{RSC:'1','Next-Router-Segment-Prefetch':'/_tree'}]){
    await check(base,'unauthenticated RSC/prefetch','/prototype/business-map?_rsc=check',401,{headers});
    await check(base,'wrong auth RSC/prefetch','/prototype/business-map?_rsc=check',401,{headers,auth:header(other)});
  }
  await check(base,'authenticated RSC','/prototype/business-map?_rsc=check',200,{headers:{RSC:'1'},auth:header(good),flight:true});
  await check(base,'authenticated prefetch','/prototype/business-map?_rsc=prefetch',200,{headers:{RSC:'1','Next-Router-Prefetch':'1'},auth:header(good),flight:true});
  await check(base,'Next data alias','/_next/data/integration/prototype/business-map.json',401);
  await check(base,'forged middleware bypass header','/prototype/business-map',401,{headers:{'x-middleware-subrequest':'middleware:middleware:middleware:middleware:middleware','x-business-map-authorized':'1','x-middleware-invoke':'1'}});
  await check(base,'HEAD protected','/prototype/business-map',401,{method:'HEAD'});
  await check(base,'root in private preview','/',401);
  await check(base,'public calculator in preview after login','/tools/labor-cost',200,{auth:header(good)});
  for(const endpoint of ['/api/lead','/api/tools/recommendation'])await check(base,'public integration disabled in preview',endpoint,404,{method:'POST',auth:header(good)});
  await check(base,'HTML remains protected after authorized responses','/prototype/business-map',401);
  await stop();

  const withoutCredentials={...preview};delete withoutCredentials.BUSINESS_MAP_PREVIEW_USERNAME;delete withoutCredentials.BUSINESS_MAP_PREVIEW_PASSWORD;
  base=await start(withoutCredentials);
  await check(base,'unconfigured health probe','/healthz',503);
  await check(base,'missing environment credentials fail closed','/prototype/business-map',404,{auth:header(good)});
  await check(base,'missing credentials protect static assets too',assets[0],404);
  await stop();

  base=await start({...preview,...other});
  await check(base,'old credentials fail after runtime rotation','/prototype/business-map',401,{auth:header(good)});
  await check(base,'new runtime credentials work without rebuilding','/prototype/business-map',200,{auth:header(other)});
  await stop();

  base=await start({...preview,SITE_NOINDEX:'0'});
  await check(base,'preview without noindex is closed','/prototype/business-map',404,{auth:header(good)});
  await check(base,'closed preview protects bundles',assets[0],404,{auth:header(good)});
  await stop();

  base=await start({...preview,RAILWAY_ENVIRONMENT_NAME:'production'});
  await check(base,'Railway production with all opt-ins is hidden','/prototype/business-map',404,{auth:header(good)});
  await check(base,'Railway production RSC is hidden','/prototype/business-map?_rsc=check',404,{auth:header(good),headers:{RSC:'1'}});
  await check(base,'production public labor calculator','/tools/labor-cost',200,{isPrivate:false});
  await check(base,'production public automation calculator','/tools/automation-cost',200,{isPrivate:false});
  await check(base,'production homepage stays public','/',200,{isPrivate:false});
  await stop();
  await writeFile(path.join(root,'docs/products/business-map/preview/http-check.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Business Map preview HTTP checks passed: ${report.cases.length}. No credentials included in report.`);
}finally{await stop();}
