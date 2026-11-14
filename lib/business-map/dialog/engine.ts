import { businessMapAiPolicy as policy } from "../../../config/business-map-ai.ts";
import { calculateBusinessMap } from "../calculate.ts";
import { calculateQuickInsight } from "../quick-insight.ts";
import type { Company, Process } from "../contracts.ts";
import type {
  Advice,
  ConversationState,
  Industry,
  Interpretation,
  LiveProcess,
  LiveStatus,
  Message,
  QuestionKey,
  ScenarioId,
  Workload,
} from "./contracts.ts";
import {
  industryNames,
  industryNotice,
  scenarioById,
  fitnessScenarios,
} from "./industry.ts";
import {
  normalizeNumbers,
  parseWorkloadText,
  unknownAnswer,
} from "./language.ts";
export const emptyWorkload = (): Workload => ({
  employees: null,
  operations: null,
  scope: "unknown",
  period: null,
  minutes: null,
  hourlyRate: null,
});
export const initialConversation = (): ConversationState => ({
  industry: null,
  locations: null,
  systems: [],
  company: null,
  processes: [],
  overflow: [],
  messages: [],
  activeId: null,
  question: null,
  proposal: null,
  proposalSource: null,
  advice: {},
  revision: 0,
  diagnosticEnded: false,
});
export function say(
  state: ConversationState,
  text: string,
  source: Message["source"] = "rules",
  role: Message["role"] = "assistant",
): ConversationState {
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        id: `m-${state.revision}-${state.messages.length}`,
        role,
        text,
        source,
      },
    ].slice(-policy.maxMessages),
  };
}
export function newProcess(id: ScenarioId): LiveProcess {
  return {
    id: `process-${id}`,
    scenarioId: id,
    name: scenarioById(id).name,
    confirmed: null,
    facts: [],
    hypotheses: [scenarioById(id).problem],
    workload: emptyWorkload(),
    error: "unknown",
    asked: [],
    core: null,
    result: null,
  };
}
export const insight = (p: LiveProcess, c: Company | null) =>
  calculateQuickInsight(
    p.workload,
    scenarioById(p.scenarioId),
    p.core?.monthlyHours ?? c?.monthlyHours,
  );
