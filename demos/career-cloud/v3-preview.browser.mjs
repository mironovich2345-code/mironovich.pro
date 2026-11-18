import assert from "node:assert/strict";
import { chromium } from "playwright";

const base="http://127.0.0.1:3207";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
const network=[];
page.on("request",req=>{
  network.push([req.method(),req.url()]);
  if(req.method()!=="GET"||!req.url().startsWith(base+"/"))errors.push("unexpected network "+req.method()+" "+req.url());
});
page.on("pageerror",err=>errors.push(err.message));
try{
 const response=await page.goto(base+"/v3-preview");
 assert.equal(response.status(),200);
 await page.getByRole("tab",{name:"18 вопросов"}).click();
 assert.match(await page.locator("#app").innerText(),/Какие продажи занимают большую часть вашей работы/);
 assert.equal(await page.locator(".nav-grid button").count(),18);
 await page.locator(".choice").last().click(); // mixed role
 assert.equal(await page.locator(".nav-grid button").count(),19); // conditional F02
 await page.locator(".nav-grid button").nth(11).click(); // Q12
 assert.match(await page.locator(".question").innerText(),/Что компания разрешает/);
 await page.locator(".choice").last().click(); // unknown rules
 assert.equal(await page.locator(".nav-grid button").count(),20); // F01 and F02
 await page.getByRole("tab",{name:"5 модулей"}).click();
 assert.equal(await page.locator(".module-links button").count(),5);
 assert.equal(await page.locator(".item-list .item").count(),4);
 await page.getByRole("button",{name:/ИИ в моей работе/}).click();
 assert.equal(await page.locator(".item-list .item").count(),7);
 assert.match(await page.locator(".item-list .item").first().innerText(),/Запланирован/);
 await page.getByRole("tab",{name:"24 задачи"}).click();
 assert.equal(await page.locator(".item-list .item").count(),24);
 await page.locator(".module-links button").last().click(); // account
 assert.ok((await page.locator(".item-list .item").count())<24);
 await page.getByRole("tab",{name:"Образец урока"}).click();
 assert.match(await page.locator("#app").innerText(),/прототип/i);
 await page.getByRole("button",{name:"Разборы"}).click();
 assert.equal(await page.locator(".case").count(),2);
 await page.getByRole("button",{name:"Практика"}).click();
 assert.match(await page.locator("#app").innerText(),/Соберите безопасное учебное резюме/);
 await page.getByRole("button",{name:"Проверка"}).click();
 assert.equal(await page.locator(".panel .choice").count(),9);
 await page.locator(".panel .choice").nth(1).click();
 assert.match(await page.locator("#app").innerText(),/Верно/);
 for (const width of [375,390,768,1024,1440]){
   await page.setViewportSize({width,height:900});
   const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);
   assert.ok(scroll<=width+1,"horizontal overflow "+scroll+" > "+width);
 }
 assert.deepEqual(errors,[]);
 assert.equal((await page.context().cookies()).length,0);
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).length),0);
 assert.ok(network.every(([method,url])=>method==="GET"&&url.startsWith(base+"/")));
 console.log("PASS V3 preview: authentic 18 Q, conditional F01/F02, 5 modules, 24 tasks, lesson cases/practice/quiz, mobile, zero PII/POST/cookies");
}finally{await browser.close();}
