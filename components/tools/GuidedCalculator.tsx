"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { calculateGuided, DEFAULT_EMPLOYEES, EMPLOYEE_PRESETS, GUIDED_VERSION, impacts, initialGuided, parseGuided, systems, taskLabels, type GuidedInput, type Measurement, type Task } from "@/lib/tools/guided";
import { recommendationCards, startSteps } from "@/lib/tools/catalog";
import { decodeGuidedTransfer, encodeGuidedTransfer, GUIDED_STORAGE_KEY } from "@/lib/tools/storage";
import { parseDecimal } from "@/lib/tools/input";
import { buttonClass, controlClass, numberText, rubles } from "./Fields";
import ToolLead from "./ToolLead";
import { GuidedResultCards } from "./AutomationResult";
import ProcessAnalysis from "./ProcessAnalysis";

type MeasureDraft={employees:string;frequency:Measurement["frequency"];repetitions:string;minutes:string;periodsPerMonth:string;hourlyCost:string;independent:boolean};
const emptyMeasure=(employees:string):MeasureDraft=>({employees,frequency:"month",repetitions:"",minutes:"",periodsPerMonth:"1",hourlyCost:"",independent:false});
const fromInput=(i:GuidedInput)=>Object.fromEntries(Object.entries(i.measurements).map(([k,m])=>[k,{...m,employees:String(m.employees),repetitions:String(m.repetitions),minutes:String(m.minutes),periodsPerMonth:String(m.periodsPerMonth),hourlyCost:m.hourlyCost===null?"":String(m.hourlyCost)}])) as Partial<Record<Task,MeasureDraft>>;

