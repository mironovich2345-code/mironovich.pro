"use client";
import { useMemo, useState } from "react";
import type { Company, Process, Range } from "../../lib/business-map/contracts";
import { calculateBusinessMap, parseBusinessMap } from "../../lib/business-map/index";
import { parseDecimal } from "../../lib/tools/input";
import { NumberField, SelectField, Callout, tabKeys } from "./shared";
import { rubles, show, systemNames, inputError } from "./presentation";

type Tab="quick"|"fit"|"economics";
const costLabels={implementation:"Внедрение, ₽ разово",training:"Обучение, ₽ разово",licenses:"Лицензии, ₽/мес.",maintenance:"Поддержка, ₽/мес.",external:"Внешние расходы, ₽/мес."};
const optionalNumber=(s:string)=>s.trim()===""?null:parseDecimal(s);
export default function ProcessEditor({ initial, company, allProcesses, initialTab="quick", onSave, onCancel }: { initial: Process; company: Company; allProcesses: Process[]; initialTab?: Tab; onSave: (process: Process) => void; onCancel: () => void }) {
  const [tab,setTab]=useState<Tab>(initialTab);
  const [data,setData]=useState(initial);
  const [numbers,setNumbers]=useState({employees:initial.employees?.toString()??"",operations:initial.operations?.toString()??"",minutes:initial.minutes?.toString()??"",hourlyRate:initial.hourlyRate?.toString()??"",minMinutes:initial.minutesRange?.[0].toString()??"",maxMinutes:initial.minutesRange?.[1].toString()??"",monthlyHours:initial.monthlyHours?.toString()??"",replaceableHours:initial.cash?.replaceableHours.toString()??"",replacementRate:initial.cash?.replacementRate.toString()??"",cancelledPayments:initial.cash?.cancelledPayments.toString()??"0",capacityRevenue:initial.capacityRevenue?.toString()??""});
  const [cashEnabled,setCashEnabled]=useState(!!initial.cash);
  const [disposition,setDisposition]=useState<NonNullable<Process["cash"]>["disposition"]>(initial.cash?.disposition??"retained");
  const [costs,setCosts]=useState<Record<string,[string,string]>>(Object.fromEntries(Object.keys(costLabels).map(k=>{const r=initial.costs?.[k as keyof typeof costLabels];return [k,[r?.[0].toString()??"",r?.[1].toString()??""]];})));
  const [submitted,setSubmitted]=useState(false);
  const set=(key:keyof typeof numbers,value:string)=>setNumbers(n=>({...n,[key]:value}));
  const patch=(p:Partial<Process>)=>setData(d=>({...d,...p}));
  const candidate=useMemo(()=>{
    const p:Process={...data,employees:optionalNumber(numbers.employees),operations:optionalNumber(numbers.operations),minutes:optionalNumber(numbers.minutes),hourlyRate:optionalNumber(numbers.hourlyRate),capacityRevenue:optionalNumber(numbers.capacityRevenue)};
    if(numbers.monthlyHours.trim()) p.monthlyHours=parseDecimal(numbers.monthlyHours); else delete p.monthlyHours;
    if(numbers.minMinutes.trim()||numbers.maxMinutes.trim())p.minutesRange=[parseDecimal(numbers.minMinutes),parseDecimal(numbers.maxMinutes)];else delete p.minutesRange;
    if(cashEnabled)p.cash={disposition,replaceableHours:disposition==="retained"?0:parseDecimal(numbers.replaceableHours),replacementRate:disposition==="retained"?0:parseDecimal(numbers.replacementRate),cancelledPayments:parseDecimal(numbers.cancelledPayments)};else delete p.cash;
    p.costs=Object.fromEntries(Object.entries(costs).filter(([,r])=>r.some(v=>v.trim()!=="")).map(([k,r])=>[k,r.map(parseDecimal) as unknown as Range]));
    if(!Object.keys(p.costs).length)delete p.costs;
    return p;
  },[data,numbers,cashEnabled,disposition,costs]);
  const parsed=useMemo(()=>parseBusinessMap({company,processes:[...allProcesses.filter(p=>p.id!==initial.id),candidate]}),[company,allProcesses,initial.id,candidate]);
  const preview=useMemo(()=>{
    if(!parsed.ok)return null;
    try{return calculateBusinessMap(parsed.value).processes.find(p=>p.id===initial.id)??null;}catch{return null;}
  },[parsed,initial.id]);
  const numeric=(key:keyof typeof numbers,label:string,hint?:string,optional=false)=> <NumberField label={label} value={numbers[key]} onChange={v=>set(key,v)} hint={hint} optional={optional} error={!parsed.ok?Object.entries(parsed.errors).filter(([path])=>path.endsWith(`.${key}`)).map(([,message])=>inputError(message))[0]:undefined}/>;
  const select=<K extends "mechanical"|"regulation"|"exceptions"|"error"|"judgment"|"access"|"personalData"|"source"|"period">(key:K,label:string,options:Record<string,string>)=><SelectField label={label} value={data[key]} options={options} onChange={v=>patch({[key]:v})}/>;
  const save=()=>{
    setSubmitted(true);
    if(!parsed.ok||!preview){document.getElementById("bm-editor-errors")?.focus();return;}
    onSave(parsed.value.processes.find(p=>p.id===initial.id)!);
  };
  return <form className="bm-form" autoComplete="off" onSubmit={e=>{e.preventDefault();save();}}>
    <div className="bm-form-intro"><p className="bm-eyebrow">Процесс / {allProcesses.some(p=>p.id===initial.id)?"Редактирование":"Новый"}</p><h1>{tab==="quick"?"Сколько времени уходит?":tab==="fit"?"Что можно автоматизировать?":"Что изменится в расходах?"}</h1><p>Начните с частоты и времени. Остальные ответы можно уточнять по мере проверки.</p></div>
    <div className="bm-tabs" role="tablist" aria-label="Данные процесса" onKeyDown={tabKeys}>{([["quick","1. Время"],["fit","2. Пригодность"],["economics","3. Деньги"]] as const).map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} tabIndex={tab===key?0:-1} aria-controls={`bm-panel-${key}`} id={`bm-tab-${key}`} onClick={()=>{setTab(key);setSubmitted(false);}}>{label}</button>)}</div>
    <div role="tabpanel" id={`bm-panel-${tab}`} aria-labelledby={`bm-tab-${tab}`}>
    {tab==="quick"&&<>
      <label className="bm-field"><span>Название процесса</span><input autoFocus maxLength={80} value={data.name} onChange={e=>patch({name:e.target.value})} placeholder="Например, сбор отчётов"/></label>
      <div className="bm-field-grid">{numeric("employees","Сколько человек участвуют?","1–50 человек. Пустое поле — не знаю.")}{numeric("operations","Сколько выполнений всей командой?","Общее число команды, не на одного сотрудника. Пустое поле — не знаю.")}
        {select("period","За какой период?",{day:"В день",week:"В неделю",month:"В месяц"})}{numeric("minutes","Минут на одну операцию","От 1 до 600. Пустое поле — не знаю.")}
        {select("source","Откуда известно время?",{estimate:"Примерная оценка",measured:"Измерено",unknown:"Пока не знаю"})}
      </div>
      <details className="bm-disclosure"><summary>Описание и диапазон времени</summary><label className="bm-field"><span>Что на входе и на выходе?</span><textarea maxLength={300} value={data.description??""} onChange={e=>patch({description:e.target.value})}/></label><div className="bm-field-grid">{numeric("minMinutes","Минимум минут на операцию",undefined,true)}{numeric("maxMinutes","Максимум минут на операцию",undefined,true)}</div></details>
      <label className="bm-checkbox"><input type="checkbox" checked={data.independent} onChange={e=>patch({independent:e.target.checked})}/><span>Эти операции не учитываются в других процессах карты</span></label>
      {allProcesses.filter(p=>p.id!==initial.id).length>0&&<fieldset className="bm-options"><legend>Есть пересечения с другими процессами?</legend>{allProcesses.filter(p=>p.id!==initial.id).map(p=><label className="bm-checkbox" key={p.id}><input type="checkbox" checked={data.overlapsWith.includes(p.id)} onChange={e=>patch({overlapsWith:e.target.checked?[...data.overlapsWith,p.id]:data.overlapsWith.filter(id=>id!==p.id)})}/><span>{p.name}</span></label>)}</fieldset>}
    </>}
    {tab==="fit"&&<>
      <div className="bm-field-grid">
        {select("mechanical","Доля механических шагов",{unknown:"Не знаю",under25:"Меньше 25%",from25to50:"25–50%",from50to75:"50–75%",over75:"Больше 75%"})}
        {select("exceptions","Доля нестандартных случаев",{unknown:"Не знаю",under10:"Меньше 10%",from10to30:"10–30%",from30to50:"30–50%",over50:"Больше 50%"})}
        {select("regulation","Есть письменный регламент?",{unknown:"Не знаю",yes:"Да",partial:"Частично",no:"Нет"})}
        {select("judgment","Нужно человеческое суждение?",{unknown:"Не знаю",rare:"Почти нет",sometimes:"Иногда",mostly:"В большинстве случаев"})}
      </div>
      <fieldset className="bm-options"><legend>Где выполняется процесс?</legend><div className="bm-check-grid">{Object.entries(systemNames).filter(([k])=>k!=="none").map(([key,label])=><label key={key}><input type="checkbox" checked={data.systems?.includes(key)??false} onChange={e=>{
        const next=e.target.checked?[...(data.systems??[]),key]:(data.systems??[]).filter(k=>k!==key);
        patch({systems:next.length?next:null,...((key==="paper"||key==="voice")&&e.target.checked?{access:"manual" as const}:{})});
      }}/><span>{label}</span></label>)}</div><small>Не выбрано — пока неизвестно. Учитываются только системы этого процесса.</small></fieldset>
      <div className="bm-field-grid">
        {select("access","Можно получить исходные данные?",{unknown:"Не знаю",available:"Есть выгрузка или API",manual:"Только вручную"})}
        {select("error","Что произойдёт при ошибке?",{unknown:"Не знаю",minor:"Незначительные последствия",noticeable:"Исправим в течение дня",serious:"Деньги, клиент или штраф",critical:"Критические последствия"})}
        {select("personalData","Есть персональные данные?",{unknown:"Не знаю",no:"Нет",yes:"Да"})}
      </div>
      <Callout>Процент высвобождения не выводится из суммы баллов. Механическая доля, исключения, сложность и риск оцениваются отдельно.</Callout>
    </>}
    {tab==="economics"&&<>
      <div className="bm-field-grid">{numeric("hourlyRate","Полная стоимость часа, ₽","Если введена, зарплата компании и начисления повторно не применяются.",true)}{numeric("monthlyHours","Рабочих часов на человека в месяц","Если отличается от графика компании. По умолчанию 165 [Г].",true)}</div>
      <label className="bm-checkbox"><input type="checkbox" checked={cashEnabled} onChange={e=>setCashEnabled(e.target.checked)}/><span>Известно, какие денежные платежи реально отменим</span></label>
      {cashEnabled&&<><SelectField label="Что будет с освободившимся временем?" value={disposition} onChange={v=>setDisposition(v as typeof disposition)} options={{retained:"Останется у сотрудников", "avoid-hire":"Избежим внешнего найма / сверхурочных","reduce-contractor":"Сократим внешний подряд"}}/>
        {disposition!=="retained"&&<div className="bm-field-grid">{numeric("replaceableHours","Отменяемых часов в месяц")}{numeric("replacementRate","Ставка отменяемого ресурса, ₽/ч")}</div>}
        {numeric("cancelledPayments","Другие подтверждённые отменяемые платежи, ₽/мес.","Не включайте сюда зарплаты сотрудников, которые сохранятся.")}
      </>}
      <fieldset className="bm-options"><legend>Затраты на внедрение и эксплуатацию</legend><p>Неизвестное оставьте пустым. Если расходов точно нет, введите 0 в обе границы.</p><div className="bm-cost-grid">{Object.entries(costLabels).map(([key,label])=><fieldset key={key}><legend>{label}</legend><div className="bm-field-grid"><NumberField label={`${label}: от`} value={costs[key][0]} onChange={v=>setCosts(c=>({...c,[key]:[v,c[key][1]]}))}/><NumberField label={`${label}: до`} value={costs[key][1]} onChange={v=>setCosts(c=>({...c,[key]:[c[key][0],v]}))}/></div></fieldset>)}</div></fieldset>
      {numeric("capacityRevenue","Дополнительный эффект ёмкости, ₽/мес.","Ваша отдельная оценка. Не прибавляется к денежной экономии и окупаемости.",true)}
    </>}
    </div>
    {preview&&<div className="bm-live-preview" aria-live="polite"><span className="bm-eyebrow">По введённым данным · предварительно</span><strong>{preview.hours?`${show(preview.hours)} ч / мес.`:"Уточните время"}</strong><span>{preview.timeCost?`${rubles(preview.timeCost)} стоимости времени` : "Стоимость времени появится после ввода ставки"}</span>{preview.flags.includes("W-CAPACITY")&&<p className="bm-error-text">Нагрузка превышает рабочий фонд. Уточните данные перед выбором пилота.</p>}</div>}
    {(!parsed.ok||(!preview&&data.name))&&<div id="bm-editor-errors" tabIndex={-1} role={submitted?"alert":undefined} className="bm-callout bm-callout-warning"><strong>Проверьте данные</strong>{!parsed.ok?<ul>{Object.entries(parsed.errors).map(([key,message])=><li key={key}>{key.endsWith(".name")?"Укажите название процесса.":key.endsWith(".minutesRange")?"Диапазон времени должен содержать длительность одной операции (1–600 минут).":inputError(message)}</li>)}</ul>:<p>Расчёт слишком велик или содержит несовместимые значения. Проверьте время, ставки и затраты.</p>}</div>}
    <div className="bm-actions"><button type="submit" className="bm-primary">{tab==="quick"?"Показать предварительную карту":"Сохранить и пересчитать"} <span aria-hidden="true">→</span></button><button type="button" className="bm-link" onClick={onCancel}>Отменить</button></div>
    {tab==="quick"&&<p className="bm-muted">Пригодность и денежные расходы можно добавить после первого результата.</p>}
  </form>;
}
