import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { prototypeAvailable, prototypeMode } from '../lib/business-map/prototype-policy.ts';
import { authorizePrototype, credentialsConfigured, isPrototypePath, previewResponseHeaders, PREVIEW_REALM } from '../lib/business-map/preview-access.ts';

// Test-only credentials are generated in memory; no real or example password is committed.
const credentials=()=>({BUSINESS_MAP_PREVIEW_USERNAME:randomBytes(12).toString('hex'),BUSINESS_MAP_PREVIEW_PASSWORD:randomBytes(32).toString('base64url')});
const preview=()=>({NODE_ENV:'production',RAILWAY_ENVIRONMENT_NAME:'preview',BUSINESS_MAP_PROTOTYPE:'1',SITE_NOINDEX:'1',...credentials()});
const basic=(env,password=env.BUSINESS_MAP_PREVIEW_PASSWORD,username=env.BUSINESS_MAP_PREVIEW_USERNAME)=>'Basic '+Buffer.from(`${username}:${password}`,'utf8').toString('base64');

test('local development keeps its opt-in without credentials or noindex',async()=>{
  const env={NODE_ENV:'development',BUSINESS_MAP_PROTOTYPE:'1'};
  assert.equal(prototypeMode(env.NODE_ENV,env.BUSINESS_MAP_PROTOTYPE,undefined,undefined),'development');
  assert.equal(await authorizePrototype(env,null),'allow');
  for(const flag of [undefined,'','0','true']) assert.equal(await authorizePrototype({...env,BUSINESS_MAP_PROTOTYPE:flag},null),'hidden');
});

test('Railway Preview requires all four exact environment values',async()=>{
  const env=preview();
  assert.equal(prototypeAvailable(env.NODE_ENV,env.BUSINESS_MAP_PROTOTYPE,env.RAILWAY_ENVIRONMENT_NAME,env.SITE_NOINDEX),true);
  for(const [field,values] of Object.entries({NODE_ENV:[undefined,'development','test'],RAILWAY_ENVIRONMENT_NAME:[undefined,'staging','Preview','preview '],BUSINESS_MAP_PROTOTYPE:[undefined,'0','true',''],SITE_NOINDEX:[undefined,'0','true','']})){
    for(const value of values) assert.equal(await authorizePrototype({...env,[field]:value},basic(env)),'hidden',field);
  }
});

test('configured preview challenges missing/wrong credentials and accepts only matching Basic auth',async()=>{
  const env=preview();
  assert.equal(await authorizePrototype(env,null),'challenge');
  assert.equal(await authorizePrototype(env,basic(env,randomBytes(32).toString('hex'))),'challenge');
  assert.equal(await authorizePrototype(env,basic(env,env.BUSINESS_MAP_PREVIEW_PASSWORD,randomBytes(12).toString('hex'))),'challenge');
  assert.equal(await authorizePrototype(env,basic(env)),'allow');
  assert.equal(await authorizePrototype(env,basic(env).replace('Basic','basic')),'allow');
  assert.match(PREVIEW_REALM,/^Basic realm="Business Map Preview", charset="UTF-8"$/);
});

test('absent, empty, weak or malformed environment credentials fail closed even for supplied Basic',async()=>{
  const env=preview();
  for(const change of [
    {BUSINESS_MAP_PREVIEW_USERNAME:undefined},{BUSINESS_MAP_PREVIEW_USERNAME:''},{BUSINESS_MAP_PREVIEW_USERNAME:'  '},
    {BUSINESS_MAP_PREVIEW_USERNAME:randomBytes(12).toString('hex')+':'},
    {BUSINESS_MAP_PREVIEW_PASSWORD:undefined},{BUSINESS_MAP_PREVIEW_PASSWORD:''},{BUSINESS_MAP_PREVIEW_PASSWORD:' '.repeat(32)},
    {BUSINESS_MAP_PREVIEW_PASSWORD:randomBytes(4).toString('hex')},{BUSINESS_MAP_PREVIEW_PASSWORD:randomBytes(32).toString('hex')+'\n'},
  ]){
    const invalid={...env,...change};assert.equal(credentialsConfigured(invalid),false);
    assert.equal(await authorizePrototype(invalid,basic(env)),'hidden');
  }
});

test('malformed schemes, base64, invalid UTF-8 and oversized headers never authenticate or throw',async()=>{
  const env=preview();
  for(const header of ['', 'Bearer '+randomBytes(32).toString('hex'), 'Basic !!!', 'Basic A===', 'Basic '+Buffer.from('missing-colon').toString('base64'), 'Basic '+Buffer.from([0xff,0xfe]).toString('base64'), 'Basic '+Buffer.from(':').toString('base64'), 'Basic '+randomBytes(9000).toString('base64'), basic(env)+' ']){
    assert.equal(await authorizePrototype(env,header),'challenge');
  }
});

test('UTF-8 and colons in the password are matched byte-for-byte',async()=>{
  const env={...preview(),BUSINESS_MAP_PREVIEW_PASSWORD:randomBytes(24).toString('hex')+':'+String.fromCodePoint(0x43a,0x43b,0x44e,0x447)};
  assert.equal(await authorizePrototype(env,basic(env)),'allow');
  assert.equal(await authorizePrototype(env,basic(env,env.BUSINESS_MAP_PREVIEW_PASSWORD+' ')),'challenge');
});

test('Railway production denies every node mode and flag combination, including valid credentials',async()=>{
  const env=preview(),auth=basic(env);
  for(const node of [undefined,'development','production','test'])for(const railway of ['production','Production',' production '])for(const enabled of [undefined,'','0','1','true'])for(const noindex of [undefined,'','0','1','true']){
    const production={...env,NODE_ENV:node,RAILWAY_ENVIRONMENT_NAME:railway,BUSINESS_MAP_PROTOTYPE:enabled,SITE_NOINDEX:noindex};
    assert.equal(await authorizePrototype(production,auth),'hidden');
    assert.equal(prototypeAvailable(node,enabled,railway,noindex),false);
  }
});

test('a preview environment running a development server cannot take the unauthenticated local shortcut',async()=>{
  const env={...preview(),NODE_ENV:'development'};
  assert.equal(await authorizePrototype(env,null),'hidden');
  assert.equal(await authorizePrototype(env,basic(env)),'hidden');
});

test('document, descendants, data and RSC aliases are private independently of Referer or custom grant headers',()=>{
  for(const path of ['/prototype/business-map','/prototype/business-map/','/prototype/business-map/analysis','/prototype/business-map.rsc','/prototype/business-map.json','/_next/data/build/prototype/business-map.json','/_next/data/build/prototype/business-map/analysis.json','/%70rototype/business-map'])assert.equal(isPrototypePath(path),true,path);
  for(const path of ['/','/products','/tools/labor-cost','/tools/automation-cost','/prototype/business-map-other'])assert.equal(isPrototypePath(path),false,path);
});

test('private response policy explicitly prevents browser and intermediary caching',()=>{
  assert.match(previewResponseHeaders['Cache-Control'],/private/);assert.match(previewResponseHeaders['Cache-Control'],/no-store/);
  assert.equal(previewResponseHeaders['CDN-Cache-Control'],'no-store');
  assert.equal(previewResponseHeaders['Surrogate-Control'],'no-store');
  assert.match(previewResponseHeaders['Vary'],/Authorization/);assert.match(previewResponseHeaders['X-Robots-Tag'],/noindex/);
});
