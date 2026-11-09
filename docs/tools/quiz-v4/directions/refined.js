// Presentation-only prototype. No requests, submissions, storage or analytics.
const mobile = matchMedia('(max-width:900px)');
let openRow = '', customDuration = new Set(), exactScheduleOpen = false;
const periodNames = {shift:'за смену',week:'за неделю',month:'за месяц'};
const qTitles = {
  process:'Какую работу считаем?', employees:'Сколько сотрудников её выполняют?',
  frequency:'Как часто повторяется задача?', duration:'Сколько занимает одно выполнение?',
  schedule:'По какому графику работают сотрудники?', shiftHours:'Сколько часов длится смена?',
  pay:'Сколько сотрудник получает за месяц?', issue:'Что больше всего мешает работе?',
  problemFrequency:'Как часто возникает проблема?', effect:'Как это влияет на бизнес?',
  graphCost:'График и расходы'
};
const shortIssues = {...issues,time:'Много времени на рутину',unclear:'Пока трудно определить'};
const $ = id => document.getElementById(id);
const employeeWord = n => n%10===1&&n%100!==11?'сотрудник':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'сотрудника':'сотрудников';
const currentTasks = () => mode==='labor'?L.tasks:A.tasks;
const measureFor = task => measure(L,task||L.active);
function phases() {
  if(mode==='auto')return [{key:'issue'},...(!A.known?[{key:'process'}]:[]),...(A.issue==='unclear'?[]:[...(A.issue==='time'&&A.known&&A.known.tasks.every(t=>calc(A.known,t).hours!==null)?[]:[{key:'problemFrequency'}]),{key:'effect'}])];
  return [{key:'process'},{key:'employees'},...(L.tasks.length?L.tasks:[L.active]).flatMap(task=>[{key:'frequency',task},{key:'duration',task}]),{key:'schedule'},{key:'shiftHours'},{key:'pay'}];
}
function desktopRows() {
  if(mode==='labor')return [{key:'process',label:'Задача'},{key:'employees',label:'Сотрудники'},{key:'frequency',label:'Частота'},{key:'duration',label:'Продолжительность'},{key:'graphCost',label:'График и расходы'}];
  return phases().map(p=>({...p,label:{issue:'Проблема',process:'Процесс',problemFrequency:'Частота',effect:'Последствия'}[p.key]}));
}
function salaryText() {
  return L.payKind==='unknown'?'Сумма пока неизвестна':num(L.amount)===null?'Расходы не указаны':rub(num(L.amount))+'/мес';
}
function summaryFor(key) {
  const m=measureFor();
  switch(key) {
    case 'process':return currentTasks().length?currentTasks().map(t=>labels[t]).join(', '):'Выберите вид работы';
    case 'employees':return (L.employees||'—')+' '+employeeWord(num(L.employees)||0);
    case 'frequency':return num(m.repeat)===null?'Укажите повторения':fmt(num(m.repeat))+' '+periodNames[m.period]+' на сотрудника';
    case 'duration':return num(m.duration)===null?'Укажите время':fmt(num(m.duration))+(m.unit==='hours'?' ч':' мин')+' на операцию';
    case 'graphCost':return (L.schedule?(L.schedule==='other'?'Свой график':L.schedule):'График не выбран')+(graph(L)?.actual?' · '+graph(L).shifts+' смен':'')+' · '+salaryText();
    case 'issue':return shortIssues[A.issue]||'Выберите главное затруднение';
    case 'problemFrequency':return frequencies[A.frequency]||'Уточните частоту проблемы';
    case 'effect':return effects[A.effect]||'Что меняется для бизнеса?';
  }
  return '';
}
function choice(options,value,action,cls='choices') {
  return `<div class="${cls}">${Object.entries(options).map(([k,v])=>`<button type="button" data-action="${action}" data-value="${k}" aria-pressed="${value===k}">${cls==='answer-list'?'<span class="checkmark" aria-hidden="true">'+(value===k?'●':'○')+'</span>':''}${v}</button>`).join('')}</div>`;
}
function processControl() {
  return `<div class="task-list" aria-label="Виды работы">${Object.entries(labels).map(([k,v])=>`<button type="button" data-action="task" data-value="${k}" aria-pressed="${currentTasks().includes(k)}"><span class="checkmark" aria-hidden="true">${currentTasks().includes(k)?'✓':'·'}</span>${v}</button>`).join('')}</div><p class="hint">Можно выбрать несколько процессов.</p>`;
}
function processTabs() {
  if(L.tasks.length<2)return '';
  return `<div class="group-tabs" aria-label="Процесс для редактирования">${L.tasks.map(t=>`<button data-action="active-task" data-value="${t}" aria-pressed="${L.active===t}">${labels[t]}</button>`).join('')}</div>`;
}
function counterControl() {
  return `<div class="counter"><button data-action="minus" aria-label="На одного сотрудника меньше">−</button><label class="sr-only" for="employees">Количество сотрудников</label><input id="employees" data-model="employees" inputmode="numeric" autocomplete="off" maxlength="5" value="${escapeText(L.employees)}"><button data-action="plus" aria-label="На одного сотрудника больше">+</button></div>`;
}
function frequencyControl() {
  const m=measureFor();
  return `${!mobile.matches?processTabs():''}${choice({shift:'За смену',week:'За неделю',month:'За месяц'},m.period,'period','segments')}<label class="sr-only" for="repeat">Повторений на одного сотрудника</label><div class="range-number"><input id="repeat" class="number-input" data-model="repeat" inputmode="numeric" maxlength="6" autocomplete="off" value="${escapeText(m.repeat)}" placeholder="—"><span class="unit">раз на человека</span></div><input type="range" id="repeat-range" class="frequency-range" data-model="repeat" min="0" max="100" step="1" value="${Math.min(100,num(m.repeat)||0)}" aria-label="Повторений на сотрудника — ползунок"><p class="hint">Больше 100? Введите точное число.</p>`;
}
function durationControl() {
  const m=measureFor(),custom=customDuration.has(L.active)||(num(m.duration)!==null&&(m.unit==='hours'||![1,3,5,10,15,30].includes(num(m.duration))));
  return `${!mobile.matches?processTabs():''}<div class="choices" aria-label="Минуты на одно выполнение">${[1,3,5,10,15,30].map(n=>`<button data-action="minutes" data-value="${n}" aria-pressed="${!custom&&m.unit==='minutes'&&num(m.duration)===n}">${n}<span class="sr-only"> минут</span></button>`).join('')}<button class="other-duration" data-action="custom-duration" aria-pressed="${custom}">Другое</button></div>${custom?`<div class="custom-duration"><label class="sr-only" for="duration">Продолжительность операции</label><div class="row-inline"><input id="duration" class="number-input" data-model="duration" inputmode="decimal" maxlength="10" autocomplete="off" value="${escapeText(m.duration)}"><label class="sr-only" for="duration-unit">Единицы времени</label><select id="duration-unit"><option value="minutes" ${m.unit==='minutes'?'selected':''}>минут</option><option value="hours" ${m.unit==='hours'?'selected':''}>часов</option></select></div></div>`:'<p class="hint">Минут на одно выполнение.</p>'}`;
}
function shortGraph() {
  const g=graph(L);if(!g)return L.schedule==='other'?'Укажите фактическое число смен.':'Выберите график.';
  if(g.actual)return fmt(g.shifts)+' смен · указано вами';
  const range=g.note.match(/фактически (\d+–\d+)/);
  return '≈ '+fmt(g.shifts)+' смен в месяце'+(range?' · возможно '+range[1]:', без праздников');
}
function scheduleControl() {
  return `${choice({'5/2':'5/2','2/2':'2/2','3/3':'3/3','6/1':'6/1','3/2':'3/2',other:'Другой'},L.schedule,'schedule','choices schedule-choices')}<p class="schedule-note" id="schedule-note">${shortGraph()}</p><details class="optional" id="exact-schedule" ${exactScheduleOpen||L.actual||L.schedule==='other'?'open':''}><summary>Месяц и точные смены</summary><div class="optional-content"><label class="field-label" for="month">Месяц расчёта</label><input class="month-input" type="month" id="month" data-model="month" value="${L.month}" min="2000-01" max="2099-12"><label class="actual-label"><input type="checkbox" id="actual" ${L.actual||L.schedule==='other'?'checked':''} ${L.schedule==='other'?'disabled':''}>Указать фактические смены</label><div id="actual-field" ${L.actual||L.schedule==='other'?'':'hidden'}><label class="field-label" for="shifts">Смен за месяц</label><input class="number-input" id="shifts" data-model="shifts" inputmode="numeric" maxlength="2" value="${escapeText(L.shifts)}"></div><p class="hint" id="graph-full-note">${graph(L)?.note||'Календарная оценка зависит от месяца и начала цикла. Для своего графика нужны фактические смены.'}</p></div></details>`;
}
function shiftControl() {
  return `<label class="sr-only" for="shiftHours">Часов в смену</label><div class="row-inline"><input class="number-input" id="shiftHours" data-model="shiftHours" inputmode="decimal" autocomplete="off" maxlength="5" placeholder="—" value="${escapeText(L.shiftHours)}"><span class="unit">часов</span></div>`;
}
function payControl() {
  return `<label class="sr-only" for="pay-kind">Что входит в месячную сумму</label><select id="pay-kind" class="pay-kind"><option value="salary" ${L.payKind==='salary'?'selected':''}>Зарплата сотрудника</option><option value="employer" ${L.payKind==='employer'?'selected':''}>Полные расходы компании</option><option value="unknown" ${L.payKind==='unknown'?'selected':''}>Сумма неизвестна</option></select>${L.payKind==='unknown'?'<p class="hint">Покажем часы. Рубли можно добавить позже.</p>':`<label class="sr-only" for="amount">Месячная сумма на одного сотрудника в рублях</label><div class="money-field"><input id="amount" class="money-input" data-model="amount" inputmode="decimal" autocomplete="off" placeholder="Укажите сумму" maxlength="12" value="${escapeText(L.amount)}"><span class="unit">₽</span></div><p class="hint">${L.payKind==='salary'?'За одного сотрудника. Зарплата не равна полным расходам компании.':'За одного сотрудника, включая известные вам расходы.'}</p><button class="text-action" data-action="unknown-pay">Не знаю сумму</button>`}`;
}
function questionTitle(key) {return key==='pay'&&L.payKind==='employer'?'Сколько компания тратит на сотрудника за месяц?':qTitles[key];}
function control(key) {
  if(key==='process')return processControl();
  if(key==='employees')return counterControl();
  if(key==='frequency')return frequencyControl();
  if(key==='duration')return durationControl();
  if(key==='schedule')return scheduleControl();
  if(key==='shiftHours')return shiftControl();
  if(key==='pay')return payControl();
  if(key==='graphCost')return `<div class="graph-desktop-fields"><div>${scheduleControl()}</div><div><label class="field-label" for="shiftHours">Часов в смену</label>${shiftControl()}</div><div><label class="field-label" for="amount">Месячная сумма на сотрудника</label>${payControl()}</div></div>`;
  if(key==='issue')return choice(shortIssues,A.issue,'issue','answer-list');
  if(key==='problemFrequency')return choice(frequencies,A.frequency,'problem-frequency','answer-list');
  if(key==='effect')return choice(effects,A.effect,'effect','answer-list');
  return '';
}
function validate(key,task=L.active) {
  const c=calc(L,task),m=measure(L,task);
  if(key==='process'&&!currentTasks().length)return 'Выберите хотя бы один процесс.';
  if(key==='employees'&&(num(L.employees)===null||!Number.isInteger(num(L.employees))||num(L.employees)<1||num(L.employees)>10000))return 'Укажите целое число сотрудников от 1 до 10 000.';
  if(key==='frequency'&&(num(m.repeat)===null||!Number.isInteger(num(m.repeat))||num(m.repeat)>100000))return 'Укажите целое число повторений от 0 до 100 000.';
  if(key==='duration'&&(num(m.duration)===null||num(m.duration)*(m.unit==='hours'?60:1)>10080))return 'Укажите длительность от 0 до 10 080 минут.';
  if(key==='schedule'&&!graph(L))return 'Проверьте график, месяц и фактическое число смен.';
  if(key==='shiftHours'&&(num(L.shiftHours)===null||num(L.shiftHours)<.25||num(L.shiftHours)>24))return 'Продолжительность смены — от 0,25 до 24 часов.';
  if(key==='pay'&&L.payKind!=='unknown'&&(num(L.amount)===null||num(L.amount)>10000000||(c.paid!==null&&c.rate===null)))return 'Проверьте месячную сумму и рабочие часы. Максимум — 10 млн ₽ и ставка 1 млн ₽/ч.';
  if(key==='issue'&&!A.issue)return 'Выберите проблему или «Пока трудно определить».';
  if(key==='problemFrequency'&&!A.frequency)return 'Выберите частоту или «Пока не знаю».';
  if(key==='effect'&&!A.effect)return 'Выберите последствия или «Пока не измеряли».';
  return '';
}
function invalidEnteredValue() {
  if(mode!=='labor')return '';
  for(const [key,value] of [['employees',L.employees],['shiftHours',L.shiftHours],['pay',L.amount]])if(value!==''&&validate(key))return validate(key);
  if(L.schedule&&monthDays(L.month)===null)return 'Укажите корректный месяц расчёта.';
  if((L.actual||L.schedule==='other')&&L.shifts!==''&&!graph(L))return validate('schedule');
  for(const task of L.tasks)for(const key of ['frequency','duration'])if(measure(L,task)[key==='frequency'?'repeat':'duration']!==''&&validate(key,task))return validate(key,task);
  return '';
}
function important() {
  if(mode==='auto') {
    const key=phases()[phase]?.key;
    if(key==='issue')return {value:A.issue?shortIssues[A.issue]:'Найдём предмет проверки',note:A.known?'Расчёт уже учтён. Повторять числа не нужно.':''};
    if(key==='process')return {value:A.tasks.length?A.tasks.map(t=>labels[t]).join(', '):'Выберите процесс',note:''};
    if(key==='problemFrequency')return {value:A.frequency?frequencies[A.frequency]:'Уточним частоту проблемы',note:''};
    return {value:A.effect?effects[A.effect]:'Уточним влияние на бизнес',note:'Предварительно, со слов пользователя.'};
  }
  const step=phases()[phase]||{},c=calc(L,step.task||L.active),m=measure(L,step.task||L.active),unit=periodNames[m.period];
  if(step.key==='process')return {value:L.tasks.length?'Выбрано процессов: '+L.tasks.length:'Начните с одной задачи',note:''};
  if(step.key==='employees')return {value:c.per===null?(L.employees||'—')+' '+employeeWord(c.people||0):fmt(c.per)+' операций '+unit,note:'Для выбранной группы'};
  if(step.key==='frequency')return {value:c.per===null?'Задайте частоту':fmt(c.per)+' операций '+unit,note:'У всей группы сотрудников'};
  if(step.key==='duration')return {value:c.periodHours===null?'Укажите длительность':fmt(c.periodHours)+' ч ручной работы '+unit,note:''};
  if(step.key==='schedule')return {value:c.hours===null?'Выберите рабочий график':fmt(c.hours)+' ч ручной работы в месяц',note:c.g&&!c.g.actual?'По ориентировочному графику':''};
  if(step.key==='shiftHours')return {value:c.paid===null?'Укажите часы смены':fmt(c.paid)+' рабочих часов в месяц',note:'На одного сотрудника'};
  return {value:c.cost===null?(c.hours===null?'Рубли пока неизвестны':fmt(c.hours)+' ч в месяц'):rub(c.cost)+' в месяц',note:c.rate===null?'Без вымышленной зарплаты':rub(c.rate)+'/ч · '+rub(c.annual)+' за год'};
}
function autoStatus(task,c) {
  return !c||c.hours===null?'Нужны данные':c.hours===0?'Оснований пока мало':'Есть смысл проверить';
}
function readyStatus(task) {
  return ['reporting','transfer','crm','control'].includes(task)?'Можно проверить существующие инструменты':'Требуется уточнение совместимости';
}
function reasonText() {
  if(mode==='labor')return 'Повторяемость делает процесс кандидатом для проверки. Сначала нужно отделить обязательную работу от лишних действий.';
  return {errors:'Проверьте, где возникают исправления и как контролируются исходные данные.',waiting:'Найдите, на каком переходе возникает ожидание и какие согласования необходимы.',reentry:'Проверьте источник данных и причину повторного ввода.',unclear:'Разберите один недавний пример: вход, действия и результат.',time:'Замерьте повторения и исключения, где нужно решение человека.'}[A.issue]||'Сначала уточним проблему и её последствия.';
}
function calcDetail(data,task) {
  const c=calc(data,task),m=measure(data,task);
  return `<details class="optional calc-detail" id="calc-details"><summary>Как посчитали и что учтено</summary><div class="optional-content"><p>${c.g?c.g.note:'График пока не выбран.'}</p><p>${c.paid===null?'Рабочие часы пока неизвестны.':fmt(c.paid)+' рабочих часов в месяц на человека.'} ${c.rate===null?'Ставка не подставляется.':'Ставка: '+rub(c.rate)+'/ч = месячная сумма / рабочие часы, без раннего округления.'}</p><p>${num(m.repeat)===null?'Частота не указана.':fmt(num(m.repeat))+' повторений '+periodNames[m.period]+' на человека.'} ${m.period==='week'?'Месячный множитель — дни месяца / 7.':m.period==='shift'?'Месячный множитель — смены в месяце.':'Дополнительного множителя периода нет.'} Год — 12 месяцев с той же нагрузкой.</p><p>Один график и одна месячная сумма применяются ко всей выбранной группе.</p></div></details>`;
}
function renderResult() {
  const openDetails=[...$('result').querySelectorAll('details[open]')].map(e=>e.id);
  const data=mode==='labor'?L:A.known,task=mode==='labor'?L.active:(A.tasks[0]||'other');
  const hasTask=mode==='labor'?L.tasks.length>0:A.tasks.length>0,taskForStatus=hasTask?task:'other';
  const c=data?calc(data,hasTask?task:'__unselected__'):null;
  let html='<button class="text-action mobile-result-edit" data-action="edit">← Изменить ответы</button>';
  if(data) {
    html+=`<p class="result-kicker">${data.tasks.length>1?labels[task]:'Стоимость ручного труда'} · в месяц</p><div id="live-metrics" aria-live="polite" aria-atomic="true"><strong class="primary-number number-change ${c.cost===null?'empty-number':''}" data-metric="monthly">${c.cost===null?'— ₽':rub(c.cost)}</strong><div class="secondary-metrics"><div><strong data-metric="hours">${c.hours===null?'— ч':fmt(c.hours)+' ч'}</strong><span>ручной работы / месяц</span></div><div><strong data-metric="annual">${c.annual===null?'— ₽':rub(c.annual)}</strong><span>при той же нагрузке / год</span></div></div></div><p class="result-subtitle">${data.payKind==='unknown'?'Сумма неизвестна. Часы доступны.':data.payKind==='salary'?'По зарплате, без остальных расходов компании.':'По указанным полным расходам компании.'} Стоимость времени не равна экономии.${c.g&&!c.g.actual?' График ориентировочный.':''}</p>`;
  } else {
    html+=`<p class="result-kicker">Предварительный разбор</p><h2 class="result-title">${{errors:'Проверить причины ошибок',waiting:'Найти причину задержек',reentry:'Разобраться с повторным вводом',time:'Проверить повторяющуюся работу',unclear:'Начать с одного процесса'}[A.issue]||'Что стоит проверить?'}</h2><p class="result-subtitle">${A.issue?reasonText():'Выберите главное затруднение. Вывод будет уточняться сразу.'}</p>`;
  }
  const bad=invalidEnteredValue();
  if(bad)html+=`<p class="amount-warning" role="alert">${bad}</p>`;
  if(c?.over)html+='<p class="amount-warning" role="alert">Объём превышает рабочие часы группы. Проверьте частоту, длительность и пересечения.</p>';
  if(c?.hours!==null&&c?.hours!==undefined&&c.people>0&&c.hours/c.people>744)html+='<p class="amount-warning" role="alert">Больше 744 часов на человека в месяц. Денежная оценка не выводится.</p>';
  if(data&&data.tasks.length>1)html+='<p class="multi-note">Показан один процесс. Общий итог без проверки пересечений не считаем.</p>';
  html+=`<div class="statuses"><div><span class="status-label">Потенциал автоматизации</span><span class="status-value">${autoStatus(taskForStatus,c)}</span></div><div><span class="status-label">Готовое решение</span><span class="status-value">${readyStatus(taskForStatus)}</span></div></div><details class="optional explanation" id="why-details"><summary>Почему такой вывод?</summary><div class="optional-content"><p>${reasonText()}</p><p>Предварительная гипотеза. Возможность автоматизации, функции продукта и совместимость ещё не проверены. Экономия не рассчитана.</p>${mode==='auto'&&A.frequency&&A.issue!=='unclear'?'<p>Частота проблемы: '+frequencies[A.frequency]+'.</p>':''}${mode==='auto'&&A.effect&&A.issue!=='unclear'?'<p>Последствия со слов пользователя: '+effects[A.effect]+'. Масштаб требует проверки.</p>':''}${taskForStatus==='calls'?'<p>Для записей звонков нужно проверить права и законность обработки. Выводы проверяет человек.</p>':''}</div></details><button class="cta" data-action="consult">${mode==='labor'?'Разобрать затраты с экспертом':'Обсудить процесс с экспертом'}</button><p class="consult-value">Проверим реальные потери, целесообразность изменений и условия пилота.</p><div class="result-actions">${mode==='labor'?'<button data-action="improve">Проверить возможности улучшения →</button>':'<button data-action="mode" data-value="labor">К расчёту стоимости ручного труда →</button>'}</div>`;
  if(data)html+=calcDetail(data,hasTask?task:'__unselected__');
  if(data&&data.tasks.length>1)html+=`<details class="optional" id="other-processes"><summary>Другие процессы · ${data.tasks.length-1}</summary>${data.tasks.filter(t=>t!==task).map(t=>{const r=calc(data,t);return '<p class="hint">'+labels[t]+': '+(r.hours===null?'время неизвестно':fmt(r.hours)+' ч/мес')+' · '+(r.cost===null?'стоимость неизвестна':rub(r.cost)+'/мес')+'</p>';}).join('')}</details>`;
  $('result').innerHTML=html;
  openDetails.forEach(id=>{if($(id))$(id).open=true;});
}
function refresh() {
  const list=phases();phase=Math.min(phase,list.length-1);
  $('workspace').classList.toggle('mobile-done',done);
  $('progress').innerHTML=`<span>${phase+1} из ${list.length}</span><div class="progress-track" role="progressbar" aria-label="Прогресс калькулятора" aria-valuemin="0" aria-valuemax="${list.length}" aria-valuenow="${phase+1}"><div class="progress-fill" style="width:${(phase+1)/list.length*100}%"></div></div>`;
  const insight=important();$('intermediate').innerHTML=`<strong class="number-change">${insight.value}</strong>${insight.note||''}`;
  $('step-error').hidden=!error;$('step-error').textContent=error;
  $('navigation').innerHTML=(phase?'<button class="back" data-action="back" aria-label="Предыдущий вопрос">←</button>':'')+`<button class="next" data-action="next">${phase===list.length-1?'Посмотреть результат':'Продолжить'}</button>`;
  desktopRows().forEach(r=>{const el=$('summary-'+r.key);if(el){el.textContent=summaryFor(r.key);el.classList.toggle('unanswered',r.key==='process'&&!currentTasks().length);}});
  if($('schedule-note'))$('schedule-note').textContent=shortGraph();
  if($('graph-full-note'))$('graph-full-note').textContent=graph(L)?.note||'Календарная оценка зависит от месяца и начала цикла.';
  document.querySelectorAll('[data-model]').forEach(el=>{
    const value=['repeat','duration'].includes(el.dataset.model)?measureFor()[el.dataset.model]:L[el.dataset.model];
    const key={repeat:'frequency',amount:'pay',shifts:'schedule',month:'schedule'}[el.dataset.model]||el.dataset.model;
    if(el.type!=='range')el.setAttribute('aria-invalid',String(value!==''&&!!validate(key)));
  });
  renderResult();
}
function render() {
  document.body.dataset.mode=mode;$('tool-mode').value=mode;
  $('page-title').textContent=mode==='labor'?'Сколько стоит ручная работа?':'Что мешает работать лучше?';
  $('page-description').textContent=mode==='labor'?'Изменяйте параметры — оценка обновится сразу.':'Уточните проблему, чтобы понять, что стоит проверить в первую очередь.';
  const list=phases();phase=Math.min(phase,list.length-1);
  if(mobile.matches&&list[phase]?.task)L.active=list[phase].task;
  const rows=mobile.matches?[{...list[phase],label:qTitles[list[phase].key]}]:desktopRows();
  $('parameters').innerHTML=rows.map(row=>`<section class="parameter-row ${mobile.matches?'mobile-active':''}"><button class="row-toggle" data-action="row" data-value="${row.key}" aria-expanded="${openRow===row.key}" aria-controls="body-${row.key}"><span class="row-copy"><span class="row-label">${row.label}</span><span class="row-answer" id="summary-${row.key}">${escapeText(summaryFor(row.key))}</span></span><span class="row-arrow" aria-hidden="true">›</span></button><div class="row-body" id="body-${row.key}" ${mobile.matches||openRow===row.key?'':'hidden'}>${mobile.matches||openRow===row.key?`<h2 class="question-title desktop-question">${questionTitle(row.key)}</h2>${row.task&&L.tasks.length>1?'<p class="hint">'+labels[row.task]+'</p>':''}${control(row.key)}`:''}</div></section>`).join('');
  $('transfer').innerHTML=mode==='auto'&&A.known?`<p class="transfer-note">Из расчёта: ${A.tasks.map(t=>labels[t]).join(', ')}. Данные уже учтены.</p>`:'';
  refresh();
}
function focusStep() {
  const el=error?$('step-error'):done?$('result'):document.querySelector('.question-title');
  if(el){el.tabIndex=-1;el.focus({preventScroll:true});}
  if(mobile.matches)window.scrollTo({top:0,behavior:'instant'});
}
function switchMode(value,carry=false) {
  if(carry){A.known=JSON.parse(JSON.stringify(L));A.tasks=[...L.tasks];}
  mode=value;phase=0;done=false;error='';openRow='';render();window.scrollTo({top:0,behavior:'instant'});
}
function ensureMeasure() {if(!L.measures[L.active])L.measures[L.active]=emptyMeasure();return L.measures[L.active];}
function refocus(action,value) {
  const el=[...document.querySelectorAll('button[data-action]')].find(el=>el.dataset.action===action&&el.dataset.value===value);
  el?.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button[data-action]');if(!b)return;
  const action=b.dataset.action,value=b.dataset.value;error='';
  exactScheduleOpen=Boolean($('exact-schedule')?.open);
  if(action==='row'){openRow=openRow===value?'':value;render();refocus(action,value);return;}
  if(action==='mode'){switchMode(value);return;}
  if(action==='improve'){switchMode('auto',true);return;}
  if(action==='consult'){
    if(!$('consult-message')){const p=document.createElement('p');p.id='consult-message';p.className='consult-message';p.role='status';p.textContent='Это UX-прототип. Заявка не отправляется.';b.after(p);}return;
  }
  if(action==='edit'){done=false;phase=0;render();focusStep();return;}
  if(action==='back'){phase=Math.max(0,phase-1);render();focusStep();return;}
  if(action==='next'){
    const step=phases()[phase];error=validate(step.key,step.task);
    if(error){refresh();focusStep();return;}
    if(phase===phases().length-1)done=true;else phase++;
    render();focusStep();return;
  }
  if(action==='task'){
    const state=mode==='labor'?L:A;state.tasks=state.tasks.includes(value)?state.tasks.filter(t=>t!==value):[...state.tasks,value];
    if(mode==='labor'){if(!L.tasks.includes(L.active))L.active=L.tasks[0]||'reporting';ensureMeasure();}
  }
  if(action==='active-task')L.active=value;
  if(action==='plus'||action==='minus'){
    L.employees=String(Math.min(10000,Math.max(1,(num(L.employees)||1)+(action==='plus'?1:-1))));
    if($('employees'))$('employees').value=L.employees;refresh();return;
  }
  if(action==='period')ensureMeasure().period=value;
  if(action==='minutes'){const m=ensureMeasure();m.unit='minutes';m.duration=value;customDuration.delete(L.active);}
  if(action==='custom-duration')customDuration.add(L.active);
  if(action==='schedule')L.schedule=value;
  if(action==='unknown-pay'){L.payKind='unknown';L.amount='';}
  if(action==='issue'){A.issue=value;if(value==='unclear'){A.frequency='unknown';A.effect='unknown';}}
  if(action==='problem-frequency')A.frequency=value;
  if(action==='effect')A.effect=value;
  render();refocus(action,value);
});
document.addEventListener('input',event=>{
  const el=event.target,key=el.dataset.model;if(!key)return;error='';
  if(['repeat','duration'].includes(key))ensureMeasure()[key]=el.value;else L[key]=el.value;
  if(key==='repeat'){const pair=$(el.type==='range'?'repeat':'repeat-range');if(pair)pair.value=el.type==='range'?el.value:Math.min(100,num(el.value)||0);}
  refresh();
});
document.addEventListener('change',event=>{
  const el=event.target;exactScheduleOpen=Boolean($('exact-schedule')?.open);
  if(el.id==='tool-mode'){switchMode(el.value);return;}
  if(el.id==='actual'){L.actual=el.checked;render();$('actual')?.focus({preventScroll:true});}
  if(el.id==='pay-kind'){L.payKind=el.value;if(el.value==='unknown')L.amount='';render();$('pay-kind')?.focus({preventScroll:true});}
  if(el.id==='duration-unit'){
    const m=ensureMeasure(),n=num(m.duration);if(n!==null&&m.unit!==el.value)m.duration=String(el.value==='hours'?n/60:n*60);m.unit=el.value;render();$('duration-unit')?.focus({preventScroll:true});
  }
});
mobile.addEventListener('change',()=>{error='';render();});
render();