export function hasCapacityWarning(p: LiveProcess, c: Company | null): boolean {
  return p.result
    ? p.result.flags.includes("W-CAPACITY")
    : insight(p, c).warnings.includes("W-CAPACITY");
}
export function processStatus(p: LiveProcess, c: Company | null): LiveStatus {
  if (
    p.confirmed === false ||
    p.error === "critical" ||
    p.result?.group === "excluded" ||
    p.result?.group === "not-now"
  )
    return "not-recommended";
  if (hasCapacityWarning(p, c) || p.result?.group === "prepare")
    return "prepare";
  if (p.result?.group === "first") return "pilot";
  if (p.result?.group === "later") return "prepare";
  if (p.result?.group === "insufficient" || p.result?.group === "preliminary")
    return "insufficient";
  if (p.confirmed === null)
    return p.asked.length ? "insufficient" : "discovered";
  if (p.asked.includes("risk")) return "insufficient";
  return "clarifying";
}
export const statusNames: Record<LiveStatus, string> = {
  discovered: "Обнаружено",
  clarifying: "Уточняем",
  insufficient: "Данных недостаточно",
  pilot: "Перспективно для пилота",
  prepare: "Сначала подготовить",
  "not-recommended": "Не рекомендуется автоматизировать",
};
export function questionFor(p: LiveProcess): QuestionKey | null {
  if (p.confirmed === null)
    return p.asked.includes("confirm") ? null : "confirm";
  if (p.confirmed === false) return null;
  if (
    (p.workload.operations === null || p.workload.period === null) &&
    !p.asked.includes("volume")
  )
    return "volume";
  if (
    p.workload.operations !== null &&
    p.workload.scope === "unknown" &&
    !p.asked.includes("scope")
  )
    return "scope";
  if (
    p.workload.operations !== null &&
    p.workload.scope === "per-person" &&
    p.workload.employees === null &&
    !p.asked.includes("staff")
  )
    return "staff";
  if (p.workload.minutes === null && !p.asked.includes("duration"))
    return "duration";
  if (p.error === "unknown" && !p.asked.includes("risk")) return "risk";
  return null;
}
export function questionText(p: LiveProcess, q: QuestionKey): string {
  return {
    confirm: `«${p.name}»: это действительно повторяющаяся ручная работа в вашем примере?`,
    volume:
      "Сколько выполнений делает вся команда за день? Можно ответить числом или описать частоту за другой период.",
    duration:
      "Сколько минут занимает одно выполнение, включая обычную проверку?",
    risk: "Что произойдёт при ошибке в этом процессе?",
    staff:
      "Сколько человек выполняют эту работу? Вы назвали объём на сотрудника; это нужно для однократного пересчёта на команду.",
    scope:
      p.workload.scope === "per-person"
        ? "Вы назвали объём на сотрудника. Сколько человек выполняют эту работу? Это нужно, чтобы один раз получить объём всей команды."
        : "Это количество на всю команду или на одного сотрудника? Без этого нельзя посчитать часы: возможен двойной подсчёт.",
  }[q];
}
export function focusProcess(
  state: ConversationState,
  id: string,
): ConversationState {
  const p = state.processes.find((p) => p.id === id);
  if (!p) return state;
  const question = p.error === "critical" ? null : questionFor(p);
  let next: ConversationState = {
    ...state,
    activeId: id,
    question,
    diagnosticEnded: question === null,
    revision: state.revision + 1,
  };
  next = say(
    next,
    question ? questionText(p, question) : summary(p, state.company),
  );
  return next;
}
export function chooseIndustry(
  state: ConversationState,
  industry: Industry,
): ConversationState {
  return say(
    { ...state, industry, revision: state.revision + 1 },
    `${industryNames[industry]}. ${industryNotice(industry)}\nСначала стоит проверить повторный ввод данных, обращения без ответа и ручную отчётность. Выберите знакомую ситуацию или опишите её своими словами.`,
  );
}
export function addScenarios(
  state: ConversationState,
  ids: ScenarioId[],
): ConversationState {
  const fresh = [...new Set(ids)].filter(
    (id) => !state.processes.some((p) => p.scenarioId === id),
  );
  if (fresh.length > policy.maxProcesses - state.processes.length)
    return say(
      { ...state, overflow: fresh, revision: state.revision + 1 },
      "В описании больше процессов, чем помещается в карту. Выберите основные: всего может быть до пяти. Остальные не будут добавлены автоматически.",
    );
  return {
    ...state,
    processes: [...state.processes, ...fresh.map(newProcess)],
    revision: state.revision + 1,
  };
}
export function selectOverflow(
  state: ConversationState,
  ids: ScenarioId[],
): ConversationState {
  if (
    ids.length > policy.maxProcesses - state.processes.length ||
    ids.some((id) => !state.overflow.includes(id))
  )
    return state;
  let next = addScenarios({ ...state, overflow: [] }, ids);
  if (!next.activeId && next.processes[0])
    next = focusProcess(next, next.processes[0].id);
  return next;
}
export function summary(p: LiveProcess, company: Company | null): string {
  if (p.confirmed === false)
    return "Проблема не подтвердилась. Пока не автоматизируйте этот процесс. При изменении ситуации его можно проверить заново.";
  const quick = insight(p, company);
  const currentHours = p.result?.hours ?? quick.hours;
  const h = currentHours
    ? `По вашим данным: ${currentHours.display.toLocaleString("ru-RU")} ч в месяц на всю команду. Это текущее время, а не обещанное высвобождение.\n`
    : "Пока не хватает данных для часов. Ничего не подставляем вместо неизвестных значений.\n";
  const warning = hasCapacityWarning(p, company)
    ? "Нагрузка больше рабочего фонда команды. Сначала сверить объём и время; уверенная рекомендация пилота заблокирована.\n"
    : "";
  const risk =
    p.error === "critical"
      ? "Критическая цена ошибки: автономная автоматизация не рекомендуется. Сначала экспертная проверка и ручной контроль.\n"
      : "";
  return `${h}${warning}${risk}Первый шаг: ${quick.firstAction}\nСтоимость времени и денежная экономия — разные показатели. Для сценариев и приоритета можно отдельно уточнить условия процесса.`;
}
function recalculate(state: ConversationState): ConversationState {
  const inputs = state.processes.flatMap((p) =>
    p.core && p.confirmed !== false
      ? [
          {
            ...p.core,
            overlapsWith: p.core.overlapsWith.filter((id) =>
              state.processes.some((x) => x.id === id && x.confirmed !== false),
            ),
          },
        ]
      : [],
  );
  const result =
    state.company && inputs.length
      ? calculateBusinessMap({ company: state.company, processes: inputs })
      : null;
  return {
    ...state,
    processes: state.processes.map((p) => ({
      ...p,
      result: result?.processes.find((r) => r.id === p.id) ?? null,
    })),
  };
}
export function updateProcess(
  state: ConversationState,
  id: string,
  patch: Partial<
    Pick<LiveProcess, "name" | "workload" | "error" | "confirmed" | "facts">
  >,
): ConversationState {
  const old = state.processes.find((p) => p.id === id);
  if (!old) return state;
  const p = { ...old, ...patch };
  insight(p, state.company); // reject invalid numeric input before committing state
  if (p.core) {
    const q = insight(p, state.company);
    p.core = {
      ...p.core,
      name: p.name,
      employees: p.workload.employees,
      operations: p.workload.period ? q.teamOperations : null,
      period: p.workload.period ?? p.core.period,
      minutes: p.workload.minutes,
      hourlyRate: p.workload.hourlyRate,
      error: p.error,
    };
  }
  const advice = { ...state.advice };
  delete advice[id];
  return recalculate({
    ...state,
    processes: state.processes.map((x) => (x.id === id ? p : x)),
    advice,
    revision: state.revision + 1,
  });
}
export function removeProcess(
  state: ConversationState,
  id: string,
): ConversationState {
  const advice = { ...state.advice };
  delete advice[id];
  return say(
    recalculate({
      ...state,
      processes: state.processes
        .filter((p) => p.id !== id)
        .map((p) =>
          p.core
            ? {
                ...p,
                core: {
                  ...p.core,
                  overlapsWith: p.core.overlapsWith.filter((x) => x !== id),
                },
              }
            : p,
        ),
      activeId: state.activeId === id ? null : state.activeId,
      question: state.activeId === id ? null : state.question,
      advice,
      revision: state.revision + 1,
    }),
    "Процесс удалён из карты. Результаты пересчитаны.",
  );
}
export function saveCompany(
  state: ConversationState,
  company: Company,
): ConversationState {
  return recalculate({
    ...state,
    company,
    industry: ["fitness", "retail", "services", "agencies", "other"].includes(
      company.industry,
    )
      ? (company.industry as Industry)
      : "other",
    systems: [...company.systems],
    proposal: null,
    proposalSource: null,
    revision: state.revision + 1,
    advice: {},
  });
}
export function toCoreProcess(p: LiveProcess, c: Company): Process {
  if (!p.workload.period)
    throw new RangeError(
      "Укажите период в редактировании времени перед полным расчётом.",
    );
  const q = insight(p, c);
  return (
    p.core ?? {
      id: p.id,
      name: p.name,
      employees: p.workload.employees,
      operations: q.teamOperations,
      period: p.workload.period,
      minutes: p.workload.minutes,
      hourlyRate: p.workload.hourlyRate,
      error: p.error,
      source: "unknown",
      mechanical: "unknown",
      systems: null,
      regulation: "unknown",
      exceptions: "unknown",
      judgment: "unknown",
      access: "unknown",
      personalData: "unknown",
      independent: false,
      overlapsWith: [],
    }
  );
}
export function saveCoreProcess(
  state: ConversationState,
  core: Process,
): ConversationState {
  const p = state.processes.find((p) => p.id === core.id);
  if (!p) return state;
  const advice = { ...state.advice };
  delete advice[p.id];
  return say(
    recalculate({
      ...state,
      processes: state.processes.map((p) =>
        p.id !== core.id
          ? p
          : {
              ...p,
              name: core.name,
              core,
              confirmed: true,
              error: core.error,
              workload: {
                employees: core.employees,
                operations: core.operations,
                scope: "team",
                period: core.period,
                minutes: core.minutes,
                hourlyRate: core.hourlyRate ?? null,
              },
            },
      ),
      advice,
      revision: state.revision + 1,
    }),
    "Условия процесса обновлены. Три сценария, риски и приоритет пересчитаны существующим ядром.",
    "core",
  );
}
export function submitText(
  state: ConversationState,
  text: string,
): { state: ConversationState; needsAi: boolean } {
  const clean = text.trim();
  if (!clean) return { state, needsAi: false };
  if (clean.length > policy.maxMessageCharacters)
    return {
      state: say(
        state,
        `Сообщение длиннее ${policy.maxMessageCharacters} символов. Сократите его; данные не отправлялись.`,
      ),
      needsAi: false,
    };
  let next = say(
    { ...state, revision: state.revision + 1 },
    clean,
    "user",
    "user",
  );
  const p = next.processes.find((p) => p.id === next.activeId);
  if (!p || !next.question) {
    if (!next.industry && /фитнес|клуб[а-я-]*/iu.test(clean))
      next = chooseIndustry(next, "fitness");
    const location = normalizeNumbers(clean).match(
      /(-?\d+(?:\.\d+)?)\s*(?:фитнес[- ]?)?клуб/u,
    );
    if (location) {
      const count = Number(location[1]);
      if (
        Number.isSafeInteger(count) &&
        count >= 1 &&
        count <= policy.maxLocations
      )
        next = { ...next, locations: count };
      else
        next = say(
          next,
          "Число подразделений нужно уточнить: отрицательное или дробное значение не применено.",
        );
    }
    const systems = [...next.systems];
    if (/CRM|срм/iu.test(clean) && !systems.includes("crm"))
      systems.push("crm");
    if (/таблиц/iu.test(clean) && !systems.includes("tables"))
      systems.push("tables");
    next = { ...next, systems };
    const found = fitnessScenarios
      .filter((s) => s.keywords.test(clean))
      .map((s) => s.id);
    next = addScenarios(next, found);
    const targets = next.processes.filter((x) => found.includes(x.scenarioId));
    if (targets.length === 1) {
      try {
        next = updateProcess(next, targets[0].id, {
          workload: { ...targets[0].workload, ...parseWorkloadText(clean) },
          facts: [...targets[0].facts, clean.slice(0, 300)].slice(-8),
        });
      } catch {
        next = say(
          next,
          "Числа в описании выходят за границы расчёта. Уточните их в редактировании процесса.",
        );
      }
    }
    if (found.length > 0 && !next.overflow.length) {
      const first = next.processes.find((x) => found.includes(x.scenarioId));
      if (first) next = focusProcess(next, first.id);
    } else if (!next.overflow.length)
      next = say(
        next,
        "Я пока не могу уверенно связать описание с процессом. Выберите ближайшую отраслевую гипотезу. Неизвестные данные останутся пустыми.",
      );
    return { state: next, needsAi: true };
  }
  const q = next.question!,
    unknown = unknownAnswer(clean),
    parsed = parseWorkloadText(clean),
    plain = Number(normalizeNumbers(clean));
  const patch: Partial<LiveProcess> = { asked: [...new Set([...p.asked, q])] };
  let recognized = unknown;
  if (!unknown) {
    if (q === "confirm") {
      if (
        /^(?:нет|не нужно|не нужна|не требуется|проблемы нет|нет проблемы)/iu.test(
          clean,
        )
      )
        patch.confirmed = false;
      else if (
        /^(?:да|верно|есть|вручную|так и есть)/iu.test(clean) ||
        Object.keys(parsed).length
      ) {
        patch.confirmed = true;
        patch.workload = { ...p.workload, ...parsed };
      }
      recognized = patch.confirmed !== undefined;
    } else if (q === "volume") {
      if (clean !== "" && Number.isFinite(plain) && plain >= 0) {
        patch.workload = {
          ...p.workload,
          operations: plain,
          scope: "team",
          period: "day",
        };
        recognized = true;
      } else if (parsed.operations !== undefined) {
        patch.workload = {
          ...p.workload,
          ...parsed,
          scope: parsed.scope === "per-person" ? "per-person" : "team",
        };
        recognized = true;
      }
    } else if (q === "scope" || q === "staff") {
      if (q === "staff" && Number.isFinite(plain) && plain > 0) {
        patch.workload = { ...p.workload, employees: plain };
        recognized = true;
      } else if (/вс[еяю]|команд|общ|вместе/iu.test(clean)) {
        patch.workload = { ...p.workload, scope: "team" };
        recognized = true;
      } else if (/сотрудник|человек|кажд|по /iu.test(clean)) {
        patch.workload = { ...p.workload, ...parsed, scope: "per-person" };
        recognized = true;
      }
    } else if (q === "duration") {
      const minutes =
        parsed.minutes ?? (Number.isFinite(plain) ? plain : undefined);
      if (minutes !== undefined) {
        patch.workload = { ...p.workload, minutes };
        recognized = true;
      }
    } else if (q === "risk") {
      const error = /критич|здоров|безопасност|необратим/iu.test(clean)
        ? "critical"
        : /серь[её]з|ущерб/iu.test(clean)
          ? "serious"
          : /заметн|повторн.*работ/iu.test(clean)
            ? "noticeable"
            : /мелк|незнач|легко|исправ/iu.test(clean)
              ? "minor"
              : null;
      if (error) {
        patch.error = error;
        recognized = true;
      }
    }
  }
  try {
    next = updateProcess(next, p.id, patch); // numeric errors leave previous values intact
    next = {
      ...next,
      processes: next.processes.map((x) =>
        x.id === p.id
          ? {
              ...x,
              asked: patch.asked!,
              facts:
                !unknown && recognized
                  ? [
                      ...x.facts,
                      `${questionText(p, q)} — ${clean}`.slice(0, 300),
                    ].slice(-8)
                  : x.facts,
            }
          : x,
      ),
    };
    if (!recognized)
      next = say(
        next,
        "Не стал превращать этот ответ в число или факт. Поле осталось неизвестным; его можно исправить в карте. Передам описание ИИ, если он доступен.",
      );
    const updated = next.processes.find((x) => x.id === p.id)!,
      question = questionFor(updated);
    // Critical and rejected processes stop early instead of asking irrelevant workload questions.
    const stopped = updated.error === "critical" || updated.confirmed === false;
    next = {
      ...next,
      question: stopped ? null : question,
      diagnosticEnded: stopped || question === null,
    };
    if (q === "confirm" && updated.confirmed === true)
      next = say(
        next,
        `Первый полезный шаг: ${scenarioById(p.scenarioId).firstAction}`,
      );
    next = say(
      next,
      !stopped && question
        ? questionText(updated, question)
        : summary(updated, next.company),
      question && !stopped ? "rules" : "core",
    );
  } catch (error) {
    next = say(
      next,
      error instanceof RangeError
        ? error.message
        : "Проверьте введённые данные. Они не изменены.",
    );
  }
  return { state: next, needsAi: !recognized && !unknown };
}
export function offerInterpretation(
  state: ConversationState,
  proposal: Interpretation,
): ConversationState {
  return say(
    { ...state, proposal, proposalSource: "openai" },
    "OpenAI предложил трактовку описания. Проверьте факты и гипотезы ниже. Пока они не меняют расчёт.",
    "openai",
  );
}
export function acceptInterpretation(
  state: ConversationState,
): ConversationState {
  const v = state.proposal;
  if (!v) return state;
  let next: ConversationState = {
    ...state,
    proposal: null,
    proposalSource: null,
    industry: state.industry ?? v.industry,
    locations: v.locations ?? state.locations,
    systems: [...new Set([...state.systems, ...v.systems.map((s) => s.code)])],
    revision: state.revision + 1,
  };
  next = addScenarios(
    next,
    v.hypotheses.map((h) => h.scenarioId),
  );
  for (const w of v.workloads) {
    const p = next.processes.find((p) => p.scenarioId === w.scenarioId);
    if (!p) continue;
    const workload = { ...p.workload };
    for (const key of [
      "employees",
      "operations",
      "period",
      "minutes",
    ] as const) {
      if (w[key] !== null) Object.assign(workload, { [key]: w[key] });
    }
    if (w.scope !== "unknown") workload.scope = w.scope;
    try {
      next = updateProcess(next, p.id, {
        workload,
        facts: [...p.facts, w.evidence].slice(-8),
      });
    } catch {
      next = say(
        next,
        "Числа из предложения ИИ не прошли проверку ядра и не были применены.",
      );
    }
  }
  next = say(
    next,
    `Трактовка подтверждена вами. ${v.facts.map((f) => f.text).join(". ")}`,
    "rules",
  );
  const active =
    next.processes.find((p) => p.id === next.activeId) ?? next.processes[0];
  return active ? focusProcess(next, active.id) : next;
}
export function localPlan(
  p: LiveProcess,
  company: Company | null = null,
): Advice {
  const s = scenarioById(p.scenarioId),
    capacity = hasCapacityWarning(p, company),
    blocked =
      capacity ||
      p.confirmed !== true ||
      p.error === "critical" ||
      p.result?.group === "excluded";
  return {
    approach: blocked ? "wait" : s.solutions[0],
    problem:
      p.confirmed === true
        ? `Подтверждена ручная работа: ${p.name}.`
        : `«${p.name}» пока только гипотеза.`,
    hypothesis: blocked
      ? "Сначала проверить необходимость и безопасность изменений с ответственным специалистом."
      : "Единый порядок действий и проверка возможностей текущей программы могут убрать повторную ручную работу.",
    firstStep: capacity
      ? "Сначала сверить нагрузку: общий объём команды, время одного выполнения и рабочий фонд. До исправления данных пилот не назначается."
      : s.firstAction,
    prepare: [
      "Назначить владельца процесса и описать один конкретный результат.",
      "Снять исходные метрики на вымышленной выборке, отметить исключения.",
      "Проверить доступы, правовое основание, возможность отката и контроль человека.",
    ],
    metrics: s.metrics,
    risks: [
      ...s.limits,
      "Не считать освобождённые часы сокращением платежей.",
      ...(p.error === "critical"
        ? [
            "Критические действия остаются у человека; автономный запуск запрещён.",
          ]
        : []),
    ],
    continueIf:
      "Продолжать после согласованной проверки, если время с учётом контроля сократилось, качество не ухудшилось и ответственный подтвердил результат.",
    stopIf:
      "Остановить при нарушении доступа или согласий, опасной ошибке, росте ручной проверки либо отсутствии измеримого улучшения.",
  };
}

export function rejectInterpretation(
  state: ConversationState,
): ConversationState {
  return say(
    {
      ...state,
      proposal: null,
      proposalSource: null,
      revision: state.revision + 1,
    },
    "Трактовка отклонена. Она не меняла факты и расчёт. Исправьте описание или выберите нужный процесс.",
  );
}
