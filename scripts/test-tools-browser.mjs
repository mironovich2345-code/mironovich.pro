import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
// Resolve optional test-only dependencies installed separately via NODE_PATH.
const load = createRequire(import.meta.url);
const { chromium } = load("playwright");
const AxeBuilder = load("@axe-core/playwright").default;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out=process.env.TOOLS_SCREENSHOTS_DIR||path.resolve(__dirname,'../docs/tools/screenshots');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 const report={viewports:[],scenarios:[],accessibility:[],errors:[]};
 const url=process.env.TOOLS_BASE_URL||'http://127.0.0.1:3000';
 async function pageFor(width){const context=await browser.newContext({viewport:{width,height:1000}});const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));return p;}
 async function visit(p,path){await p.goto(url+path,{waitUntil:'networkidle',timeout:120000});}
 async function overflow(p){return p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);}
 async function capture(page,file){await page.addStyleTag({content:'nextjs-portal {display:none !important}'});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:file,fullPage:true});console.log('captured',path.basename(file));}
 for(const width of (process.env.SKIP_VIEWPORTS?[]:[320,375,768,1024,1440])){
  const p=await pageFor(width);
  for(const [name,path] of [['labor','/tools/labor-cost'],['automation','/tools/automation-cost']]){
   await visit(p,path);
   if(await p.getByLabel('Точное число',{exact:true}).inputValue()!=='4')throw Error('default employees');
   if(await overflow(p))throw Error('overflow '+width+' '+name);
   await capture(p,`${out}/${name}-${width}.png`);
   report.viewports.push({width,page:name,overflow:false});
  }
  await p.close();
 }
 // Scenario 1: no technical knowledge, keyboard only for category/submit.
 const p=await pageFor(375);await visit(p,'/tools/automation-cost');
 const crm=p.getByRole('checkbox',{name:/Заявки и CRM/});await crm.focus();await p.keyboard.press('Space');
 if(!await crm.isChecked())throw Error('keyboard checkbox');
 const submit=p.getByRole('button',{name:'Узнать, что можно автоматизировать'});await submit.focus();await p.keyboard.press('Enter');
 await p.getByRole('heading',{name:'Что стоит автоматизировать в первую очередь'}).waitFor();
 await capture(p,`${out}/result-beginner-375.png`);
 const axe1=await new AxeBuilder({page:p}).analyze();if(axe1.violations.length)throw Error("Accessibility violations on beginner result");report.accessibility.push({state:'beginner-result',violations:axe1.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))});
 if(await overflow(p))throw Error('result overflow');report.scenarios.push('Beginner: keyboard selection, result without systems, wages or API knowledge');
 await p.close();
 // Scenario 2: multiple measured processes, transfer and lead payload.
 const q=await pageFor(1440);await visit(q,'/tools/labor-cost');
 for(const n of [10,25,50,4]){await q.getByRole('button',{name:String(n),exact:true}).click();if(await q.getByLabel('Точное число',{exact:true}).inputValue()!==String(n))throw Error('preset');}
 await q.getByLabel('Точное число',{exact:true}).fill('0');await q.getByRole('checkbox',{name:/Отчёты и таблицы/}).check();await q.getByRole('button',{name:'Узнать, что можно автоматизировать'}).click();await q.getByRole('alert').filter({hasText:'Проверьте числа'}).waitFor();
 await q.getByLabel('Точное число',{exact:true}).fill('4');await q.getByRole('checkbox',{name:/Перенос данных/}).check();
 await q.getByText('Уточнить расчёт времени — необязательно',{exact:true}).click();
 for(const task of ['reporting','transfer']){await q.locator('#'+task+'-repetitions').fill('10');await q.locator('#'+task+'-minutes').fill('6');await q.locator('#'+task+'-hourlyCost').fill('500');}
 await q.locator('#transfer-employees').fill('2');
 await q.getByRole('checkbox',{name:/Подтверждаю: эти операции/}).nth(0).check();
 await q.getByRole('button',{name:'Узнать, что можно автоматизировать'}).click();await q.getByText(/Общий итог не сводится/).waitFor();
 await q.getByRole('button',{name:'Изменить выбор и уточнить описание'}).click();
 await q.getByText('Уточнить расчёт времени — необязательно',{exact:true}).click();await q.getByRole('checkbox',{name:/Подтверждаю: эти операции/}).nth(1).check();
 await q.getByRole('button',{name:'Узнать, что можно автоматизировать'}).click();await q.getByText(/Итого по 2 измеренным независимым процессам: 6 ч/).waitFor();
 await capture(q,`${out}/result-multiple-1440.png`);
 for(const width of [320,375,768,1024,1440]){await q.setViewportSize({width,height:1000});if(await overflow(q))throw Error('multiple result overflow '+width);await capture(q,`${out}/result-multiple-${width}.png`);report.viewports.push({width,page:'multiple-result',overflow:false});}
 await q.setViewportSize({width:1440,height:1000});
 await q.getByRole('link',{name:/Продолжить разбор автоматизации/}).click();await q.waitForURL('**/tools/automation-cost');await q.waitForLoadState('networkidle');await q.getByRole('heading',{name:'Что стоит автоматизировать в первую очередь'}).waitFor();await q.getByText(/Итого по 2 измеренным независимым процессам: 6 ч/).waitFor();
 let lead;
 await q.route('**/api/lead',async route=>{lead=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,delivered:true})});});
 await q.getByRole('button',{name:'Обсудить автоматизацию моего бизнеса'}).click();
 await q.locator('#lead-name').fill('Тестовый пользователь');await q.locator('#lead-phone').fill('@test_account');
 await q.getByRole('button',{name:/Отправить/i}).click();
 if(lead)throw Error('lead sent without consent');
 await q.locator('#lead-consent').check();await q.getByRole('button',{name:/Отправить/i}).click();await q.waitForTimeout(500);
 if(!lead||lead.toolContext.version!=='tools-2.0.0'||lead.toolContext.input.tasks.length!==2)throw Error('v2 lead context missing');
 report.scenarios.push('Manager: presets, invalid count, independent totals, session transfer, consented lead payload (delivery mocked)');await q.close();
 // Scenario 3: AI without money and safe disabled fallback.
 const a=await pageFor(375);await visit(a,'/tools/automation-cost');
 await a.getByRole('checkbox',{name:/Ответы клиентам/}).check();await a.getByLabel('Опишите задачу своими словами').fill('Нужны ответы по базе знаний');
 await a.getByText('Получить дополнительный разбор с ИИ',{exact:true}).click();
 if(!await a.getByRole('button',{name:'Получить ИИ-рекомендацию'}).isDisabled())throw Error('AI consent gate');
 await a.getByRole('checkbox',{name:/Я прочитал уведомление/}).check();
 let aiRequest;a.on('request',r=>{if(r.url().endsWith('/api/tools/recommendation'))aiRequest=r.postDataJSON();});
 await a.getByRole('button',{name:'Получить ИИ-рекомендацию'}).click();
 await a.getByRole('heading',{name:'Что стоит автоматизировать в первую очередь'}).waitFor();
 // Result view owns a freshly mounted details element; reopen for status.
 await a.getByText('Получить дополнительный разбор с ИИ',{exact:true}).click();
 await a.getByText(/ИИ-разбор пока выключен/).waitFor();
 if(!aiRequest||JSON.stringify(aiRequest).includes('Нужны ответы')||'measurements' in aiRequest.input)throw Error('unnecessary data sent');
 await capture(a,`${out}/result-ai-fallback-375.png`);
 const axe2=await new AxeBuilder({page:a}).analyze();if(axe2.violations.length)throw Error("Accessibility violations on AI result");report.accessibility.push({state:'ai-result',violations:axe2.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))});
 report.scenarios.push('AI-first: notice/action, no free text or financial data sent, server disabled fallback preserves base result');
 await a.close();
 if(report.errors.length)throw Error('page errors '+report.errors.join('; '));
 fs.writeFileSync(process.env.TOOLS_BROWSER_REPORT||path.resolve(out,'../browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
