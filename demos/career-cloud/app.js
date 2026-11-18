"use strict";
// All answers stay in browser memory. No accounts, storage, cookies, POST or external APIs.
const root=document.getElementById("app");
const labels={
operations:"Операционная работа",sales:"Продажи",analyst:"Аналитика",support:"Поддержка",
starter:"Начинающий",practiced:"Есть практика",experienced:"Опытный",
documents:"Документы",tables:"Таблицы",communication:"Общение",research:"Источники",
daily:"Каждый день",weekly:"Каждую неделю",monthly:"Каждый месяц",
short:"До 15 минут",medium:"15–60 минут",long:"Больше часа",
clear:"Шаги описаны",partial:"Частично",unclear:"Пока неясно",
structured:"Структурированные",text:"Текст",mixed:"Смешанные",
synthetic:"Только учебные",public:"Открытые",restricted:"Закрытые — не передавать",
approved:"Разрешены",ask_first:"Сначала согласовать",forbidden:"Запрещены",
low:"Низкие",high:"Высокие",checklist:"Проверочный список",expert_review:"Проверка человеком",not_defined:"Не определены",
same:"Одинаковые",variable:"Изменяются",unique:"Уникальны",
none:"Нет",basic:"Базовый",regular:"Регулярный",available:"Есть время",limited:"Ограничено",
human:"Я проверяю",supervisor:"Руководитель",regulated:"Регламент и ответственный человек",
measured:"Есть замер",estimate:"Оценка",
one_hour:"Один час",three_hours:"Три часа",five_hours:"Пять часов",
quality:"Качество",speed:"Скорость",clarity:"Понятность"
};
const fresh=()=>({page:"intro",accepted:false,index:0,answers:{},tasks:["table","document"],done:new Set(),tab:"overview",filter:"all"});
let data,st=fresh();
function h(tag,attrs={},...contents){
 const el=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){
   if(value===null||value===undefined||value===false)continue;
   if(key==="class")el.className=value;
   else if(key==="dataset")for(const [k,v] of Object.entries(value))el.dataset[k]=String(v);
   else if(key==="disabled")el.disabled=Boolean(value);
   else if(key==="checked")el.checked=Boolean(value);
   else el.setAttribute(key,value===true?"":String(value));
 }
 for(const child of contents.flat(Infinity)){
   if(child===null||child===undefined||child===false)continue;
   el.append(typeof child==="string"||typeof child==="number"?document.createTextNode(String(child)):child);
 }
 return el;
}
function p(str,cls="subtle"){return h("p",{class:cls},str);}
function heading(tag,str,cls="",primary=false){return h(tag,{class:cls,...(primary?{id:"app-title",tabindex:"-1"}:{})},str);}
function eyebrow(str){return p(str,"eyebrow");}
function btn(text,action,primary=false,disabled=false,value){
 return h("button",{type:"button",class:"btn "+(primary?"primary":"ghost"),disabled,
   dataset:{action,...(value===undefined?{}:{value})}},text);
}
function actionbar(...children){return h("div",{class:"actionbar no-print"},...children);}
function panel(...children){return h("section",{class:"panel"},...children);}
function notice(){return h("div",{class:"notice compact no-print"},
 "Только учебная демонстрация. Без настоящих email, оплаты, реальных рабочих данных и внешнего ИИ. Ответы существуют только в этой вкладке.");
}
function metric(value,name){return h("div",{class:"metric"},h("strong",{},value),h("span",{},name));}
function intro(){
 return h("section",{},eyebrow("01 / ИНТЕРАКТИВНАЯ ДЕМОНСТРАЦИЯ"),
   heading("h1","Работать с ИИ. Стать ценнее.","hero-title",true),
   p("Пройди учебную диагностику, выбери рабочие сценарии и получи практический план из 30 шагов. Всё можно попробовать без регистрации и оплаты.","lede"),
   h("div",{class:"metrics"},metric("18","вопросов"),metric("5","учебных задач"),metric("30","шагов"),metric("0 ₽","в демонстрации")),
   h("div",{class:"steps-layout block-gap"},
     h("section",{class:"panel accent"},eyebrow("ПРОДУКТ ДЛЯ СОТРУДНИКОВ"),
       heading("h2","Попробуй будущий личный кабинет"),
       p("Коммерческая версия планируется за 1 993 ₽ с персональным анализом, PDF и 90 днями доступа. Здесь показан учебный алгоритм, а не реальная покупка."),
       actionbar(btn("Начать демонстрацию →","checkout",true))),
     panel(p("ЧТО ПРОВЕРИМ","smallhead"),
       ...["Выбор учебных задач","Условия и риск использования ИИ","Последовательность 30 действий","Прогресс и сохранение PDF"].map((str,i)=>p(String(i+1).padStart(2,"0")+". "+str,"bullet")))),
   h("section",{class:"block-gap"},p("ЧЕТЫРЕ ЭТАПА ПРОГРАММЫ","smallhead"),
     h("div",{class:"feature-grid"},
      ...[["01—06","Разберите задачу","Измерьте исходное состояние и определите ограничения."],
      ["07—14","Попробуйте ИИ","Экспериментируйте только на разрешённых учебных примерах."],
      ["15—23","Проверьте качество","Сравните результат с эталоном и отметьте ошибки."],
      ["24—30","Оформите результат","Подготовьте рабочий кейс и следующие шаги развития."]]
      .map(([n,t,s])=>h("article",{class:"feature"},p(n,"index"),heading("h3",t),p(s)))));
}
function checkout(){
 const choice=h("label",{class:"choice"+(st.accepted?" selected":"")},
  h("input",{id:"demo-confirm",type:"checkbox",checked:st.accepted}),
  h("span",{},"Подтверждаю: это имитация покупки, не нужно указывать реальные данные, деньги не списываются."));
 const order=h("div",{class:"order"},h("div",{},heading("h3","Цифровой продукт для сотрудников"),p("18 вопросов · один анализ · 30 шагов · PDF · 90 дней","fine")),
  h("div",{class:"price-box"},p("3 990 ₽","strike"),h("div",{class:"price"},"1 993 ₽")));
 return h("section",{},eyebrow("02 / ИМИТАЦИЯ ПОКУПКИ"),heading("h1","Как устроено оформление","",true),
  p("В этом демо нет платёжных реквизитов и регистрации. Нажатие кнопки откроет диагностику без списания средств.","lede"),
  notice(),h("div",{class:"steps-layout"},
   panel(p("УЧЕБНАЯ КОРЗИНА","smallhead"),order,
    p("Фактическая стоимость в этом демо: 0 ₽. Сервис ЮKassa не вызывается.","fine"),choice,
    actionbar(btn("← Назад","intro"),btn("Симулировать покупку →","begin",true,!st.accepted))),
   panel(p("В КОММЕРЧЕСКОЙ ВЕРСИИ","smallhead"),
    ...["Подтверждение 18+ и условий","Оплата через ЮKassa","Выдача доступа по email","90 дней доступа к личному кабинету"]
       .map((str,i)=>p(String(i+1).padStart(2,"0")+". "+str,"bullet")),
    p("Эти действия пока не подключены.","fine"))));
}
function quiz(){
 const item=data.questions[st.index],v=st.answers[item.key],percent=Math.round((st.index+1)*100/18);
 const choices=item.values.map(choice=>h("button",{type:"button",class:"choice"+(v===choice?" selected":""),
     "aria-pressed":String(v===choice),dataset:{action:"answer",value:choice}},
   h("span",{class:"round","aria-hidden":"true"}),h("span",{},labels[choice]||choice)));
 return panel(eyebrow("03 / ДИАГНОСТИКА"),
  h("div",{class:"progress-note"},"ВОПРОС "+(st.index+1)+" / 18 · "+percent+"%"),
  h("div",{class:"progress top-gap"},h("span",{style:"width:"+percent+"%"})),
  heading("h1",item.label,"question-title",true),
  h("div",{class:"choices",role:"group","aria-label":item.label},...choices),
  actionbar(btn("← Назад","prev"),btn(st.index===17?"К выбору задач →":"Следующий вопрос →","next",true,!v)),
  p("Вопросы принимают только заранее заданные ответы, свободного текста нет.","fine"));
}
function tasks(){
 return h("section",{},eyebrow("04 / ВЫБОР УЧЕБНЫХ ЗАДАЧ"),
  heading("h1","Выбери от одной до пяти задач","",true),
  p("Все задачи вымышленные — никаких файлов, контактов и данных работодателя.","lede"),
  h("div",{class:"metrics"},metric(String(st.tasks.length),"выбрано"),metric("5","доступно")),
  h("div",{class:"stepgrid"},
    ...data.tasks.map((t,i)=>h("button",{
      type:"button",class:"task"+(st.tasks.includes(t.id)?" selected":""),
      "aria-pressed":String(st.tasks.includes(t.id)),dataset:{action:"task",value:t.id}
    },h("span",{class:"check","aria-hidden":"true"},st.tasks.includes(t.id)?"✓":""),
    h("span",{},h("strong",{},(i+1)+". "+t.title),h("small",{},t.steps))))),
  actionbar(btn("← Назад","back-quiz"),btn("Сформировать учебный план →","results",true,st.tasks.length===0)));
}
function risk(){
 const a=st.answers,restricted=a.dataSensitivity==="restricted"||a.accessRules!=="approved";
 const high=a.errorImpact==="high"||a.reviewTime==="none"||a.decisionAuthority==="regulated";
 return {restricted,high,score:restricted?0:high?1:a.repeatability==="same"?3:2,
  title:restricted?"Сначала согласуйте правила":high?"Только с проверкой человеком":"Подходит для учебного эксперимента",
  details:restricted?"Инструменты или данные ограничены. Нельзя передавать их в ИИ без разрешения; используйте учебную имитацию.":
   high?"Результаты должны проходить обязательную проверку человеком. Автоматические решения недопустимы.":
   "Можно провести ограниченный эксперимент на вымышленных данных и проверить качество вручную."};
}
const selected=()=>st.tasks.map(id=>data.tasks.find(t=>t.id===id));
const plan=()=>data.plans[st.tasks[0]]||[];
const ranges=[[1,6,"Разберите задачу"],[7,14,"Попробуйте ИИ"],[15,23,"Проверьте качество"],[24,30,"Оформите результат"]];
function advice(){
 const r=risk();
 return r.restricted?"Не используйте чужие данные. Согласуйте разрешение и попробуйте вымышленный пример.":
  r.high?"Применяйте ИИ только для черновика с обязательной проверкой человеком.":
   "Проведите безопасный эксперимент на учебных данных и сравните с ручным эталоном.";
}
function overview(){
 const r=risk();
 return h("section",{},heading("h2","Результат учебной диагностики"),
  h("p",{},h("span",{class:"risk"+(!r.restricted&&!r.high?" ok":"")},r.title)),p(r.details),
  h("div",{class:"report-section"},heading("h3","Три направления развития"),
    ...data.directions.map((s,i)=>p((i+1)+". "+s,"bullet"))),
  h("div",{class:"report-section"},heading("h3","Четыре этапа программы"),
    h("div",{class:"stepgrid"},...ranges.map(([start,end,title])=>
      h("div",{class:"phase"},p(String(start).padStart(2,"0")+"—"+String(end).padStart(2,"0"),"phase-num"),h("strong",{},title))))),
  p("Этот анализ выполнен по фиксированным правилам. Он не прогнозирует увольнение и не гарантирует рост дохода.","hint"));
}
function taskReport(){
 const r=risk();
 return h("section",{},heading("h2","Разбор выбранных задач"),p("Индикатор пригодности учебного эксперимента — не оценка вероятности увольнения."),
  ...selected().map(t=>h("div",{class:"bullet"},heading("h3",t.title),p(advice()),p("Учебный индекс: "+r.score+" / 3 · "+t.steps,"task-score"))));
}
function stepItem(step,print=false){
 const checked=st.done.has(step.day);
 return h(print?"div":"button",{
   ...(!print?{type:"button","aria-pressed":String(checked),dataset:{action:"done",value:step.day}}:{}),
   class:"plan-item"+(checked?" done":"")},
   h("span",{class:"num"},String(step.day).padStart(2,"0")),
   h("span",{class:"tick","aria-hidden":"true"},checked?"✓":""),
   h("span",{},h("strong",{},step.action),
       p("Результат: "+step.evidence,"evidence")));
}
function planReport(){
 const items=st.filter==="all"?plan():plan().filter(s=>{
   const [start,end]=ranges[Number(st.filter)]||ranges[0];
   return s.day>=start&&s.day<=end;
 });
 const filters=[["all","Все 30"],...ranges.map((r,i)=>[String(i),r[2]])];
 return h("section",{},heading("h2","План из 30 шагов"),
  p("Работайте в своём темпе. Отметки сохраняются только до обновления вкладки."),
  h("div",{class:"phase-filter no-print",role:"group","aria-label":"Этапы"},
    ...filters.map(([key,title])=>h("button",{type:"button",class:st.filter===key?"selected":"",
     "aria-pressed":String(st.filter===key),dataset:{action:"filter",value:key}},title))),
  h("div",{class:"plan-list"},...items.map(item=>stepItem(item))));
}
function printable(){
 return h("section",{class:"print-only"},heading("h1","Учебный план — MIRONOVICH.PRO"),
  p("Демонстрация по вымышленным данным. Это не персональный анализ настоящим ИИ."),
  heading("h2","Рекомендации"),...selected().map(t=>p(t.title+": "+advice(),"bullet")),
  heading("h2","30 шагов"),h("div",{class:"plan-list"},...plan().map(step=>stepItem(step,true))),
  p("Проверяйте качество и соблюдайте правила доступа. Не используйте чужие персональные данные."));
}
function report(){
 const main=h("div",{class:"no-print"},h("div",{class:"tabbar",role:"tablist","aria-label":"Разделы отчёта"},
   ...[["overview","Обзор"],["tasks","Задачи"],["plan","30 шагов"]].map(([k,title])=>
    h("button",{type:"button",role:"tab",class:"tab"+(st.tab===k?" selected":""),
      "aria-selected":String(st.tab===k),dataset:{action:"tab",value:k}},title))),
   st.tab==="overview"?overview():st.tab==="tasks"?taskReport():planReport());
 const side=h("aside",{class:"report-side no-print"},
  panel(p("ВЫПОЛНЕНО","smallhead"),h("div",{class:"progress-big"},st.done.size+" / 30"),
    h("div",{class:"progress top-gap"},h("span",{style:"width:"+(st.done.size/30*100)+"%"})),
    p("Прогресс хранится только в этой вкладке.","fine"),
    btn("Открыть 30 шагов","show-plan"),btn("Сохранить как PDF / печать","print",true),
    btn("Начать заново","reset")),
  notice());
 return h("section",{},h("div",{class:"report-head no-print"},eyebrow("05 / РЕЗУЛЬТАТ"),
   heading("h1","Учебный план развития","",true),
   p("18 ответов обработаны локальными правилами. Ни запроса к внешнему ИИ, ни отправки данных на сервер не было.","lede")),
   h("div",{class:"report-layout"},main,side),printable());
}
function render(){
 if(!data)return;
 root.replaceChildren(st.page==="intro"?intro():st.page==="checkout"?checkout():
  st.page==="quiz"?quiz():st.page==="tasks"?tasks():report());
}
function navigate(page){
 st.page=page;render();
 window.scrollTo(0,0);
 root.querySelector("#app-title")?.focus({preventScroll:true});
}
root.addEventListener("change",e=>{
 if(e.target.id==="demo-confirm"){st.accepted=Boolean(e.target.checked);render();}
});
root.addEventListener("click",e=>{
 const el=e.target.closest("button[data-action]");
 if(!el||el.disabled||!root.contains(el))return;
 const action=el.dataset.action,value=el.dataset.value;
 if(action==="checkout")return navigate("checkout");
 if(action==="intro")return navigate("intro");
 if(action==="begin"&&st.accepted){st.index=0;return navigate("quiz");}
 if(action==="answer"&&data.questions[st.index].values.includes(value)){
   st.answers[data.questions[st.index].key]=value;return render();
 }
 if(action==="prev"){if(st.index===0)return navigate("checkout");st.index--;return navigate("quiz");}
 if(action==="next"&&st.answers[data.questions[st.index].key]){
   if(st.index===17)return navigate("tasks");st.index++;return navigate("quiz");
 }
 if(action==="back-quiz"){st.index=17;return navigate("quiz");}
 if(action==="task"&&data.tasks.some(t=>t.id===value)){
   if(st.tasks.includes(value)){if(st.tasks.length>1)st.tasks=st.tasks.filter(s=>s!==value);}
   else if(st.tasks.length<5)st.tasks.push(value);
   return render();
 }
 if(action==="results"&&st.tasks.length>=1){st.tab="overview";return navigate("report");}
 if(action==="tab"&&["overview","tasks","plan"].includes(value)){st.tab=value;return render();}
 if(action==="show-plan"){st.tab="plan";st.filter="all";return render();}
 if(action==="filter"&&(value==="all"||["0","1","2","3"].includes(value))){st.filter=value;return render();}
 if(action==="done"){
   const num=Number(value);if(!Number.isInteger(num)||num<1||num>30)return;
   if(st.done.has(num))st.done.delete(num);else st.done.add(num);return render();
 }
 if(action==="print")return window.print();
 if(action==="reset"){st=fresh();return navigate("intro");}
});
fetch("/data.json",{cache:"no-store"})
 .then(r=>{if(!r.ok)throw Error("Missing demo data");return r.json();})
 .then(value=>{
   if(value.demo!==true||value.questions?.length!==18||value.tasks?.length!==5||
       Object.values(value.plans||{}).length!==5||
       Object.values(value.plans).some(p=>p.length!==30))throw Error("Invalid demo dataset");
   data=value;render();
 })
 .catch(()=>{
   root.replaceChildren(panel(eyebrow("СБОЙ ЗАГРУЗКИ"),
     heading("h1","Демоверсия временно недоступна"),
     p("Обновите страницу. Данные диагностики не отправлялись на сервер.")));
 });
