"use strict";
/* Source-grounded interactive REVIEW. No payments, POST, storage, accounts or LLM. */
const root=document.getElementById("app");
const nav=document.getElementById("tabs");
const numbers=document.getElementById("numbers");
const statusEl=document.getElementById("status");
let materials=null;
const sections=[["overview","Что готово"],["diagnostic","18 вопросов"],["curriculum","5 модулей"],["work","24 задачи"],["lesson","Образец урока"]];
const state={section:"overview",qIndex:0,answers:{},moduleId:"safety",roleFilter:"all",lessonTab:"read",quizAnswers:{}};
const el=(tag,attrs={},...children)=>{
 const elem=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){
  if(v===null||v===undefined||v===false)continue;
  if(k==="class")elem.className=v;
  else if(k==="dataset")for(const [key,val] of Object.entries(v))elem.dataset[key]=String(val);
  else if(k==="disabled")elem.disabled=Boolean(v);
  else elem.setAttribute(k,v===true?"":String(v));
 }
 for(const c of children.flat(Infinity)){
  if(c===null||c===false||c===undefined)continue;
  elem.append(c instanceof Node?c:document.createTextNode(String(c)));
 }
 return elem;
};
const P=(t,cls="")=>el("p",{class:cls},t);
const title=(t,level=3)=>el("h"+level,{},t);
const pill=(t,cls="")=>el("span",{class:"badge "+cls},t);
const button=(text,action,value,cls="btn")=>el("button",{type:"button",class:cls,dataset:{action,...(value===undefined?{}:{value})}},text);
const panel=(...children)=>el("article",{class:"panel"},...children);
const cardGrid=(...children)=>el("div",{class:"card-grid"},...children);
const sectionHead=(index,heading,detail)=>el("header",{class:"section-head"},
  P(index,"eyebrow"),title(heading,2),P(detail));
