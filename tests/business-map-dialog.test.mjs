import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateQuickInsight } from "../lib/business-map/quick-insight.ts";
import { businessMapAiPolicy as policy } from "../config/business-map-ai.ts";
import {
  fitnessScenarios,
  industryScenarios,
  industryNotice,
  scenarioById,
} from "../lib/business-map/dialog/industry.ts";
import {
  initialConversation,
  chooseIndustry,
  addScenarios,
  selectOverflow,
  focusProcess,
  submitText,
  insight,
  processStatus,
  updateProcess,
  removeProcess,
  questionFor,
  offerInterpretation,
  acceptInterpretation,
  rejectInterpretation,
  localPlan,
  summary,
  toCoreProcess,
  saveCompany,
  saveCoreProcess,
  say,
} from "../lib/business-map/dialog/engine.ts";
import { parseWorkloadText } from "../lib/business-map/dialog/language.ts";
import {
  loadDialogDemo,
  dialogDemoNames,
} from "../lib/business-map/dialog/demo.ts";
const start = () =>
  focusProcess(
    addScenarios(chooseIndustry(initialConversation(), "fitness"), [
      "reporting",
    ]),
    "process-reporting",
  );
const answer = (state, text) => submitText(state, text).state;

test("industry-only start needs no company metadata, invented numbers or AI", () => {
  const s = chooseIndustry(initialConversation(), "fitness");
  assert.equal(s.company, null);
  assert.equal(s.processes.length, 0);
  assert.equal(fitnessScenarios.length, 7);
  assert.match(s.messages.at(-1).text, /гипотез/);
  for (const scenario of fitnessScenarios) {
    assert.ok(scenario.questions.length >= 2 && scenario.questions.length <= 4);
    for (const k of [
      "signs",
      "limits",
      "solutions",
      "calculationData",
      "metrics",
    ])
      assert.ok(scenario[k].length);
    assert.ok(scenario.firstAction);
  }
  for (const id of ["retail", "services", "agencies", "other"]) {
    assert.ok(industryScenarios(id).length);
    assert.match(industryNotice(id), /нет специализированной/);
  }
});
test("free description detects scale, systems and three hypotheses without guessing staff", () => {
  const { state: s, needsAi } = submitText(
    initialConversation(),
    "У меня три фитнес-клуба. Менеджеры работают в CRM, вручную собирают отчёты, иногда пропускают заявки, управляющие тратят время на контроль",
  );
  assert.equal(needsAi, true);
  assert.equal(s.industry, "fitness");
  assert.equal(s.locations, 3);
  assert.deepEqual(s.systems, ["crm"]);
  assert.equal(s.processes.length, 3);
  assert.equal(s.company, null);
  for (const p of s.processes) {
    // Explicit «вручную собирают отчёты» is a user fact; missed leads/control stay hypotheses.
    assert.equal(p.confirmed, p.scenarioId === "reporting" ? true : null);
    assert.equal(p.workload.employees, null);
    assert.equal(insight(p, s.company).hours, null);
  }
});

test("acceptance A preserves Craft as a literal mention and separates manual reporting from a leads hypothesis", () => {
  const s = answer(initialConversation(), "У меня три фитнес-клуба. Менеджеры работают в Craft, руководители ежедневно собирают отчёты вручную, а часть заявок из разных каналов остаётся без внимания");
  assert.equal(s.industry, "fitness");
  assert.equal(s.locations, 3);
  assert.deepEqual(s.systemMentions, ["Craft"]);
  assert.deepEqual(s.systems, []); // Brand mention is not verified CRM functionality.
  assert.deepEqual(s.processes.map(p => p.scenarioId), ["reporting", "missed-leads"]);
  assert.equal(s.processes[0].confirmed, true);
  assert.equal(s.processes[1].confirmed, null);
  assert.equal(s.question, "volume");
  assert.ok(s.messages.some(m => /Первый полезный шаг/.test(m.text)));
  assert.ok(s.messages.some(m => /Гипотеза:.*Потерянные продажи пока не подтверждены/.test(m.text)));
  for (const p of s.processes) {
    assert.equal(p.workload.employees, null);
    assert.equal(p.workload.hourlyRate, null);
    assert.equal(insight(p, null).hours, null);
    assert.equal(insight(p, null).timeCost, null);
  }
  for (const text of ["Отчёты не собирают вручную", "Вручную отчёты не готовят", "Возможны ручные отчёты", "Возможно, менеджеры будут собирать отчёты вручную", "Возможно, менеджеры собирают отчёты вручную", "Менеджеры собирают отчёты вручную?", "Если менеджеры собирают отчёты вручную"])
    assert.equal(answer(initialConversation(),text).processes[0].confirmed, null);
});

