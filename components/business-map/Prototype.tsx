"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculateBusinessMap } from "../../lib/business-map/index";
import type { Band, Company, Process } from "../../lib/business-map/contracts";
import { demoCompany, demoNames, emptyProcess, loadDemo, type DemoId } from "../../lib/business-map/demo";
import CompanyForm from "./CompanyForm";
import ProcessEditor from "./ProcessEditor";
import Analysis from "./Analysis";
import PilotPlan, { initialPlan, type PilotDraft } from "./PilotPlan";
import { Arrow, Badge, Callout, SectionTitle, tabKeys } from "./shared";
import { bands, fieldNames, freedRange, groups, reason, rubles, show } from "./presentation";
import "./prototype.css";

type Screen="home"|"map"|"plan"|"company"|"editor"|"analysis"|"company-first";
function NavIcon({name}:{name:string}) { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">{name==="home"?<><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></>:name==="map"?<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>:name==="plan"?<><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/></>:<><circle cx="12" cy="8" r="4"/><path d="M4 21v-3c0-4 16-4 16 0v3"/></>}</svg>; }
const navigation=[{screen:"home",label:"Главная",icon:"home"},{screen:"map",label:"Процессы",icon:"map"},{screen:"plan",label:"План проверки",short:"План",icon:"plan"},{screen:"company",label:"Моя компания",short:"Компания",icon:"company"}] as const;

export default function Prototype() {
  const [viewport,setViewport]=useState<number|null>(null);
  useEffect(()=>{const measure=()=>setViewport(window.innerWidth);measure();window.addEventListener("resize",measure);return()=>window.removeEventListener("resize",measure);},[]);
  const [company,setCompany]=useState<Company>({...demoCompany,salary:null});
  const [processes,setProcesses]=useState<Process[]>([]);
  const [screen,setScreen]=useState<Screen>("home");
  const [mapTab,setMapTab]=useState<"cards"|"matrix">("cards");
  const [draft,setDraft]=useState<Process|null>(null);
  const [editorTab,setEditorTab]=useState<"quick"|"fit"|"economics">("quick");
  const [selected,setSelected]=useState<string|null>(null);
  const [firstName,setFirstName]=useState("");
  const [demo,setDemo]=useState("");
  const [notice,setNotice]=useState("");
  const [plans,setPlans]=useState<Record<string,PilotDraft>>({});
  const main=useRef<HTMLElement>(null);
  const id=useRef(0);
  const result=useMemo(()=>processes.length?calculateBusinessMap({company,processes}):null,[company,processes]);
  const recommended=result?.processes.find(p=>p.id===result.recommendedId)??null;
  const current=result?.processes.find(p=>p.id===selected)??null;
  const currentInput=processes.find(p=>p.id===selected)??null;
  const ordered=result?[...result.processes].sort((a,b)=>{
    const ai=result.ranking.indexOf(a.id),bi=result.ranking.indexOf(b.id);
    return (ai<0?100:ai)-(bi<0?100:bi);
  }):[];
  useEffect(()=>{window.scrollTo({top:0,behavior:"instant"});const heading=main.current?.querySelector<HTMLElement>("h1");if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}},[screen,selected]);
  function openProcess(pid:string){setNotice("");setSelected(pid);setScreen("analysis");}
  function edit(p:Process,tab:"quick"|"fit"|"economics"="quick"){setNotice("");setDraft(p);setEditorTab(tab);setScreen("editor");}
  function add(){if(processes.length>=5)return;edit(emptyProcess(`process-${++id.current}`));}
  function chooseDemo(value:string){
    if(!value)return;
    const seed=loadDemo(value as DemoId);setCompany(seed.company);setProcesses(seed.processes);setPlans({});setDemo(value);setDraft(null);setSelected(null);setScreen("home");setNotice("Демо загружено. Все параметры можно изменить.");
  }
  function reset(){setProcesses([]);setPlans({});setDraft(null);setSelected(null);setDemo("");setFirstName("");setScreen("home");setCompany({...demoCompany,salary:null});setNotice("Пример сброшен. Данные удалены из памяти этой вкладки.");}
  const nav=(mobile=false)=><nav className={mobile?"bm-mobile-nav":"bm-side-nav"} aria-label={mobile?"Навигация прототипа":"Рабочие разделы"}>{navigation.map(n=><button key={n.screen} aria-current={screen===n.screen||(screen==="analysis"&&n.screen==="map")?"page":undefined} onClick={()=>{setScreen(n.screen);setNotice("");}}><NavIcon name={n.icon}/><span>{mobile&&"short"in n?n.short:n.label}</span>{!mobile&&n.screen==="map"&&<small>{processes.length}</small>}</button>)}</nav>;
  const empty=<section className="bm-empty"><p className="bm-eyebrow">Всё начинается с одного процесса</p><h1>Пока карта пуста</h1><p>Добавьте повторяющуюся задачу или выберите демонстрационный сценарий вверху.</p><button className="bm-primary" onClick={()=>setScreen("home")}>Добавить первый процесс →</button></section>;
  const cards=(compact=false)=><div className={`bm-process-list ${compact?"bm-list-compact":""}`}>{ordered.map((r,i)=><article key={r.id} className="bm-process-card" data-process={r.id}>
    <div className="bm-process-top"><span className="bm-card-index">{String(i+1).padStart(2,"0")}</span><div><Badge group={r.group}/><h3><button onClick={()=>openProcess(r.id)}>{r.name} <Arrow/></button></h3></div></div>
    <p>{reason(r)}</p>
    <dl className="bm-card-metrics"><div><dt>Сейчас</dt><dd>{r.hours?`${show(r.hours)} ч/мес.`:"Время неизвестно"}</dd></div><div><dt>Потенциал времени</dt><dd>{freedRange(r)}</dd></div><div><dt>Стоимость труда / мес.</dt><dd>{rubles(r.timeCost)}</dd></div></dl>
    {!compact&&<div className="bm-card-footer"><span>Риск: {r.risk.level?bands[r.risk.level].toLowerCase():"неизвестен"} · Уверенность: {bands[r.confidence].toLowerCase()}</span><button className="bm-link" onClick={()=>edit(processes.find(p=>p.id===r.id)!)}>Изменить</button></div>}
  </article>)}</div>;
  const matrix=<section className="bm-panel"><SectionTitle eyebrow="Матрица приоритетов" title="Ценность × Сложность"/><p>Ценность по вертикали, сложность по горизонтали. Риски и барьеры уточняют рекомендацию.</p><div className="bm-matrix" role="table" aria-label="Матрица ценности и сложности"><div role="row" className="bm-matrix-row bm-matrix-head"><span role="columnheader">Ценность ↓<br/>Сложность →</span>{(["low","medium","high"] as Band[]).map(b=><span role="columnheader" key={b}>{bands[b]}</span>)}</div>{(["high","medium","low"] as Band[]).map(value=><div role="row" className="bm-matrix-row" key={value}><strong role="rowheader">{bands[value]}</strong>{(["low","medium","high"] as Band[]).map(complexity=><div role="cell" className={`bm-matrix-cell ${value==="high"&&complexity!=="high"?"bm-matrix-opportunity":""}`} key={complexity}>{ordered.filter(p=>p.value===value&&p.complexity.level===complexity).map(p=><button key={p.id} aria-label={`${p.name}. ${groups[p.group]}`} onClick={()=>openProcess(p.id)}><span className="bm-matrix-long">{p.name}</span><span className="bm-matrix-short" aria-hidden="true">{String(ordered.findIndex(item=>item.id===p.id)+1).padStart(2,"0")}</span><small>{groups[p.group]}</small></button>)}{!ordered.some(p=>p.value===value&&p.complexity.level===complexity)&&<span aria-label="Процессов нет">—</span>}</div>)}</div>)}</div><p className="bm-muted">Номера соответствуют списку ниже. Недостаточные данные не получают позицию в матрице. Барьеры сохраняют силу при любой ценности.</p></section>;
  return <div className="bm">
    <aside className="bm-sidebar"><div className="bm-wordmark">MIRONOVICH<span>.PRO</span></div><div className="bm-product-mark"><span className="bm-square"/><p>BUSINESS MAP<small>Карта автоматизации</small></p></div>{nav()}<div className="bm-sidebar-bottom"><span className="bm-proto-label">ЗАКРЫТЫЙ ПРОТОТИП</span><p>Один бизнес.<br/>До пяти процессов.<br/>Проверяемый следующий шаг.</p><small>Этап 02 / интерфейс</small></div></aside>
    <div className="bm-workspace"><header className="bm-topbar"><span className="bm-mobile-brand">MIRONOVICH.PRO</span><span className="bm-workspace-label">Рабочая карта <span>/</span> тестовый пример</span><div><span className="bm-slot-count">{processes.length} / 5 процессов</span><button onClick={reset} className="bm-reset">Сбросить<span className="bm-desktop-word"> пример</span></button></div></header>
      <div className="bm-demo-bar"><label htmlFor="bm-demo-select">Демо-сценарий</label><select id="bm-demo-select" value={demo} onChange={e=>chooseDemo(e.target.value)}><option value="">Свой вымышленный пример</option>{Object.entries(demoNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><span>Без сохранения данных</span></div>
      <div className="bm-review-info"><span>Только вымышленные данные</span><span>{viewport?`Окно: ${viewport} px`:"Локальный прототип"}</span></div>
      <main id="main" ref={main} className="bm-main">
        {notice&&<p role="status" className="bm-status">{notice}</p>}
        {screen==="home"&&!processes.length&&<div className="bm-welcome"><div className="bm-welcome-copy"><p className="bm-eyebrow"><span className="bm-red-line"/> Карта автоматизации бизнеса</p><h1>С чего начать<br/><em>автоматизацию.</em></h1><p className="bm-welcome-description">Найдите процесс, который стоит проверить первым. По вашему времени, сложности и рискам.</p><form autoComplete="off" onSubmit={e=>{e.preventDefault();if(!firstName.trim())return;setDraft(emptyProcess(`process-${++id.current}`,firstName.trim()));setScreen("company-first");}}><label htmlFor="bm-first-process">Какой процесс разберём?</label><input id="bm-first-process" maxLength={80} required value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Например, сбор отчётов"/><button className="bm-primary" type="submit">Разобрать первый процесс <Arrow/></button></form><p className="bm-welcome-note">Достаточно одного процесса, чтобы увидеть первую оценку.</p></div><div className="bm-welcome-aside"><span className="bm-large-number">01—05</span><p>От повторяющейся задачи<br/>до понятного плана проверки</p><ol><li><span>01</span><div><strong>Посчитать время</strong><small>Часы работы команды и их стоимость</small></div></li><li><span>02</span><div><strong>Проверить ограничения</strong><small>Данные, сложность и цена ошибки</small></div></li><li><span>03</span><div><strong>Выбрать первый пилот</strong><small>Гипотеза и критерии результата</small></div></li></ol><div className="bm-welcome-caption">Стоимость времени ≠ денежная экономия</div></div></div>}
        {screen==="home"&&result&&<>
          <header className="bm-page-heading"><p className="bm-eyebrow">Ваша карта / обзор</p><h1>Что проверить первым</h1><p>Не всё нужно автоматизировать. Начните с одного обоснованного пилота.</p></header>
          {recommended?<section className="bm-recommendation"><div className="bm-recommendation-copy"><p className="bm-eyebrow">Первый кандидат для проверки</p><h2>{recommended.name}</h2><p>{reason(recommended)}</p><button className="bm-primary" onClick={()=>openProcess(recommended.id)}>Почему этот процесс <Arrow/></button></div><div className="bm-recommendation-metric"><span>Потенциал времени</span><strong>{freedRange(recommended)}</strong><span>в месяц · три сценария</span><small>Уже за вычетом проверки человеком.<br/>Это ёмкость, а не деньги на счёте.</small></div></section>:<section className="bm-recommendation bm-recommendation-pending"><div><p className="bm-eyebrow">Сначала уточнения</p><h2>Для первого пилота пока рано</h2><p>{result.fallbackId?reason(result.processes.find(p=>p.id===result.fallbackId)!):"Процессы требуют экспертной оценки. Автоматическая рекомендация не выдаётся."}</p><button className="bm-primary" onClick={()=>{if(result.fallbackId)openProcess(result.fallbackId);else setScreen("map");}}>Посмотреть ограничения →</button></div></section>}
          <div className="bm-overview-stats"><div><span>На карте</span><strong>{processes.length}<small> / 5 процессов</small></strong></div><div><span>Трудозатраты команды</span><strong>{result.totals?`${show(result.totals.hours)} ч`:<small>Общий итог не сводится</small>}</strong></div><div><span>Стоимость труда / мес.</span><strong>{result.totals?rubles(result.totals.timeCost):<small>Общий итог не сводится</small>}</strong><small>Стоимость ёмкости, не экономия</small></div></div>
          {result.totalBlockers.length>0&&<Callout tone="warning">{result.totalBlockers.includes("CAPACITY-EXCEEDED")?"В одном из процессов превышен фонд команды. Сверьте нагрузку до выбора пилота.":result.totalBlockers.includes("MIXED-COST-BASES")?"Основания стоимости различаются. Общая сумма в рублях не рассчитывается.":"Уточните время и независимость процессов. Пересекающиеся часы нельзя складывать."}</Callout>}
          <SectionTitle eyebrow="Карта процессов" title="Общая картина"><button className="bm-link" onClick={()=>{setMapTab("cards");setScreen("map");}}>Все процессы <Arrow/></button></SectionTitle>{cards(true)}
          <section className="bm-next-step"><span>Следующий шаг</span><p>{recommended?"Проверьте исходные данные и откройте план небольшого пилота.":"Уточните недостающие ответы, прежде чем выбирать процесс для пилота."}</p><button className="bm-link" onClick={()=>recommended?setScreen("plan"):setScreen("map")}>{recommended?"Открыть план":"Уточнить данные"} →</button></section>
        </>}
        {screen==="map"&&(result?<><header className="bm-page-heading"><p className="bm-eyebrow">От инвентаризации к действию</p><h1>Карта процессов</h1><p>До пяти процессов. Данные можно менять в любой момент.</p></header><div className="bm-map-toolbar"><div className="bm-tabs" role="tablist" aria-label="Вид карты" onKeyDown={tabKeys}><button role="tab" id="bm-map-cards-tab" aria-controls="bm-map-panel" tabIndex={mapTab==="cards"?0:-1} aria-selected={mapTab==="cards"} onClick={()=>setMapTab("cards")}>Карта</button><button role="tab" id="bm-map-matrix-tab" aria-controls="bm-map-panel" tabIndex={mapTab==="matrix"?0:-1} aria-selected={mapTab==="matrix"} onClick={()=>setMapTab("matrix")}>Приоритеты</button></div><button className="bm-primary" onClick={add} disabled={processes.length>=5}>{processes.length>=5?"Все 5 слотов заняты":"+ Добавить процесс"}</button></div>{processes.length>=5&&<Callout>Лимит прототипа — пять активных процессов. Откройте процесс и удалите его, чтобы добавить новый.</Callout>}<div role="tabpanel" id="bm-map-panel" aria-labelledby={mapTab==="matrix"?"bm-map-matrix-tab":"bm-map-cards-tab"}>{mapTab==="matrix"?matrix:cards()}</div>{mapTab==="matrix"&&<><SectionTitle eyebrow="Итог после барьеров" title="Порядок проверки"/>{cards()}</>}<Callout>Совпадающие операции учитывайте только в одном процессе или отметьте пересечения. Время, стоимость ёмкости и денежную экономию не складывают между собой.</Callout></>:empty)}
        {screen==="analysis"&&current&&currentInput&&<><Analysis process={currentInput} result={current} company={company} onBack={()=>setScreen("map")} onEdit={()=>edit(currentInput)} onPlan={()=>setScreen("plan")}/><details className="bm-disclosure bm-delete"><summary>Удалить процесс из примера</summary><p>Процесс удалится из памяти вкладки. Остальные данные останутся.</p><button className="bm-danger" onClick={()=>{setProcesses(ps=>ps.filter(p=>p.id!==selected).map(p=>({...p,overlapsWith:p.overlapsWith.filter(pid=>pid!==selected)})));setSelected(null);setScreen("map");}}>Удалить этот процесс</button></details></>}
        {screen==="company"&&<CompanyForm initial={company} onSave={next=>{setCompany(next);setNotice("Параметры обновлены. Расчёт выполнен ядром.");setScreen("home");}} onCancel={()=>setScreen("home")}/>}
        {screen==="company-first"&&<CompanyForm first onSave={next=>{setCompany(next);setEditorTab("quick");setScreen("editor");}} onCancel={()=>setScreen("home")}/>}
        {screen==="editor"&&draft&&<ProcessEditor key={draft.id} initial={draft} company={company} allProcesses={processes} initialTab={editorTab} onCancel={()=>setScreen(processes.length?"map":"home")} onSave={next=>{setProcesses(ps=>ps.some(p=>p.id===next.id)?ps.map(p=>p.id===next.id?next:p):[...ps,next]);setSelected(next.id);setScreen("analysis");setNotice("Данные пересчитаны. Можно вернуться и изменить любой ответ.");}}/>}
        {screen==="plan"&&<PilotPlan result={recommended} draft={recommended?(plans[recommended.id]??initialPlan(recommended.name)):null} onChange={d=>{if(recommended)setPlans(p=>({...p,[recommended.id]:d}));}} onAnalysis={()=>{if(recommended)openProcess(recommended.id);}} onMap={()=>setScreen("map")}/>}
        {screen==="analysis"&&current&&current.missing.length>0&&<p className="bm-muted">Можно уточнить: {current.missing.map(k=>fieldNames[k]??k).join(", ")}.</p>}
        <footer className="bm-page-footer"><span>BUSINESS MAP · {result?.modelVersion??"Модель v1.1"}</span><span>Только синтетические данные. Обновление страницы сбросит ввод.</span></footer>
      </main>
    </div>{nav(true)}
  </div>;
}