export default function GuidedCalculator({mode,openAiAvailable=false,processAnalysisMode="off"}:{mode:"labor-cost"|"automation-cost";openAiAvailable?:boolean;processAnalysisMode?:"off"|"mock"|"live"}) {
 const [tasks,setTasks]=useState<Task[]>([]),[employees,setEmployees]=useState(String(DEFAULT_EMPLOYEES));
 const [selectedSystems,setSystems]=useState<GuidedInput["systems"]>([]),[impact,setImpact]=useState<GuidedInput["impact"]>("unknown");
 const [description,setDescription]=useState("");
 const [measures,setMeasures]=useState<Partial<Record<Task,MeasureDraft>>>({});
 const [result,setResult]=useState<GuidedInput|null>(null),[cards,setCards]=useState<ReturnType<typeof recommendationCards>>([]);
 const [error,setError]=useState(""),[transferError,setTransferError]=useState("");
 const [notice,setNotice]=useState(false),[busy,setBusy]=useState(false),[aiStatus,setAiStatus]=useState("");
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  if(mode!=="automation-cost")return;
  try{const value=decodeGuidedTransfer(sessionStorage.getItem(GUIDED_STORAGE_KEY));if(value){setTasks(value.tasks);setEmployees(String(value.employees));setSystems(value.systems);setImpact(value.impact);setMeasures(fromInput(value));setResult(value);setCards(recommendationCards(value));}}catch{/* browser storage is optional */}
 },[mode]);
 function toggle(task:Task){setTasks(old=>old.includes(task)?old.filter(t=>t!==task):[...old,task]);setMeasures(old=>{const next={...old};delete next[task];return next;});setError("");}
 function measure(task:Task,key:keyof MeasureDraft,value:string|boolean){setMeasures(old=>({...old,[task]:{...(old[task]??emptyMeasure(employees)),[key]:value}}));}
 function build():GuidedInput|null {
  const input={...initialGuided(),tasks,employees:parseDecimal(employees),systems:selectedSystems,impact,measurements:{} as GuidedInput["measurements"]};
  for(const task of tasks){const m=measures[task];if(!m||(m.repetitions===""&&m.minutes===""&&m.hourlyCost===""))continue;
   input.measurements[task]={employees:parseDecimal(m.employees),frequency:m.frequency,repetitions:parseDecimal(m.repetitions),minutes:parseDecimal(m.minutes),periodsPerMonth:parseDecimal(m.periodsPerMonth),hourlyCost:m.hourlyCost===""?null:parseDecimal(m.hourlyCost),independent:m.independent};}
  const clean=parseGuided(input);
  if(!clean){setError(!tasks.length?"Выберите хотя бы одну задачу.":"Проверьте числа: сотрудников от 1 до 10 000; участники процесса — не больше команды. Для уточнённого процесса заполните частоту и минуты; пустой расчёт можно оставить без оценки. Объём не должен превышать 744 часа на человека в месяц.");return null;}
  return clean;
 }
 function show(input:GuidedInput){setError("");setResult(input);setCards(recommendationCards(input));setAiStatus("");requestAnimationFrame(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:"start"});});}
 async function askAI(){
  if(!openAiAvailable)return;
  if(!notice){setError("Прочитайте уведомление и подтвердите передачу выбранных обезличенных параметров.");return;}
  const input=result??build();if(!input)return;if(!result)show(input);
  setBusy(true);setAiStatus("OpenAI уточняет порядок задач и подходы. Базовая рекомендация остаётся доступной.");
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),16000);
  try{
   const response=await fetch("/api/tools/recommendation",{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({noticeAccepted:true,input:{tasks:input.tasks,employees:input.employees,systems:input.systems,impact:input.impact}})});
   const data=await response.json();
   if(response.ok&&data.ok&&Array.isArray(data.cards)){setCards(data.cards);setAiStatus("OpenAI предложил приоритеты и подходы из каталога. Произвольное описание бизнеса не анализировалось.");}
   else setAiStatus(typeof data.error==="string"?data.error:"ИИ-разбор недоступен. Базовый результат сохранён.");
  }catch{setAiStatus("ИИ-разбор недоступен или истекло время ожидания. Базовый результат сохранён.");}
  finally{clearTimeout(timer);setBusy(false);}
 }
 const aiBlock=openAiAvailable?<details className="mt-6 border border-cream/20 p-4"><summary className="min-h-[44px] cursor-pointer py-2 text-cream">Приоритеты с OpenAI</summary>
  <p className="text-sm leading-relaxed">OpenAI расставляет приоритеты выбранных задач и выбирает подход из каталога. Модель пока не анализирует произвольное описание бизнеса — это не индивидуальная ИИ-диагностика.</p>
  <p id="ai-notice" className="text-sm leading-relaxed text-stone">По вашему действию сайт отправит в OpenAI только категории задач, число сотрудников, выбранные типы программ и последствия ошибки. Описание, контакты, документы, пароли и расчёт стоимости не передаются. Не вводите чувствительные сведения. Можно пользоваться базовым результатом без OpenAI. <Link href="/privacy" className="underline">Политика обработки данных</Link>.</p>
  <label className="my-4 flex min-h-[48px] items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#D92D2D]" checked={notice} onChange={e=>setNotice(e.target.checked)} aria-describedby="ai-notice"/><span>Я прочитал уведомление и хочу отправить выбранные обезличенные параметры в OpenAI</span></label>
  <button type="button" disabled={!notice||busy} className="min-h-[48px] border border-cream/40 px-5 py-3 disabled:opacity-50" onClick={askAI}>{busy?"Уточняем приоритеты…":"Уточнить приоритеты с OpenAI"}</button>
  <p role="status" className="text-sm text-stone">{aiStatus||"Базовая рекомендация доступна без OpenAI. Если модель недоступна, она сохранится."}</p>
 </details>:null;
 const summary=result?calculateGuided(result):null;
 if(result&&summary)return <section aria-label="Результат разбора процессов" className="mx-auto max-w-[980px] text-cream">
  <div className="border border-cream/20 p-5 min-[560px]:p-8"><p className="text-xs uppercase tracking-widest text-stone">По выбранным задачам · без заявки</p>
   <h2 ref={heading} tabIndex={-1} className="tool-result-heading scroll-mt-24 break-normal font-display text-[clamp(28px,4vw,40px)] font-extrabold uppercase leading-tight">С чего начать</h2>
   <p className="text-sm leading-relaxed text-stone">Выберите один процесс для небольшого пилота. Команда: {result.employees}.</p>
   {description&&<details className="mt-4 text-sm"><summary className="min-h-[44px] cursor-pointer py-2">{openAiAvailable?"Ваше описание — без ИИ-анализа":"Ваше описание"}</summary><p className="break-words text-stone">{description}</p><p className="text-stone">Описание остаётся на странице для уточнения задачи.{openAiAvailable&&" OpenAI его не получает и не анализирует."}</p></details>}
   <GuidedResultCards cards={cards} />
   <details className="mt-5 border-b border-cream/20"><summary className="min-h-[56px] cursor-pointer py-4 text-base font-medium">Как выбрать подход и провести пилот</summary>
    <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-stone">{[...new Map(cards.map(card=>[card.type,card.reason])).entries()].map(([type,reason])=><li key={type}><span className="text-cream">{type}.</span> {reason}</li>)}</ul>
    <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-stone">{startSteps.map(step=><li key={step}>{step}</li>)}</ol>
    <p className="pb-4 text-sm leading-relaxed text-stone">Для пилота нужны ответственный за процесс, пример без персональных данных и критерии приёмки. Действия, влияющие на деньги, клиентов или доступ к данным, подтверждает человек.</p>
   </details>
   <details aria-label="Измеренные трудозатраты" className="border-b border-cream/20"><summary className="min-h-[56px] cursor-pointer py-4 text-base font-medium">Время и стоимость — отдельно</summary>
    {summary.rows.map(row=><div key={row.task} className="border-b border-cream/10 py-3 text-sm"><p className="m-0 font-medium">{taskLabels[row.task]}</p><p className="mb-0 text-stone">{row.hours===null?"Время пока не измерено — числовой оценки нет.":`${numberText(row.hours)} ч ручной работы в месяц · ${row.cost===null?"стоимость часа не указана":rubles(row.cost)+" стоимости рабочего времени в месяц"}`}</p>{row.warning&&<p role="alert" className="text-signal">Более 200 часов на участника процесса в месяц. Проверьте частоту, длительность и повторный учёт. Это диагностический порог, не норма рабочего времени.</p>}</div>)}
    <p className="text-sm">{summary.totalHours===null?"Общий итог не сводится: нужны корректные замеры и подтверждение независимости операций.":`Итого по ${summary.counted} измеренным независимым процессам: ${numberText(summary.totalHours)} ч/мес.${summary.totalCost===null?" Стоимость полного итога неизвестна.":" Стоимость рабочего времени: "+rubles(summary.totalCost)+"/мес."}`}</p>
    {summary.overCapacity&&<p role="alert" className="text-sm text-signal">Суммарная нагрузка превышает 200 часов на сотрудника команды. Проверьте пересечения процессов.</p>}
    <p className="text-sm leading-relaxed text-stone">Возможное высвобождение времени определяется после пилота. Реальная денежная экономия отдельно не подтверждена. Стоимость рабочего времени не равна экономии; процент автоматизации не подставляется.</p>
   </details>
   {aiBlock}
   <div className="mt-6 flex flex-wrap gap-4"><button type="button" disabled={busy} className="min-h-[48px] underline" onClick={()=>{setResult(null);setNotice(false);setAiStatus("");}}>Изменить выбор и уточнить описание</button><button type="button" disabled={busy} className="min-h-[48px] underline" onClick={()=>{setCards(recommendationCards(result));setAiStatus("Базовая рекомендация обновлена.");}}>Обновить базовые рекомендации</button></div>
   {mode==="labor-cost"&&<><Link href="/tools/automation-cost" className="mt-4 inline-flex min-h-[48px] items-center underline" onClick={e=>{try{sessionStorage.setItem(GUIDED_STORAGE_KEY,encodeGuidedTransfer(result));}catch{e.preventDefault();setTransferError("Хранилище вкладки недоступно. Разбор показан здесь; откройте второй инструмент и выберите задачи заново.");}}}>Продолжить разбор автоматизации →</Link>{transferError&&<p role="alert" className="text-sm text-signal">{transferError}</p>}</>}
   {mode==="automation-cost"&&processAnalysisMode!=="off"&&<ProcessAnalysis tasks={result.tasks} mode={processAnalysisMode} />}
   <ToolLead context={{tool:mode,version:GUIDED_VERSION,input:result,guided:true}} description={description} actionPlan buttonLabel={mode==="automation-cost"&&processAnalysisMode!=="off"?"Обсудить внедрение":undefined} />
  </div>
 </section>;
 return <div className="mx-auto max-w-[980px] border border-cream/20 p-5 text-cream min-[560px]:p-8">
  <form noValidate onSubmit={e=>{e.preventDefault();const input=build();if(input)show(input);}}>
   <fieldset><legend className="mb-4 text-lg font-medium">Выберите повторяющиеся задачи — можно несколько</legend>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(taskLabels).map(([key,label],index)=><label key={key} className={"flex min-h-[86px] cursor-pointer items-center gap-3 border p-4 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal "+(tasks.includes(key as Task)?"border-signal bg-signal/10":"border-cream/25")}><input type="checkbox" name="tasks" value={key} className="h-5 w-5 shrink-0 accent-[#D92D2D]" checked={tasks.includes(key as Task)} onChange={()=>toggle(key as Task)}/><span><span className="mb-1 block text-[10px] tracking-widest text-stone">{String(index+1).padStart(2,"0")}</span>{label}</span></label>)}</div>
   </fieldset>
   {(tasks.includes("other")||mode==="automation-cost")&&<div className="mt-5"><label htmlFor="guided-description" className="mb-2 block text-sm">Опишите задачу своими словами — необязательно</label><textarea id="guided-description" value={description} maxLength={400} className={controlClass+" min-h-[100px] py-3"} onChange={e=>{setDescription(e.target.value);if(e.target.value.trim()&&!tasks.length)setTasks(["other"]);}} aria-describedby="description-note"/><p id="description-note" className="text-xs text-stone">Без контактов, паролей и данных клиентов. Описание остаётся в памяти страницы до вашего согласия на отправку заявки. {openAiAvailable?"OpenAI его пока не анализирует: текущие рекомендации основаны на выбранных категориях.":"Рекомендации основаны на выбранных категориях."}</p></div>}
   <fieldset className="mt-7"><legend className="text-lg font-medium">Сколько сотрудников в команде?</legend><p className="text-sm text-stone">Считаем от одного человека. Участников каждой задачи можно уточнить отдельно.</p><div className="flex flex-wrap items-center gap-2">{EMPLOYEE_PRESETS.map(n=><button type="button" key={n} aria-pressed={employees===String(n)} onClick={()=>setEmployees(String(n))} className={"min-h-[48px] min-w-[52px] border px-3 "+(employees===String(n)?"border-signal bg-signal/10":"border-cream/30")}>{n}</button>)}<label className="ml-1 text-sm" htmlFor="guided-employees">Точное число</label><input id="guided-employees" inputMode="numeric" value={employees} maxLength={5} onChange={e=>setEmployees(e.target.value)} className={controlClass+" w-[95px]"}/></div></fieldset>
   {mode==="automation-cost"&&<details className="mt-6 border-t border-cream/20 pt-4"><summary className="min-h-[44px] cursor-pointer py-2">Два уточнения — если знаете ответы</summary><fieldset><legend className="mb-3">Какие программы используете?</legend><div className="grid gap-2 sm:grid-cols-2">{Object.entries(systems).map(([key,label])=><label key={key} className="flex min-h-[48px] items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#D92D2D]" checked={selectedSystems.includes(key as GuidedInput["systems"][number])} onChange={()=>setSystems(old=>{const k=key as GuidedInput["systems"][number];return old.includes(k)?old.filter(x=>x!==k):["none","unknown"].includes(k)?[k]:[...old.filter(x=>!["none","unknown"].includes(x)),k];})}/>{label}</label>)}</div></fieldset><label htmlFor="guided-impact" className="mb-2 mt-5 block text-sm">Что будет, если автоматизация ошибётся?</label><select id="guided-impact" className={controlClass} value={impact} onChange={e=>setImpact(e.target.value as GuidedInput["impact"])}>{Object.entries(impacts).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></details>}
   <details className="mt-7 border-y border-cream/20 py-3"><summary className="min-h-[44px] cursor-pointer py-2 text-base">Уточнить расчёт времени — необязательно</summary><p className="text-sm leading-relaxed text-stone">Без замеров покажем рекомендации без часов и рублей. Число повторений — на одного участника процесса. Учитывайте каждую операцию только в одном процессе.</p>
    {!tasks.length&&<p className="text-sm">Сначала выберите задачи выше.</p>}
    {tasks.map(task=>{const m=measures[task]??emptyMeasure(employees);const field=(key:"employees"|"repetitions"|"minutes"|"periodsPerMonth"|"hourlyCost",label:string)=><div><label htmlFor={`${task}-${key}`} className="mb-2 block text-xs">{label}</label><input id={`${task}-${key}`} inputMode="decimal" value={m[key]} maxLength={12} onChange={e=>measure(task,key,e.target.value)} className={controlClass}/></div>;
     return <fieldset className="my-5 min-w-0 border border-cream/20 p-4" key={task}><legend className="px-2 font-medium">{taskLabels[task]}</legend><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{field("employees","Сотрудников выполняют задачу")}<div><label htmlFor={`${task}-frequency`} className="mb-2 block text-xs">Период повторения</label><select id={`${task}-frequency`} className={controlClass} value={m.frequency} onChange={e=>setMeasures(old=>({...old,[task]:{...m,frequency:e.target.value as Measurement["frequency"],periodsPerMonth:e.target.value==="month"?"1":""}}))}><option value="day">В день</option><option value="week">В неделю</option><option value="month">В месяц</option></select></div>{field("repetitions","Повторений на человека за период")}{field("minutes","Минут на одно выполнение")}{m.frequency!=="month"&&field("periodsPerMonth",m.frequency==="day"?"Рабочих дней в этом месяце":"Рабочих недель в этом месяце")}{field("hourlyCost","Стоимость часа, ₽ — необязательно")}</div><label className="mt-4 flex min-h-[48px] items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#D92D2D]" checked={m.independent} onChange={e=>measure(task,"independent",e.target.checked)}/><span>Подтверждаю: эти операции не учтены в других выбранных процессах</span></label></fieldset>;})}
   </details>
   {error&&<p role="alert" className="mt-4 border-l-2 border-signal pl-3 text-sm">{error}</p>}
   <button type="submit" className={buttonClass+" mt-6 w-full"}>Узнать, что можно автоматизировать</button><p className="mb-0 text-center text-xs leading-relaxed text-stone">Без зарплат, технических вопросов и обязательной заявки. {openAiAvailable?"Базовый разбор работает без OpenAI.":"Без передачи данных во внешние ИИ-сервисы."}</p>
  </form>{aiBlock}
 </div>;
}
