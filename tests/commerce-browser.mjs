// Local rendered-page audit; never submits a lead, order or payment.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const mode=process.env.COMMERCE_LEGAL_MODE||'legacy';assert(['legacy','preview'].includes(mode));
const origin=process.env.COMMERCE_QA_ORIGIN||'http://127.0.0.1:3200';
assert.equal(new URL(origin).hostname,'127.0.0.1');assert.equal(new URL(origin).protocol,'http:');
const routes=['/products/ai-career','/offer/ai-career','/delivery','/refund','/requisites','/privacy','/consent'];
const commerce=routes.slice(0,5),out=join(tmpdir(),'mironovich-commerce-qa',mode);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'}),ctx=await browser.newContext({baseURL:origin});const page=await ctx.newPage(),errors=[],external=[],results=[];
page.on('pageerror',e=>errors.push(e.message));await ctx.route('**/*',async r=>{if(new URL(r.request().url()).origin!==origin){external.push(r.request().url());await r.abort()}else await r.continue()});
try{
for(const width of [375,390,768,1024,1440]){await page.setViewportSize({width,height:1000});for(const route of routes){const r=await page.goto(route,{waitUntil:'networkidle'});assert.equal(r.status(),200,route);await page.locator('main h1').waitFor();const text=(await page.locator('main').innerText()).replaceAll('\u00a0',' ').replaceAll('\u202f',' ');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`${route} ${width}`);
if(commerce.includes(route)){assert(text.includes('18+'));for(const term of ['1 990 ₽','один персональный анализ','30 дней','PDF','90 дней'])assert(text.includes(term),`${route}: ${term}`);assert(/будущ|планиру|пока|Готовится|разрабатывается/.test(text));assert.equal(await page.locator('a[href*="yookassa"],form[action*="pay"]').count(),0);}
if(['/offer/ai-career','/delivery','/refund','/requisites','/privacy','/consent'].includes(route))assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
if(['/privacy','/consent'].includes(route)){if(mode==='legacy'){assert(!text.includes('ru-central1'));assert(!text.includes('Проект документа — не опубликован'));}else{assert(text.includes('Проект документа — не опубликован'));assert(text.includes('Проект от 17 ноября 2026'));assert(text.includes('Дата начала действия не назначена'));}}
if([375,1440].includes(width))await page.screenshot({path:join(out,`${route.replaceAll('/','_')}-${width}.png`),fullPage:true});results.push({route,width,mode,heading:await page.locator('main h1').innerText(),result:'PASS'});
}}
for(const target of routes.slice(1)){await page.goto('/offer/ai-career');await page.locator(`nav[aria-label="Документы и условия покупки"] a[href="${target}"]`).click();await page.waitForURL(origin+target);await page.locator('main h1').waitFor();results.push({scenario:'cross-document link',target,result:'PASS'})}
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(`${mode}: ${results.length} browser checks passed, no overflow/JS errors/external requests`);
}finally{writeFileSync(join(out,'results.json'),JSON.stringify({mode,results,errors,external},null,2));await ctx.close();await browser.close()}
