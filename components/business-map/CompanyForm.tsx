"use client";
import { useState } from "react";
import type { Company } from "../../lib/business-map/contracts";
import { parseDecimal } from "../../lib/tools/input";
import { businessMapModel } from "../../config/business-map-model";
import { NumberField, SelectField, Callout } from "./shared";
import { systemNames } from "./presentation";

export default function CompanyForm({ initial, first = false, onSave, onCancel }: { initial?: Partial<Company>; first?: boolean; onSave: (company: Company) => void; onCancel: () => void }) {
  const [industry,setIndustry]=useState(initial?.industry ?? "");
  const [headcount,setHeadcount]=useState(initial?.headcount ?? "");
  const [goal,setGoal]=useState(initial?.goal ?? "");
  const [systems,setSystems]=useState<string[]>(initial?.systems ?? []);
  const [salary,setSalary]=useState(initial?.salary?.toString() ?? "");
  const [hours,setHours]=useState(String(initial?.monthlyHours ?? businessMapModel.monthlyHours));
  const [load,setLoad]=useState(String(initial?.salaryLoad ?? businessMapModel.salaryLoad));
  const [error,setError]=useState("");
  return <form className="bm-form" autoComplete="off" onSubmit={e=>{
    e.preventDefault();
    const s=salary.trim()===""?null:parseDecimal(salary), h=parseDecimal(hours), l=parseDecimal(load);
    if(!industry || !headcount || !goal || !systems.length) {setError("Выберите сферу, численность, цель и хотя бы одну систему.");return;}
    if((s!==null&&(!Number.isFinite(s)||s<0||s>businessMapModel.limits.money)) || !Number.isFinite(h)||h<1||h>744||!Number.isFinite(l)||l<1||l>3){setError("Проверьте ставку и допущения: часы 1–744, коэффициент 1–3, зарплата — неотрицательное число.");return;}
    onSave({industry,headcount:headcount as Company["headcount"],goal:goal as Company["goal"],systems,salary:s,monthlyHours:h,salaryLoad:l});
  }}>
    <div className="bm-form-intro"><p className="bm-eyebrow">{first ? "01 / Контекст" : "Параметры анализа"}</p><h1>Немного о компании</h1><p>Только вымышленный пример. Название компании и контакты не нужны.</p></div>
    <div className="bm-field-grid">
      <SelectField label="Сфера деятельности" value={industry} onChange={setIndustry} options={{"":"Выберите сферу",fitness:"Фитнес и спорт",agencies:"Агентства",retail:"Розница и e-commerce",services:"Услуги для бизнеса",consumer:"Услуги для населения",manufacturing:"Производство",construction:"Строительство",logistics:"Логистика",hospitality:"Общепит и гостиницы",education:"Образование",it:"IT",other:"Другое"}} />
      <SelectField label="Численность команды" value={headcount} onChange={setHeadcount} options={{"":"Выберите диапазон","1-10":"1–10 человек","11-50":"11–50 человек","51-100":"51–100 человек","101-250":"101–250 человек",over250:"Больше 250"}} />
      <SelectField label="Главная цель" value={goal} onChange={setGoal} options={{"":"Что хотите улучшить?",cost:"Снизить затраты на рутину",speed:"Ускорить выполнение",errors:"Уменьшить ошибки",growth:"Расти без найма"}} />
      {!first && <NumberField label="Средняя зарплата до налогов, ₽/мес." value={salary} onChange={setSalary} optional hint="Без зарплаты покажем часы; стоимость времени останется неизвестной." />}
    </div>
    <fieldset className="bm-options"><legend>Какие системы используются?</legend><div className="bm-check-grid">{Object.entries(systemNames).filter(([key])=>key!=="voice").map(([key,label])=><label key={key}><input type="checkbox" checked={systems.includes(key)} onChange={()=>setSystems(systems.includes(key)?systems.filter(s=>s!==key):key==="none"?["none"]:[...systems.filter(s=>s!=="none"),key])}/><span>{label}</span></label>)}</div></fieldset>
    {!first && <details className="bm-disclosure"><summary>Рабочий фонд и начисления</summary><p>Гипотезы модели, которые можно уточнить под график. Полная часовая ставка процесса имеет приоритет над зарплатой.</p><div className="bm-field-grid"><NumberField label="Рабочих часов в месяц на человека" value={hours} onChange={setHours}/><NumberField label="Коэффициент начислений на зарплату" value={load} onChange={setLoad}/></div></details>}
    {first && <Callout>Зарплату и график можно добавить позже. Для первого результата достаточно времени процесса.</Callout>}
    {error&&<p role="alert" className="bm-error-text">{error}</p>}
    <div className="bm-actions"><button className="bm-primary" type="submit">{first?"Перейти к процессу →":"Сохранить параметры"}</button><button type="button" className="bm-link" onClick={onCancel}>Назад</button></div>
  </form>;
}