const notice=(txt)=>el("div",{class:"notice"},txt);
const lists=(items,ordered=false)=>el(ordered?"ol":"ul",{},...items.map(x=>el("li",{},x)));
const line=(text)=>el("div",{class:"module-item"},P(text));
const description=(a,b)=>el("div",{class:"panel muted"},el("strong",{},a),P(b));
function setStatus(message){statusEl.textContent=message||"";}
function switchTo(next,scroll=true){
 state.section=next;setStatus("");render();
 if(scroll)document.querySelector(".tabs").scrollIntoView({block:"start",behavior:"instant"});
}
function drawNavigation(){
 nav.replaceChildren(...sections.map(([id,text])=>{
  const b=el("button",{type:"button",role:"tab","aria-selected":String(state.section===id),dataset:{tab:id}},text);
  return b;
 }));
}
function drawNumbers(){
 const {curriculum,diagnostic,role}=materials;
 const stats=[
  [diagnostic.primaryQuestions.length,"основных вопросов"],
  [curriculum.modules.length,"модулей"],
  [curriculum.slots.length,"урока в плане, ещё не опубликованы"],
  [role.tasks.length,"рабочие задачи роли"]
 ];
 numbers.replaceChildren(...stats.map(([n,t])=>el("div",{class:"number"},el("strong",{},n),el("span",{},t))));
}
function overview(){
 const {curriculum,lesson}=materials;
 const cards=curriculum.modules.map((m,i)=>{
  const n=curriculum.slots.filter(s=>s.moduleId===m.id).length;
  return panel(P(String(i+1).padStart(2,"0")+" / ПЛАН МОДУЛЯ","eyebrow"),
    title(m.title),P(m.purpose),P("Ожидаемый результат: "+m.outcome),
    pill(n+" материалов запланировано"));
 });
 return el("div",{},sectionHead("01 / ФАКТИЧЕСКОЕ СОСТОЯНИЕ","Не продаём воздух.",
   "Это просмотр уже записанных данных. Мы честно отделяем готовую методику от учебного содержания, которое ещё предстоит написать."),
  el("div",{class:"notice"},el("b",{},"Сейчас готово: "),
    "структура продукта, матрица профессии, 18 основных вопросов и два условных уточнения, контентный стандарт и один прототип урока. ",
    el("b",{},"Пока не готово: "),"полный курс, 23 утверждённых урока и индивидуальный генератор 30 шагов."),
  el("div",{class:"state-summary"},
   panel(P("КВАЛИФИКАЦИЯ","eyebrow"),title("18 + до 2",3),P("Каждый вопрос связан с выбором уроков, рисками, задачами или результатом. Можно открыть все вопросы, не проходя анкету."),button("Посмотреть вопросы","tab","diagnostic","btn secondary")),
   panel(P("ОБРАЗЕЦ УРОКА","eyebrow"),title(lesson.title,3),P("Прототип на 20 минут: объяснения, два кейса, инструкция, шаблоны, упражнение, тест и самопроверка."),button("Читать образец","tab","lesson"))),
  sectionHead("02 / БУДУЩАЯ БИБЛИОТЕКА","Пять смысловых модулей","Названия и результаты модулей из актуального каталога. Сейчас все 23 урока имеют статус «запланирован»."),cardGrid(...cards),
  sectionHead("03 / ПОКА НЕ ГОТОВО","Что не стоит путать с продуктом","Это редакторский предпросмотр. Нет новых 30 индивидуальных шагов, утверждённого пособия на 10 страниц или нового платного личного кабинета."),
  notice("Ни одна из показанных страниц не запрашивает реальные сведения работодателя, не сохраняет ответы на сервере и не вызывает платёжную систему."));
}
function questionnaire(){
 const diagnostic=materials.diagnostic;
 const all=[...diagnostic.primaryQuestions];
 const trigger=(follow)=>{
  const a=state.answers[follow.showWhen.questionId];
  return follow.showWhen.valueIn.includes(a);
 };
 for(const f of diagnostic.followUps)if(trigger(f))all.push(f);
 const index=Math.min(state.qIndex,all.length-1);
 state.qIndex=index;
 const q=all[index],current=state.answers[q.id];
 const pct=Math.round(100*(index+1)/all.length);
 let options=q.options;
 if(q.kind==="matrix_task_multi"){
  const q3=state.answers.Q03||[],sub=state.answers.Q01||"mixed";
  const stages=diagnostic.optionsSourceRules.matrix_task_multi.areaStageAliases;
  const wanted=new Set(q3.flatMap(a=>stages[a]||[]));
  const selected=materials.role.tasks.filter(t=>
   (sub==="mixed"||t.subtypeIds.includes(sub))&&(wanted.size===0||wanted.has(t.stage)));
  options=selected.slice(0,10).map(t=>({value:t.id,label:t.title}));
  options.push({value:"none_of_these",label:"Ничего не подходит — пока не знаю"});
 }
 const cap=q.maxSelected||1;
 const isSelected=v=>Array.isArray(current)?current.includes(v):current===v;
 const optionNodes=options.map(o=>{
  return el("button",{type:"button",class:"choice"+(isSelected(o.value)?" selected":""),
   "aria-pressed":String(isSelected(o.value)),
   dataset:{action:"answer",id:q.id,value:o.value}},
   el("span",{class:"square","aria-hidden":"true"},isSelected(o.value)?"✓":""),el("span",{},o.label));
 });
 const main=panel(el("div",{class:"row"},P("ВОПРОС "+(index+1)+" / "+all.length,"quiz-count"),
    P(q.section,"quiz-count")),el("div",{class:"progress"},el("span",{style:"width:"+pct+"%"})),
    el("h2",{class:"question"},q.prompt),P(q.help,"help"),
    P(q.kind==="multi"||q.kind==="matrix_task_multi"?
      "Выберите не более "+cap+" вариантов. Можно нажать «Следующий» без ответа для просмотра.": "Выберите один вариант. Ответы используются только для предпросмотра.","minor"),
    el("div",{class:"stack"},...optionNodes),
    el("div",{class:"explain"},el("strong",{},"Зачем этот вопрос: "),q.why),
    el("div",{class:"controls"},
      button("← Назад","qprev",undefined,"btn secondary"),
      button(index===all.length-1?"Завершить просмотр":"Следующий →","qnext")));
 const navNode=panel(P("НАВИГАЦИЯ ПО АНКЕТЕ","eyebrow"),
   el("div",{class:"nav-grid"},...all.map((t,i)=>el("button",{type:"button",class:(i===index?"current ": "")+
     (state.answers[t.id]?"answered":""),dataset:{action:"goto",value:i},
     "aria-label":"Вопрос "+(i+1)},i+1))),
   P("Можно открыть любой вопрос и вернуться. В этом предпросмотре ответы хранятся только пока открыта вкладка. Никакой диагностический отчёт пока не генерируется."),
   el("div",{class:"controls"},button("Сбросить ответы","clear-answers",undefined,"btn small secondary")));
 return el("div",{},sectionHead("01 / ДИАГНОСТИКА","Вопросы, как их увидит человек",
   "Смотрим полный текст, варианты ответов и зачем вопрос нужен. Это предпросмотр спецификации, а не новая платная анкета."),
   notice("Вопросы соответствуют банку на GitHub. Запись в базу данных и генератор личного плана отсутствуют."),
   el("div",{class:"question-layout"},main,el("aside",{class:"question-nav"},navNode)));
}
function curriculum(){
 const {curriculum}=materials;
 const current=curriculum.modules.find(m=>m.id===state.moduleId)||curriculum.modules[0];
 const slots=curriculum.slots.filter(s=>s.moduleId===current.id);
 return el("div",{},sectionHead("01 / ПРОГРАММА","Что человек будет изучать",
    "Библиотека составлена из пяти модулей. 23 позиции пока являются редакционным планом; показывать их как оплаченные уроки рано."),
   el("div",{class:"module-links"},...curriculum.modules.map(m=>
     el("button",{type:"button",class:state.moduleId===m.id?"active":"",dataset:{action:"module",value:m.id}},m.title))),
   panel(P("МОДУЛЬ / РЕДАКТОРСКИЙ ПЛАН","eyebrow"),title(current.title,2),
    P(current.purpose),el("div",{class:"notice"},el("strong",{},"Что должен получить пользователь: "),current.outcome),
    el("div",{class:"item-list"},...slots.map((s,i)=>
      el("div",{class:"item"},el("div",{class:"row"},P("МАТЕРИАЛ "+String(i+1).padStart(2,"0"),"index"),pill("Запланирован","red")),
      title(s.title,4),P(s.scenarioId?"Профессиональный сценарий "+s.scenarioId+" · менеджер продаж":
        "Общий учебный материал. Текст урока пока не написан."))))),
   notice("Только один материал безопасности существует в виде подробного прототипа. Нажмите «Образец урока», чтобы проверить реальный уровень его содержания."));
}
const modes={conditional:"Условная автоматизация части операции",assist:"ИИ-помощник, человек проверяет",human:"Решение остаётся человеку"};
function work(){
 const {role}=materials;
 const view=role.tasks.filter(t=>state.roleFilter==="all"||t.subtypeIds.includes(state.roleFilter));
 return el("div",{},sectionHead("01 / МАТРИЦА ПРОФЕССИИ","Что делает менеджер",
   "Не процент вероятности увольнения, а 24 конкретные задачи: что может выполнять ИИ, какие есть условия и что остаётся под ответственностью человека."),
   el("div",{class:"module-links"},
    el("button",{type:"button",class:state.roleFilter==="all"?"active":"",dataset:{action:"role",value:"all"}},"Все задачи"),
    ...role.subtypes.map(r=>el("button",{type:"button",class:state.roleFilter===r.id?"active":"",dataset:{action:"role",value:r.id}},r.label))),
   el("div",{class:"item-list"},...view.map(t=>
    el("article",{class:"item"},el("div",{class:"row"},P(t.id+" / "+t.stage,"index"),
     pill(modes[t.mode],t.mode==="human"?"dark":t.mode==="conditional"?"red":"")),
    title(t.title,4),el("div",{class:"brief"},
     el("div",{},el("strong",{},"Когда применимо"),el("span",{},t.prerequisites)),
     el("div",{},el("strong",{},"Что проверяет человек"),el("span",{},t.humanResponsibility))),
     P("Сценарий "+t.scenarioId+" · Метрика: "+role.metrics.find(m=>m.id===t.metricId)?.label,"small")))),
   notice("Это экспертная рабочая матрица, не доказательство, что роль можно или нельзя заменить. В реальной компании всё определяется правилами, качеством данных, интеграциями и рисками."));
}
function lessonView(){
 const lesson=materials.lesson,cont=lesson.content;
 const menu=[["read","Введение"],["explanations","Теория"],["cases","Разборы"],["procedure","Инструкция"],
    ["templates","Шаблоны"],["practice","Практика"],["quiz","Проверка"]];
 let body;
 if(state.lessonTab==="read"){
  body=el("div",{},title(cont.introduction.heading,3),
    ...cont.introduction.paragraphs.map(t=>P(t)),
    title("После урока вы сможете",3),lists(lesson.objectives),
    title("Коротко запомнить",3),lists(cont.summary));
 }else if(state.lessonTab==="explanations"){
  body=el("div",{class:"stack"},...cont.explanations.map((x,i)=>panel(P("ОБЪЯСНЕНИЕ "+(i+1),"eyebrow"),title(x.heading),P(x.body),notice("Пример: "+x.example))));
 }else if(state.lessonTab==="cases"){
  body=el("div",{class:"stack"},...cont.workedExamples.map((x,i)=>
   el("article",{class:"case"},P("КЕЙС "+(i+1),"eyebrow"),title(x.title),P(x.situation),
    el("div",{class:"wrong"},title("Небезопасная попытка",4),P(x.unsafeAttempt)),
    el("div",{class:"right"},title("Как сделать безопасно",4),P(x.safeApproach)),
    title("Пример результата",4),P(x.workedOutput),title("Проверка человеком",4),P(x.humanReview))));
 }else if(state.lessonTab==="procedure"){
  body=el("div",{class:"item-list"},...cont.procedure.map((x,i)=>panel(P("ШАГ "+(i+1),"eyebrow"),title(x.title),P(x.instruction),P("Результат: "+x.expectedResult),P("Проверьте: "+x.check,"kicker"))));
 }else if(state.lessonTab==="templates"){
  body=el("div",{class:"stack"},...cont.templates.map(x=>panel(P(x.kind.toUpperCase(),"eyebrow"),title(x.title),P(x.body),
    title("Нельзя подставлять",4),lists(x.prohibitedInputs),
    button("Скопировать учебный шаблон","copy",x.id,"btn secondary"))));
 }else if(state.lessonTab==="practice"){
  body=el("div",{class:"stack"},...cont.exercises.map(ex=>panel(P("УЧЕБНАЯ ПРАКТИКА","eyebrow"),title(ex.title),
   title("Исходные данные",4),P(ex.syntheticInput),
   title("Ваши действия",4),lists(ex.instructions,true),
   title("Что должно получиться",4),P(ex.expectedArtifact),
   title("Самопроверка",4),lists(ex.successCriteria),
   title("Образец результата",4),el("div",{class:"notice"},ex.sampleSolution),
   title("Если возникла ошибка",4),P(ex.feedbackIfIncorrect))));
 }else if(state.lessonTab==="quiz"){
  body=el("div",{class:"stack"},...cont.quiz.map((q,i)=>panel(P("ПРОВЕРОЧНЫЙ ВОПРОС "+(i+1),"eyebrow"),title(q.question,3),
   ...q.options.map(o=>el("button",{type:"button",class:"choice"+
      (state.quizAnswers[q.id]===o.id?" selected":""),dataset:{action:"quizAnswer",id:q.id,value:o.id}},
      el("span",{class:"square","aria-hidden":"true"},state.quizAnswers[q.id]===o.id?"✓":""),o.text)),
   state.quizAnswers[q.id]?
    el("div",{class:"notice"},el("strong",{},state.quizAnswers[q.id]===q.correctId?"Верно. ":"Нужно исправить. "),q.reason):
    P("Выберите вариант — сразу появится объяснение.","muted"))));
 }
 return el("div",{},sectionHead("01 / ОБРАЗЕЦ УРОКА","Это уже написанный текст",
   "Один прототип по безопасности. Его содержание можно прочитать целиком, разобрать упражнение и пройти контрольные вопросы."),
   notice("Этот урок помечен как ПРОТОТИП. Он пока не прошёл финальное экспертное и правовое ревью и не равен десятистраничному пособию."),
   panel(el("div",{class:"row"},P("ПРИМЕР · "+lesson.id+" / 20 МИНУТ","eyebrow"),pill("Прототип","red")),
     title(lesson.title,2),P(lesson.summary),
     el("div",{class:"brief"},description("Аудитория","Менеджер по продажам: исходящие, входящие, сопровождение"),
     description("Итог","Проверенное учебное резюме звонка без настоящих клиентских сведений"))),
   el("div",{class:"module-links",style:"margin:20px 0"},...menu.map(([id,label])=>
    el("button",{type:"button",class:state.lessonTab===id?"active":"",dataset:{action:"lesson",value:id}},label))),
   el("div",{class:"panel"},body),
   notice("Фактический модуль безопасности на ~10 страниц с дополнительными ситуациями и PDF ещё не написан. Эта демонстрация позволяет проверить только стандарт одного урока."));
}
function render(){
 drawNavigation();
 root.replaceChildren(state.section==="overview"?overview():state.section==="diagnostic"?questionnaire():
   state.section==="curriculum"?curriculum():state.section==="work"?work():lessonView());
}
nav.addEventListener("click",ev=>{
 const b=ev.target.closest("button[data-tab]");if(b)switchTo(b.dataset.tab);
});
root.addEventListener("click",async ev=>{
 const b=ev.target.closest("button[data-action]");
 if(!b)return;
 const a=b.dataset.action,v=b.dataset.value;
 if(a==="tab"){switchTo(v);return;}
 if(a==="module"){state.moduleId=v;render();return;}
 if(a==="role"){state.roleFilter=v;render();return;}
 if(a==="lesson"){state.lessonTab=v;render();return;}
 if(a==="goto"){state.qIndex=Number(v);render();return;}
 if(a==="qprev"){state.qIndex=Math.max(0,state.qIndex-1);render();return;}
 if(a==="qnext"){
  let total=materials.diagnostic.primaryQuestions.length;
  for(const f of materials.diagnostic.followUps)
   if(f.showWhen.valueIn.includes(state.answers[f.showWhen.questionId]))total++;
  if(state.qIndex+1>=total){switchTo("curriculum");return;}
  state.qIndex++;render();return;
 }
 if(a==="clear-answers"){state.answers={};state.qIndex=0;render();return;}
 if(a==="answer"){
  const q=[...materials.diagnostic.primaryQuestions,...materials.diagnostic.followUps].find(x=>x.id===b.dataset.id);
  if(!q)return;
  if(q.kind==="single"){state.answers[q.id]=v;}
  else{
   const arr=Array.isArray(state.answers[q.id])?[...state.answers[q.id]]:[];
   const exclusive=[...(q.exclusiveOptions||[])];if(q.kind==="matrix_task_multi")exclusive.push("none_of_these");
   if(exclusive.includes(v))state.answers[q.id]=[v];
   else if(arr.includes(v))state.answers[q.id]=arr.filter(x=>x!==v);
   else{
    const next=arr.filter(x=>!exclusive.includes(x));
    if(next.length >= (q.maxSelected||1)){setStatus("Можно выбрать не более "+q.maxSelected+" вариантов");return;}
    state.answers[q.id]=[...next,v];
   }
  }
  if(q.id==="Q01"||q.id==="Q03")delete state.answers.Q04;
  setStatus("");render();return;
 }
 if(a==="quizAnswer"){state.quizAnswers[b.dataset.id]=v;render();return;}
 if(a==="copy"){
  const item=materials.lesson.content.templates.find(x=>x.id===v);
  if(!item)return;
  try{
   await navigator.clipboard.writeText(item.body);
   setStatus("Учебный шаблон скопирован. Не вставляйте реальные данные работодателя.");
  }catch{setStatus("Не удалось скопировать. Выделите текст шаблона вручную.");}
 }
});
Promise.all([
 fetch("/v3-curriculum.json",{cache:"no-store"}),
 fetch("/v3-diagnostic.json",{cache:"no-store"}),
 fetch("/v3-safety-prototype.json",{cache:"no-store"}),
 fetch("/v3-sales-role.json",{cache:"no-store"})
]).then(async responses=>{
 if(responses.some(r=>!r.ok))throw Error("Source files missing");
 const [curriculum,diagnostic,lesson,role]=await Promise.all(responses.map(r=>r.json()));
 if(curriculum.slots?.length!==23||diagnostic.primaryQuestions?.length!==18||
   role.tasks?.length!==24||lesson.id!=="SAF-01-EX"||lesson.status!=="prototype"||
   curriculum.usableForPaidUser!==false)throw Error("Wrong version of materials");
 materials={curriculum,diagnostic,lesson,role};
 drawNumbers();render();
}).catch(()=>{
 setStatus("Предпросмотр не загрузился. Попробуйте обновить страницу. Никакие ответы на сервер не отправлялись.");
 root.replaceChildren(panel(title("Материалы недоступны"),P("Откройте исходные файлы GitHub внизу страницы.")));
});