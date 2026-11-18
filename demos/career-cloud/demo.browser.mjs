import assert from "node:assert/strict";
import { chromium } from "playwright";
const base="http://127.0.0.1:3207";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const out=[];
page.on("request",r=>{
 if(!r.url().startsWith(base+"/")||r.method()!=="GET")out.push(r.method()+" "+r.url());
});
page.on("pageerror",e=>out.push("error "+e.message));
try{
 await page.goto(base+"/");
 await page.getByRole("button",{name:"Начать демонстрацию →"}).click();
 await page.getByRole("checkbox").check();
 await page.getByRole("button",{name:"Симулировать покупку →"}).click();
 for(let n=0;n<18;n++){
  await page.locator(".choices .choice").first().click();
  await page.locator('[data-action="next"]').click();
 }
 assert.equal(await page.locator(".task").count(),5);
 await page.getByRole("button",{name:"Сформировать учебный план →"}).click();
 await page.getByRole("button",{name:"Открыть 30 шагов"}).click();
 assert.equal(await page.locator(".plan-list .plan-item").count(),30);
 await page.locator('.plan-item[data-action="done"]').first().click();
 assert.match(await page.locator(".progress-big").innerText(),/1\s*\/\s*30/);
 await page.evaluate(()=>{window.__printCalled=false;window.print=()=>{window.__printCalled=true;};});
 await page.getByRole("button",{name:"Сохранить как PDF / печать"}).click();
 assert.equal(await page.evaluate(()=>window.__printCalled),true);
 for(const width of [390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"horizontal overflow at "+width);
 }
 assert.deepEqual(out,[],"no external requests, POST or JS errors");
 assert.equal((await page.context().cookies()).length,0,"no cookies");
 console.log("PASS cloud demo: purchase simulation, 18 questions, 30 steps, progress, print, responsive, no cookies/POST");
}finally{await browser.close();}