test("acceptance C parses the per-person denominator without turning it into headcount", () => {
  for (const denominator of ["одного", "1"]){
    let s = answer(start(), "Да");
    s = answer(s, `Четыре операции в день на ${denominator} сотрудника. Десять сотрудников. Двенадцать минут на операцию.`);
    const p = s.processes[0];
    assert.equal(p.workload.employees, 10);
    assert.equal(p.workload.operations, 4);
    assert.equal(p.workload.scope, "per-person");
    assert.equal(insight(p,null).teamOperations, 40);
    assert.equal(insight(p,null).hours.exact, "168/1");
    assert.equal(insight(p,null).timeCost, null);
    s = saveCompany(s, { industry:"fitness",headcount:"11-50",goal:"speed",systems:["unknown"],salary:null });
    s = saveCoreProcess(s, toCoreProcess(p,s.company));
    assert.equal(s.processes[0].core.operations, 40);
    assert.equal(s.processes[0].result.hours.exact, "168/1");
    assert.equal(insight(s.processes[0],s.company).hours.exact, "168/1");
    assert.equal(s.processes[0].result.timeCost, null);
  }
  assert.equal(parseWorkloadText("4 операции в день на 1 сотрудника").employees, undefined);
});

test("explicit corrections update current facts, recalculate and retain the unanswered risk question", () => {
  let s = answer(answer(start(), "Да"), "4 операции в день на одного сотрудника, 10 сотрудников, 12 минут");
  assert.equal(s.question,"risk");
  s = answer(s,"Исправление: 5 сотрудников");
  assert.equal(s.processes[0].workload.employees,5);
  assert.equal(insight(s.processes[0],null).hours.exact,"84/1");
  assert.equal(s.processes[0].error,"unknown");
  assert.equal(s.question,"risk");
  s = answer(s,"Исправление: -5 сотрудников");
  assert.equal(s.processes[0].workload.employees,5);
  assert.equal(s.processes[0].error,"unknown");
  s = answer(s,"Исправление формулировки");
  assert.equal(s.processes[0].error,"unknown");
  assert.equal(s.question,"risk");
  s = answer(s,"Мелкая, легко исправить");
  assert.equal(s.processes[0].error,"minor");
});

test("a pending interpretation cannot overwrite edits or resurrect a deleted process", () => {
  const base = loadDialogDemo("portfolio");
  const p = base.processes[0];
  const proposal = {industry:"fitness",locations:null,scaleEvidence:null,systems:[],facts:[],hypotheses:[{scenarioId:p.scenarioId,reason:"Возможно, есть ручная работа"}],workloads:[{scenarioId:p.scenarioId,employees:10,operations:4,scope:"per-person",period:"day",minutes:12,evidence:"synthetic fixture"}]};
  for (const mutate of [
    s => updateProcess(s,p.id,{workload:{...p.workload,operations:8}}),
    s => removeProcess(s,p.id),
    s => saveCoreProcess(s,{...p.core,operations:8}),
    s => saveCompany(s,{...s.company,monthlyHours:100}),
    s => chooseIndustry(s,"services"),
    s => answer(s,"Новое описание для проверки"),
  ]) {
    const offered = offerInterpretation({...base,advice:Object.fromEntries(base.processes.map(x=>[x.id,localPlan(x,base.company)]))},proposal);
    const edited=mutate(offered);
    assert.equal(edited.proposal,null);
    assert.equal(edited.proposalSource,null);
    assert.deepEqual(edited.advice,{});
    assert.deepEqual(acceptInterpretation(edited),edited);
  }
});

test("message IDs stay unique when more than two full histories are truncated", () => {
  let s = initialConversation();
  for(let i=0;i<policy.maxMessages*3;i++) s=say(s,"Synthetic history fixture");
  assert.equal(s.messages.length,policy.maxMessages);
  assert.equal(new Set(s.messages.map(m=>m.id)).size,policy.maxMessages);
  assert.equal(s.messageSequence,policy.maxMessages*3);
});
test("short replies complete four main questions and produce 42 h; salary remains absent", () => {
  let s = start();
  assert.equal(s.question, "confirm");
  s = answer(s, "Да");
  assert.match(s.messages.at(-2).text, /Первый полезный шаг/);
  assert.equal(s.question, "volume");
  s = answer(s, "10");
  assert.equal(s.question, "duration");
  s = answer(s, "12");
  assert.equal(s.question, "risk");
  s = answer(s, "Мелкая, легко исправить");
  const p = s.processes[0];
  assert.equal(s.question, null);
  assert.equal(s.diagnosticEnded, true);
  assert.equal(insight(p, s.company).hours.exact, "42/1");
  assert.equal(insight(p, s.company).timeCost, null);
  assert.deepEqual(p.asked, ["confirm", "volume", "duration", "risk"]);
  assert.equal(p.result, null);
  assert.equal(processStatus(p, s.company), "insufficient");
});
test("unknown answers never loop and return a practical action with no fictional hours", () => {
  let s = start();
  s = answer(s, "Не знаю");
  assert.equal(s.question, null);
  assert.match(s.messages.at(-1).text, /Первый шаг/);
  assert.equal(insight(s.processes[0], null).hours, null);
  s = start();
  for (const value of ["Да", "Не знаю", "Не знаю", "Не знаю"])
    s = answer(s, value);
  assert.equal(s.question, null);
  assert.equal(s.processes[0].workload.operations, null);
  assert.equal(s.processes[0].workload.minutes, null);
  assert.equal(s.processes[0].error, "unknown");
});
test("per-person 4 × 10 becomes team 40 exactly once, not 160; core adapter retains 40", () => {
  const parsed = parseWorkloadText(
    "четыре сотрудника делают по десять отчётов в день, на каждый 12 минут",
  );
  assert.deepEqual(parsed, {
    employees: 4,
    operations: 10,
    scope: "per-person",
    period: "day",
    minutes: 12,
  });
  let s = start();
  s = answer(
    s,
    "Да, четыре сотрудника делают по десять отчётов в день, 12 минут",
  );
  const p = s.processes[0],
    q = insight(p, null);
  assert.equal(q.teamOperations, 40);
  assert.equal(q.hours.exact, "168/1");
  assert.equal(s.question, "risk");
  const company = {
    industry: "fitness",
    headcount: "11-50",
    goal: "speed",
    systems: ["crm"],
    salary: null,
  };
  const core = toCoreProcess(p, company);
  assert.equal(core.operations, 40);
  s = saveCompany(s, company);
  s = saveCoreProcess(s, core);
  assert.equal(s.processes[0].result.hours.exact, "168/1");
  assert.equal(s.processes[0].workload.scope, "team");
  assert.equal(insight(s.processes[0], company).hours.exact, "168/1");
});
test("ambiguous text asks scope, then staff once if needed", () => {
  let s = start();
  s = answer(s, "Да, 10 отчётов в день, 12 минут");
  assert.equal(s.question, "scope");
  assert.equal(insight(s.processes[0], null).hours, null);
  s = answer(s, "На одного сотрудника");
  assert.equal(s.question, "staff");
  s = answer(s, "4");
  assert.equal(s.question, "risk");
  assert.equal(insight(s.processes[0], null).hours.exact, "168/1");
  assert.equal(s.processes[0].asked.filter((q) => q === "scope").length, 1);
  assert.equal(s.processes[0].asked.filter((q) => q === "staff").length, 1);
});
test("known facts skip questions; weekly context and decimal comma work", () => {
  let s = start();
  s = answer(s, "Да, 10 отчётов всей командой в неделю, 12 минут");
  assert.equal(s.question, "risk");
  const q = insight(s.processes[0], null);
  assert.equal(q.hours.exact, "26/3");
  assert.equal(q.hours.display, 8.7);
  s = start();
  s = answer(s, "Да");
  s = answer(s, "10 в неделю");
  s = answer(s, "2,5");
  assert.equal(insight(s.processes[0], null).hours.exact, "65/36");
});
test("team frequency is not multiplied by staff; direct rate is time value only", () => {
  const q = calculateQuickInsight(
    {
      employees: 4,
      operations: 10,
      scope: "team",
      period: "day",
      minutes: 12,
      hourlyRate: 1000,
    },
    scenarioById("reporting"),
  );
  assert.equal(q.hours.exact, "42/1");
  assert.equal(q.timeCost.exact, "42000/1");
  assert.equal("cashReduction" in q, false);
});
test("zero volume is valid and rounds without negative/NaN; boundaries reject overflow", () => {
  const s = start(),
    w = {
      ...s.processes[0].workload,
      operations: 0,
      scope: "team",
      period: "day",
      minutes: 1,
    };
  const q = calculateQuickInsight(w, scenarioById("reporting"));
  assert.equal(q.hours.value, 0);
  assert.equal(q.hours.exact, "0/1");
  for (const patch of [
    { minutes: 0 },
    { minutes: 601 },
    { operations: Infinity },
    { operations: NaN },
    { employees: 1.5 },
    { hourlyRate: -1 },
    { operations: 1000 },
  ])
    assert.throws(
      () =>
        calculateQuickInsight({ ...w, ...patch }, scenarioById("reporting")),
      RangeError,
    );
});
test("capacity warning blocks a confident pilot and uses configured working fund", () => {
  let s = loadDialogDemo("capacity");
  const p = s.processes[0];
  assert.equal(p.result.flags.includes("W-CAPACITY"), true);
  assert.notEqual(p.result.group, "first");
  assert.equal(processStatus(p, s.company), "prepare");
  assert.match(summary(p, s.company), /заблокирована/);
  assert.ok(insight(p, s.company).warnings.includes("W-CAPACITY"));
  assert.equal(
    processStatus(p, { ...s.company, monthlyHours: 744 }),
    "prepare",
  ); // 2100 > 744
});
test("critical and unnecessary processes stop without an automation promise", () => {
  let s = start();
  s = answer(s, "Да");
  s = answer(s, "10");
  s = answer(s, "12");
  s = answer(s, "Критические последствия");
  assert.equal(s.question, null);
  assert.equal(processStatus(s.processes[0], null), "not-recommended");
  assert.equal(localPlan(s.processes[0]).approach, "wait");
  s = start();
  s = answer(s, "Нет, проблемы нет");
  assert.equal(s.question, null);
  assert.equal(processStatus(s.processes[0], null), "not-recommended");
  assert.equal(localPlan(s.processes[0]).approach, "wait");
});
test("more than five candidates require user selection; no sixth active process", () => {
  let s = submitText(
    initialConversation(),
    "фитнес: отчёты, перенос данных, теряются заявки, медленный ответ, обучение, контроль продаж, продления абонементов",
  ).state;
  assert.equal(s.processes.length, 0);
  assert.equal(s.overflow.length, 7);
  const tooMany = selectOverflow(s, s.overflow);
  assert.equal(tooMany, s);
  s = selectOverflow(s, s.overflow.slice(0, 5));
  assert.equal(s.processes.length, 5);
  assert.equal(s.overflow.length, 0);
  s = addScenarios(s, ["renewals"]);
  assert.equal(s.processes.length, 5);
  assert.equal(s.overflow[0], "renewals");
});
test("editing prior data recalculates, invalidates AI plan and supports rename/delete", () => {
  let s = loadDialogDemo("portfolio"),
    p = s.processes[0];
  s = { ...s, advice: { [p.id]: localPlan(p) } };
  const previous = p.result.hours.value;
  s = updateProcess(s, p.id, {
    name: "Новый отчёт",
    workload: { ...p.workload, operations: 20 },
  });
  assert.equal(s.processes[0].result.hours.value, previous / 2);
  assert.equal(s.processes[0].name, "Новый отчёт");
  assert.equal(s.advice[p.id], undefined);
  s = removeProcess(s, p.id);
  assert.equal(s.processes.length, 2);
  assert.ok(s.processes.every((x) => !x.core.overlapsWith.includes(p.id)));
});
test("an AI hypothesis cannot change facts until confirmation and can be rejected/corrected", () => {
  let s = start();
  const before = structuredClone(s.processes),
    proposal = {
      industry: "fitness",
      locations: 3,
      scaleEvidence: "три клуба",
      systems: [],
      facts: [],
      hypotheses: [
        { scenarioId: "onboarding", reason: "Возможно, нужно обучение" },
      ],
      workloads: [
        {
          scenarioId: "reporting",
          employees: 4,
          operations: 10,
          scope: "per-person",
          period: "day",
          minutes: 12,
          evidence: "четыре сотрудника по десять отчётов, 12 минут",
        },
      ],
    };
  s = offerInterpretation(s, proposal);
  assert.deepEqual(s.processes, before);
  s = rejectInterpretation(s);
  assert.equal(s.proposal, null);
  assert.deepEqual(s.processes, before);
  s = offerInterpretation(s, {
    ...proposal,
    hypotheses: [
      { scenarioId: "reporting", reason: "Возможна ручная отчётность" },
    ],
  });
  s = acceptInterpretation(s);
  assert.equal(insight(s.processes[0], null).hours.exact, "168/1");
  assert.equal(s.locations, 3);
  assert.equal(s.processes[0].confirmed, null);
  assert.equal(questionFor(s.processes[0]), "confirm");
});
test("very long text does not mutate the map or ask the provider", () => {
  const s = start(),
    out = submitText(s, "x".repeat(policy.maxMessageCharacters + 1));
  assert.equal(out.needsAi, false);
  assert.deepEqual(out.state.processes, s.processes);
  assert.match(out.state.messages.at(-1).text, /не отправлялись/);
});
test("all synthetic demos remain isolated; no provider answer is fabricated", () => {
  for (const id of Object.keys(dialogDemoNames)) {
    const s = loadDialogDemo(id);
    assert.ok(s.processes.length <= 5);
    assert.equal(s.messages[0].source, "demo");
  }
  const one = loadDialogDemo("portfolio");
  one.processes[0].workload.operations = 999;
  assert.equal(
    loadDialogDemo("portfolio").processes[0].workload.operations,
    40,
  );
  assert.ok(
    loadDialogDemo("payback").processes[0].result.scenarios.every(
      (s) => s.payback.status === "not-recoverable",
    ),
  );
});
test("rejecting a previously calculated problem removes its actionable priority", () => {
  let s = loadDialogDemo("portfolio");
  const id = s.processes[0].id;
  assert.equal(s.processes[0].result.group, "first");
  s = updateProcess(s, id, { confirmed: false });
  assert.equal(s.processes[0].result, null);
  assert.equal(processStatus(s.processes[0], s.company), "not-recommended");
  assert.equal(localPlan(s.processes[0]).approach, "wait");
});
test("full high-risk and missing assessments retain their honest live-map statuses", () => {
  const risk = loadDialogDemo("risk");
  assert.equal(risk.processes[0].result.group, "later");
  assert.equal(processStatus(risk.processes[0], risk.company), "prepare");
  const missing = loadDialogDemo("missing");
  assert.equal(
    processStatus(missing.processes[0], missing.company),
    "insufficient",
  );
});
test("capacity blocks a pilot plan and respects an explicitly edited company working fund", () => {
  let s = loadDialogDemo("portfolio");
  s = saveCompany(s, { ...s.company, monthlyHours: 40 });
  const p = s.processes[0];
  assert.ok(p.result.flags.includes("W-CAPACITY"));
  assert.equal(localPlan(p, s.company).approach, "wait");
  assert.match(localPlan(p, s.company).firstStep, /сверить нагрузку/);
  s = saveCompany(s, { ...s.company, monthlyHours: 200 });
  assert.equal(s.processes[0].result.flags.includes("W-CAPACITY"), false);
  assert.equal(processStatus(s.processes[0], s.company), "pilot");
  assert.notEqual(localPlan(s.processes[0], s.company).approach, "wait");
});
test("proposal provenance stays explicit when a real response follows a demo", () => {
  const demo = loadDialogDemo("correction");
  assert.equal(demo.proposalSource, "demo");
  const response = offerInterpretation(demo, demo.proposal);
  assert.equal(response.proposalSource, "openai");
  assert.equal(rejectInterpretation(response).proposalSource, null);
  assert.equal(acceptInterpretation(response).proposalSource, null);
});
test("negative free-text values retain their sign and cannot become positive workload or scale", () => {
  assert.equal(
    parseWorkloadText("минус десять отчётов в день").operations,
    -10,
  );
  assert.equal(parseWorkloadText("−4 сотрудника, -12 минут").employees, -4);
  assert.equal(parseWorkloadText("−4 сотрудника, -12 минут").minutes, -12);
  let s = answer(start(), "Да");
  s = answer(s, "-10 отчётов в день");
  assert.equal(s.processes[0].workload.operations, null);
  assert.equal(insight(s.processes[0], null).hours, null);
  s = answer(s, "10");
  s = answer(s, "минус 12 минут");
  assert.equal(s.processes[0].workload.minutes, null);
  assert.equal(
    submitText(initialConversation(), "У меня -3 фитнес-клуба, ручные отчёты")
      .state.locations,
    null,
  );
});
test("editing company context updates the live industry/systems and discards a stale proposal", () => {
  let s = loadDialogDemo("correction");
  s = saveCompany(s, {
    industry: "agencies",
    headcount: "11-50",
    goal: "speed",
    systems: ["mail"],
    salary: null,
  });
  assert.equal(s.industry, "agencies");
  assert.deepEqual(s.systems, ["mail"]);
  assert.equal(s.proposal, null);
  assert.equal(s.proposalSource, null);
  s = saveCompany(s, { ...s.company, industry: "manufacturing" });
  assert.equal(s.industry, "other");
  assert.equal(s.company.industry, "manufacturing");
});
