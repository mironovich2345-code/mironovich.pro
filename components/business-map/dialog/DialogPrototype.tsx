"use client";
import { useEffect, useRef, useState } from "react";
import type {
  ChatRequest,
  ChatResponse,
  ConversationState,
  Industry,
  LiveProcess,
  ScenarioId,
} from "../../../lib/business-map/dialog/contracts";
import { businessMapAiPolicy as policy } from "../../../config/business-map-ai";
import {
  acceptInterpretation,
  addScenarios,
  chooseIndustry,
  focusProcess,
  initialConversation,
  insight,
  offerInterpretation,
  processStatus,
  questionFor,
  rejectInterpretation,
  removeProcess,
  saveCompany,
  saveCoreProcess,
  say,
  selectOverflow,
  statusNames,
  submitText,
  summary,
  toCoreProcess,
  updateProcess,
} from "../../../lib/business-map/dialog/engine";
import { industryNames } from "../../../lib/business-map/dialog/industry";
import {
  dialogDemoNames,
  loadDialogDemo,
  type DialogDemoId,
} from "../../../lib/business-map/dialog/demo";
import {
  parseAdvice,
  parseInterpretation,
} from "../../../lib/business-map/dialog/ai-schema";
import CompanyForm from "../CompanyForm";
import ProcessEditor from "../ProcessEditor";
import Analysis from "../Analysis";
import { bands, groups } from "../presentation";
import Library from "./Library";
import Glyph from "./Glyph";
import MapView, { missingNames, QuickNumbers } from "./MapView";
import Plan from "./Plan";
import QuickEditor from "./QuickEditor";
import "../prototype.css";
import "./dialog.css";
type Pane = "dialog" | "map" | "plan";
type Detail = { id: string; view: "analysis" | "quick" | "full" } | null;
const sourceNames = {
  user: "Вы",
  rules: "Отраслевые правила",
  core: "Расчётное ядро",
  openai: "OpenAI",
  demo: "Синтетическая демонстрация",
};
function choices(
  q: ConversationState["question"],
  p: LiveProcess | undefined,
): string[] {
  return q === "confirm"
    ? ["Да, вручную", "Нет, проблемы нет", "Не знаю"]
    : q === "volume"
      ? ["10", "20", "Не знаю"]
      : q === "duration"
        ? ["5", "12", "Не знаю"]
        : q === "risk"
          ? [
              "Мелкая, легко исправить",
              "Серьёзный ущерб",
              "Критические последствия",
              "Не знаю",
            ]
          : q === "scope" || q === "staff"
            ? p?.workload.scope === "per-person"
              ? ["2", "4", "Не знаю"]
              : ["На всю команду", "На одного сотрудника", "Не знаю"]
            : [];
}
export default function DialogPrototype({ aiReady }: { aiReady: boolean }) {
  const [state, setState] = useState(initialConversation),
    [pane, setPane] = useState<Pane>("dialog"),
    [detail, setDetail] = useState<Detail>(null),
    [companyView, setCompanyView] = useState(false),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [demo, setDemo] = useState(""),
    [fullDemo, setFullDemo] = useState(false),
    [selection, setSelection] = useState<ScenarioId[]>([]),
    [viewport, setViewport] = useState<number | null>(null);
  const latest = useRef(state),
    aiCalls = useRef(0),
    aiGeneration = useRef(0),
    abort = useRef<AbortController | null>(null),
    thread = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null),
    documentView = useRef<HTMLDivElement>(null);
  latest.current = state;
  const active = state.processes.find((p) => p.id === state.activeId),
    current = state.processes.find((p) => p.id === detail?.id),
    started = state.messages.length > 0,
    planProcess =
      state.processes.find((p) => p.result?.group === "first") ??
      active ??
      state.processes.find((p) => p.confirmed === true) ??
      state.processes[0] ??
      null;
  useEffect(() => {
    const resize = () => setViewport(window.innerWidth);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    const container = thread.current;
    if (!container) return;
    if (!state.activeId) {
      container.scrollTop = 0;
      return;
    }
    const target = container.querySelector<HTMLElement>(
      state.proposal ? ".bd-proposal" : ".bd-message:last-child",
    );
    if (target)
      container.scrollTop +=
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top -
        20;
  }, [
    state.messages.length,
    state.proposal,
    busy,
    state.activeId,
    pane,
    detail,
    companyView,
  ]);
  useEffect(() => {
    // A new document starts at its heading. Editors retain their native input autofocus.
    if (
      companyView ||
      detail?.view === "analysis" ||
      (pane !== "dialog" && !detail)
    ) {
      const container = documentView.current;
      if (!container) return;
      container.scrollTop = 0;
      const heading = container.querySelector<HTMLElement>("h1,h2");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }, [pane, detail, companyView]);
  useEffect(() => () => abort.current?.abort(), []);
  function commit(next: ConversationState) {
    latest.current = next;
    setState(next);
  }
  function cancelAi() {
    aiGeneration.current++;
    abort.current?.abort();
    abort.current = null;
    setBusy(false);
  }
  function switchPane(p: Pane) {
    setPane(p);
    setDetail(null);
    setCompanyView(false);
    setNotice("");
  }
  function focus(id: string) {
    commit(focusProcess(latest.current, id));
    switchPane("dialog");
    setTimeout(() => composer.current?.focus(), 0);
  }
  function choose(id: ScenarioId) {
    setNotice("");
    const next = addScenarios(latest.current, [id]),
      p = next.processes.find((p) => p.scenarioId === id);
    commit(p ? focusProcess(next, p.id) : next);
    setPane("dialog");
    setDetail(null);
    setSelection([]);
  }
  async function askAi(
    inputState: ConversationState,
    message: string,
    intent: "interpret" | "advise" = "interpret",
  ) {
    if (!aiReady) return; // Availability and the rules-only source are already explicit in the interface.
    if (aiCalls.current >= policy.maxBrowserAiRequests) {
      setNotice("Достигнут лимит ИИ этой вкладки. Можно продолжить без ИИ.");
      return;
    }
    if (abort.current) return;
    const p =
        intent === "advise"
          ? planProcess
          : inputState.processes.find((p) => p.id === inputState.activeId),
      capturedRevision = inputState.revision;
    const facts: string[] = [];
    let availableContext = policy.maxContextCharacters - message.length;
    for (const fact of (p?.facts ?? []).slice(-8)) {
      const bounded = fact.slice(0, 300);
      if (bounded.length <= availableContext) {
        facts.push(bounded);
        availableContext -= bounded.length;
      }
    }
    const payload: ChatRequest = {
      requestId: crypto.randomUUID(),
      intent,
      message: message.slice(0, policy.maxMessageCharacters),
      industry: inputState.industry,
      scenarioId: p?.scenarioId ?? null,
      facts,
      question: inputState.question,
      risk: p?.error ?? "unknown",
    };
    const generation = ++aiGeneration.current;
    const controller = new AbortController();
    abort.current = controller;
    aiCalls.current++;
    setBusy(true);
    setNotice("");
    const timeout = setTimeout(
      () => controller.abort(),
      policy.timeoutMs + 3000,
    );
    try {
      const response = await fetch("/api/business-map/chat", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const result: ChatResponse = await response.json();
      if (generation !== aiGeneration.current) return;
      if (latest.current.revision !== capturedRevision) {
        setNotice("Вы уже изменили карту. Устаревший ответ ИИ не применён.");
        return;
      }
      if (!response.ok || !result.ok) {
        commit(
          say(
            latest.current,
            !result.ok
              ? result.error
              : "ИИ временно недоступен. Отраслевые сценарии доступны.",
          ),
        );
        return;
      }
      // The server validates first; recheck the boundary before touching client state.
      if (intent === "interpret") {
        const interpretation = parseInterpretation(
          result.interpretation,
          message,
        );
        if (!interpretation) throw new Error("schema");
        commit(offerInterpretation(latest.current, interpretation));
      } else {
        const advice = parseAdvice(result.advice, payload);
        if (!advice || !p) throw new Error("schema");
        commit(
          say(
            {
              ...latest.current,
              advice: { ...latest.current.advice, [p.id]: advice },
            },
            "OpenAI подготовил объяснение и план. Проверьте его в разделе «План». Числа и приоритет остаются результатом расчётного ядра.",
            "openai",
          ),
        );
      }
    } catch {
      if (
        generation === aiGeneration.current &&
        latest.current.revision === capturedRevision
      )
        commit(
          say(
            latest.current,
            "ИИ не ответил или ответ не прошёл проверку. Продолжите без ИИ: карта и диалог остаются доступны.",
          ),
        );
    } finally {
      clearTimeout(timeout);
      if (abort.current === controller) {
        abort.current = null;
        setBusy(false);
      }
    }
  }
  function send(value: string, button = false) {
    if (!value.trim()) return;
    if (value.length > policy.maxMessageCharacters) {
      setNotice(
        "Сократите сообщение до 4 000 символов. Текст оставлен для исправления и не отправлен.",
      );
      return;
    }
    setNotice("");
    const outcome = submitText(latest.current, value);
    commit(outcome.state);
    setText("");
    if (outcome.needsAi && !button) void askAi(outcome.state, value);
  }
  function reset() {
    cancelAi();
    commit(initialConversation());
    setDemo("");
    setSelection([]);
    setPane("dialog");
    setDetail(null);
    setCompanyView(false);
    setNotice("Данные удалены из памяти этой вкладки.");
    setFullDemo(false);
    setText("");
  }
  function chooseDemo(value: string) {
    if (!value) return;
    cancelAi();
    commit(loadDialogDemo(value as DialogDemoId));
    setDemo(value);
    setPane("dialog");
    setDetail(null);
    setCompanyView(false);
    setSelection([]);
    setFullDemo(true);
    setNotice("Загружены вымышленные данные. OpenAI не вызывался.");
    setText("");
  }
  function fullEditor(id: string) {
    const p = latest.current.processes.find((p) => p.id === id);
    if (!p) return;
    if (!p.workload.period) {
      setNotice("Сначала укажите период в редактировании времени.");
      setDetail({ id, view: "quick" });
      return;
    }
    if (!state.company) {
      setDetail({ id, view: "full" });
      setCompanyView(true);
      return;
    }
    setDetail({ id, view: "full" });
  }
  const nav = (
    <nav className="bd-nav" aria-label="Разделы Business Map">
      {(
        [
          ["dialog", "Диалог"],
          ["map", "Карта"],
          ["plan", "План"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          aria-current={
            pane === key && !detail && !companyView ? "page" : undefined
          }
          onClick={() => switchPane(key)}
        >
          <Glyph name={key} />
          {label}
          {key === "map" && <small>{state.processes.length}</small>}
        </button>
      ))}
    </nav>
  );
  const boundary = (
    <div className="bd-boundary">
      <strong>
        {fullDemo
          ? "Полная карта · демонстрационный доступ"
          : "Бесплатно · один быстрый анализ"}
      </strong>
      <p>
        Business Map за 4 934 ₽: до пяти процессов, сценарии, сравнение и план.
        Сейчас — закрытый прототип без оплаты и сохранения.
      </p>
      {!fullDemo && (
        <button className="bm-link" onClick={() => setFullDemo(true)}>
          Открыть полную карту в демо →
        </button>
      )}
    </div>
  );
  const proposal = state.proposal;
  const proposed = proposal && (
    <section className="bd-proposal" aria-label="Проверка трактовки ИИ">
      <p className="bm-eyebrow">
        {state.proposalSource === "demo"
          ? "Демонстрация трактовки · без API"
          : "OpenAI · требует вашего подтверждения"}
      </p>
      <h2>Я правильно понял?</h2>
      {proposal.industry && <p>Сфера: {industryNames[proposal.industry]}</p>}
      {proposal.locations !== null && (
        <p>Подразделений: {proposal.locations}. Это не число сотрудников.</p>
      )}
      {proposal.systems.length > 0 && (
        <p>
          Системы:{" "}
          {proposal.systems
            .map((s) => `${s.code} («${s.evidence}»)`)
            .join(", ")}
        </p>
      )}
      <ul>
        {proposal.facts.map((f, i) => (
          <li key={i}>
            <strong>Предложенный факт:</strong> {f.text}
            <blockquote>«{f.evidence}»</blockquote>
          </li>
        ))}
        {proposal.hypotheses.map((h, i) => (
          <li key={`h-${i}`}>
            <strong>Гипотеза:</strong> {h.reason}
          </li>
        ))}
        {proposal.workloads.map((w, i) => (
          <li key={`w-${i}`}>
            Объём: {w.operations ?? "неизвестен"};{" "}
            {w.scope === "team"
              ? "вся команда"
              : w.scope === "per-person"
                ? "на сотрудника"
                : "чей объём — неизвестно"}
            ; период:{" "}
            {w.period === null
              ? "неизвестен"
              : w.period === "day"
                ? "день"
                : w.period === "week"
                  ? "неделя"
                  : "месяц"}
            ; сотрудников {w.employees ?? "?"}; минут {w.minutes ?? "?"}.
            <blockquote>«{w.evidence}»</blockquote>
          </li>
        ))}
      </ul>
      <div className="bd-row">
        <button
          className="bm-primary"
          onClick={() => commit(acceptInterpretation(latest.current))}
        >
          Подтвердить трактовку
        </button>
        <button
          className="bm-secondary"
          onClick={() => {
            commit(rejectInterpretation(latest.current));
            setNotice(
              "Можно исправить сведения в карточке процесса или написать новое описание.",
            );
          }}
        >
          Нет, исправить
        </button>
      </div>
    </section>
  );
  const overflow = state.overflow.length > 0 && (
    <section className="bd-proposal">
      <h2>Выберите основные процессы</h2>
      <p>
        Можно добавить ещё {5 - state.processes.length}. Остальные не будут
        считаться проверенными.
      </p>
      <div className="bd-checks">
        {state.overflow.map((id) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={selection.includes(id)}
              disabled={
                !selection.includes(id) &&
                selection.length >= 5 - state.processes.length
              }
              onChange={() =>
                setSelection((s) =>
                  s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                )
              }
            />
            {
              {
                reporting: "Отчёты",
                transfer: "Перенос данных",
                "missed-leads": "Необработанные обращения",
                "slow-response": "Скорость ответа",
                onboarding: "Адаптация",
                "sales-control": "Контроль продаж",
                renewals: "Продления",
              }[id]
            }
          </label>
        ))}
      </div>
      <button
        className="bm-primary"
        disabled={!selection.length}
        onClick={() => {
          commit(selectOverflow(latest.current, selection));
          setSelection([]);
        }}
      >
        Добавить выбранные
      </button>
    </section>
  );
  const composerForm = (
    <form
      className="bd-composer"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        send(text);
      }}
    >
      <label htmlFor="bd-message">
        {state.question ? "Ваш ответ" : "Расскажите о ситуации"}
      </label>
      <div>
        <textarea
          ref={composer}
          id="bd-message"
          rows={2}
          maxLength={policy.maxMessageCharacters + 1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            state.question
              ? "Можно коротко или «Не знаю»"
              : "Что приходится делать вручную?"
          }
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send(text);
            }
          }}
        />
        <button
          className="bm-primary"
          type="submit"
          disabled={
            !text.trim() || text.length > policy.maxMessageCharacters || busy
          }
          aria-label="Отправить сообщение"
        >
          ↑
        </button>
      </div>
      <small>
        {text.length > policy.maxMessageCharacters
          ? "Сократите сообщение: максимум 4 000 символов."
          : "Enter — отправить · Shift + Enter — новая строка"}
        {busy && " · Можно продолжить без ИИ"}
      </small>
      {busy && (
        <button type="button" className="bm-link" onClick={cancelAi}>
          Продолжить без ИИ
        </button>
      )}
    </form>
  );
  let content;
  if (companyView)
    content = (
      <CompanyForm
        key={state.revision}
        initial={
          state.company ?? {
            industry: state.industry ?? undefined,
            systems: state.systems,
          }
        }
        onCancel={() => {
          setCompanyView(false);
          setDetail(null);
        }}
        onSave={(company) => {
          commit(saveCompany(latest.current, company));
          setCompanyView(false);
          if (!detail) setPane("map");
        }}
      />
    );
  else if (detail && current) {
    if (detail.view === "quick")
      content = (
        <QuickEditor
          key={current.id}
          process={current}
          onCancel={() => setDetail({ id: current.id, view: "analysis" })}
          onSave={(patch) => {
            let next = updateProcess(latest.current, current.id, patch);
            next = {
              ...next,
              question:
                next.activeId === current.id
                  ? questionFor(
                      next.processes.find((p) => p.id === current.id)!,
                    )
                  : next.question,
            };
            commit(
              say(
                next,
                summary(
                  next.processes.find((p) => p.id === current.id)!,
                  next.company,
                ),
                "core",
              ),
            );
            setDetail({ id: current.id, view: "analysis" });
          }}
        />
      );
    else if (detail.view === "full" && state.company)
      content = (
        <ProcessEditor
          key={current.id}
          initial={toCoreProcess(current, state.company)}
          company={state.company}
          allProcesses={state.processes.flatMap((p) =>
            p.core ? [p.core] : [],
          )}
          onCancel={() => setDetail({ id: current.id, view: "analysis" })}
          onSave={(core) => {
            commit(saveCoreProcess(latest.current, core));
            setDetail({ id: current.id, view: "analysis" });
          }}
        />
      );
    else
      content = (
        <>
          {!(current.result && current.core && state.company) && (
            <button
              className="bm-back"
              onClick={() => {
                setDetail(null);
                setPane("map");
              }}
            >
              ← Живая карта
            </button>
          )}
          {current.result && current.core && state.company ? (
            <Analysis
              process={current.core}
              result={current.result}
              company={state.company}
              onBack={() => {
                setDetail(null);
                setPane("map");
              }}
              onEdit={() => fullEditor(current.id)}
              onPlan={() => {
                commit({ ...latest.current, activeId: current.id });
                switchPane("plan");
              }}
            />
          ) : (
            <>
              <header className="bm-page-heading">
                <p className="bm-eyebrow">
                  {statusNames[processStatus(current, state.company)]} · ранний
                  вывод
                </p>
                <h1>{current.name}</h1>
                <p>{summary(current, state.company)}</p>
              </header>
              <QuickNumbers process={current} state={state} />
              <p className="bm-muted">
                Для времени нужно уточнить:{" "}
                {insight(current, state.company)
                  .missing.map((k) => missingNames[k] ?? k)
                  .join(", ") || "достаточно данных"}
                . Для сценариев нужны механические шаги, исключения и условия
                контроля. Проценты по общему баллу не используются.
              </p>
            </>
          )}
          <div className="bm-actions">
            <button
              className="bm-primary"
              onClick={() => setDetail({ id: current.id, view: "quick" })}
            >
              Изменить время и сведения
            </button>
            <button
              className="bm-secondary"
              onClick={() => fullEditor(current.id)}
            >
              Уточнить сценарии и риски
            </button>
            <button className="bm-link" onClick={() => focus(current.id)}>
              Продолжить диалог
            </button>
            <button
              className="bm-link"
              onClick={() => {
                commit(removeProcess(latest.current, current.id));
                setDetail(null);
                setPane("map");
              }}
            >
              Удалить процесс
            </button>
          </div>
        </>
      );
  } else if (pane === "plan")
    content = (
      <Plan
        state={state}
        process={planProcess}
        aiReady={aiReady}
        busy={busy}
        onChoose={() => switchPane("dialog")}
        onAi={() =>
          void askAi(
            latest.current,
            `Подготовьте проверяемый план для процесса «${planProcess?.name}». Не рассчитывайте финансовый эффект.`,
            "advise",
          )
        }
      />
    );
  else if (pane === "map")
    content = (
      <>
        <MapView
          state={state}
          onOpen={(id) => setDetail({ id, view: "analysis" })}
          onFocus={focus}
        />
        {state.processes.some((p) => p.result) && (
          <section className="bd-matrix">
            <h2>Ценность × Сложность</h2>
            <p className="bm-muted">
              Результаты ядра; риск, уверенность и барьеры сохраняют силу.
              Номера соответствуют карте.
            </p>
            <div
              className="bm-matrix"
              role="table"
              aria-label="Матрица ценности и сложности"
            >
              <div role="row" className="bm-matrix-row bm-matrix-head">
                <span>
                  Ценность ↓<br />
                  Сложность →
                </span>
                {["Низкая", "Средняя", "Высокая"].map((b) => (
                  <span role="columnheader" key={b}>
                    {b}
                  </span>
                ))}
              </div>
              {(["high", "medium", "low"] as const).map((v) => (
                <div role="row" className="bm-matrix-row" key={v}>
                  <strong role="rowheader">{bands[v]}</strong>
                  {(["low", "medium", "high"] as const).map((c) => (
                    <div role="cell" className="bm-matrix-cell" key={c}>
                      {state.processes
                        .filter(
                          (p) =>
                            p.result?.value === v &&
                            p.result?.complexity.level === c,
                        )
                        .map((p) => (
                          <button
                            key={p.id}
                            onClick={() =>
                              setDetail({ id: p.id, view: "analysis" })
                            }
                          >
                            {state.processes.indexOf(p) + 1}
                            <small>{groups[p.result!.group]}</small>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}
        <button className="bm-secondary" onClick={() => setCompanyView(true)}>
          Параметры компании и рабочего фонда
        </button>
        {boundary}
      </>
    );
  else
    content = (
      <div className="bd-chat">
        <div ref={thread} className="bd-thread">
          <header className="bd-chat-heading">
            <p className="bm-eyebrow">Диагностика · один вопрос за раз</p>
            <h1>{active ? active.name : "Что стоит проверить"}</h1>
          </header>
          <div
            className="bd-messages"
            role="log"
            aria-label="Сообщения диагностики"
            aria-live="polite"
            aria-relevant="additions"
          >
            {state.messages.map((m) => (
              <article key={m.id} className={`bd-message bd-message-${m.role}`}>
                <span>{sourceNames[m.source]}</span>
                <p>{m.text}</p>
              </article>
            ))}
          </div>
          {busy && (
            <p role="status" className="bd-loading">
              OpenAI разбирает описание… Карта доступна без ожидания.
            </p>
          )}
          {proposed}
          {overflow}
          {active && state.question && (
            <div className="bd-choices" aria-label="Быстрые ответы">
              {choices(state.question, active).map((choice) => (
                <button
                  key={choice}
                  disabled={busy}
                  onClick={() => send(choice, true)}
                >
                  {choice}
                </button>
              ))}
            </div>
          )}
          {state.industry &&
            (!active ? (
              <Library
                industry={state.industry}
                onChoose={choose}
                disabled={state.processes.length >= 5}
              />
            ) : (
              <details className="bd-add">
                <summary>Проверить другую гипотезу</summary>
                <Library
                  industry={state.industry}
                  onChoose={choose}
                  disabled={state.processes.length >= 5}
                />
              </details>
            ))}
          {active && state.diagnosticEnded && (
            <div className="bd-row">
              <button
                className="bm-secondary"
                onClick={() => setDetail({ id: active.id, view: "analysis" })}
              >
                Результат и расчёт →
              </button>
              <button className="bm-link" onClick={() => switchPane("plan")}>
                Первый практический шаг
              </button>
            </div>
          )}
        </div>
        {composerForm}
      </div>
    );
  const welcome = (
    <section className="bd-welcome">
      <div className="bd-welcome-title">
        <p className="bm-eyebrow">
          <span className="bm-red-line" /> Карта автоматизации бизнеса
        </p>
        <h1>
          Где ваш бизнес теряет <em>время и деньги?</em>
        </h1>
        <p>
          Расскажите о компании. Поможем найти процессы, которые стоит
          автоматизировать, и покажем, с чего начать
        </p>
      </div>
      <div className="bd-start-options">
        <section>
          <p className="bm-eyebrow">01 / Начните со сферы</p>
          <div className="bd-industries">
            {Object.entries(industryNames).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setNotice("");
                  commit(chooseIndustry(latest.current, id as Industry));
                }}
              >
                <span>{label}</span>
                <span>
                  <Glyph />
                </span>
              </button>
            ))}
          </div>
          <p className="bm-muted">
            Сразу покажем возможные направления. Без ожидания ИИ.
          </p>
        </section>
        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <label htmlFor="bd-description" className="bm-eyebrow">
            02 / Или расскажите своими словами
          </label>
          <textarea
            id="bd-description"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={policy.maxMessageCharacters + 1}
            placeholder="Например: у меня три фитнес-клуба, сотрудники вручную делают отчёты, а часть заявок теряется…"
          />
          <button
            className="bm-primary"
            disabled={!text.trim() || text.length > policy.maxMessageCharacters}
          >
            Найти возможности{" "}
            <span>
              <Glyph />
            </span>
          </button>
          <p className="bm-muted">
            {aiReady
              ? "Свободное описание передаётся OpenAI через защищённый сервер. Только вымышленные данные."
              : "ИИ-консультант временно недоступен. Доступны отраслевые сценарии и разбор по правилам."}
          </p>
        </form>
      </div>
      {boundary}
    </section>
  );
  return (
    <div className="bm bd">
      <header className="bd-topbar">
        <div>
          <span className="bd-wordmark">
            MIRONOVICH<span>.PRO</span>
          </span>
          <span className="bd-product">
            BUSINESS MAP <small>/ консультант</small>
          </span>
        </div>
        {nav}
        <button className="bm-reset" onClick={reset}>
          Начать заново
        </button>
      </header>
      <div className="bd-warning">
        <span>
          Закрытый прототип · только вымышленные данные · всё в памяти вкладки
        </span>
        <span>{viewport ? `${viewport} CSS px` : ""}</span>
      </div>
      <div className="bd-tools">
        <span className={aiReady ? "bd-ai-on" : "bd-ai-off"}>
          {aiReady
            ? "OpenAI включён · факты подтверждаете вы"
            : "ИИ временно недоступен · работают правила"}
        </span>
        <label>
          <span className="sr-only">Синтетический демо-сценарий</span>
          <select value={demo} onChange={(e) => chooseDemo(e.target.value)}>
            <option value="">Демо-сценарии</option>
            {Object.entries(dialogDemoNames).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {notice && (
        <p className="bd-notice" role="status">
          {notice}
        </p>
      )}
      <main
        id="main"
        className={
          !started && pane === "dialog" && !detail && !companyView
            ? "bd-main"
            : "bd-main bd-main-started"
        }
      >
        {!started && pane === "dialog" && !detail && !companyView ? (
          welcome
        ) : (
          <div
            ref={documentView}
            className={`bd-layout ${pane !== "dialog" || detail || companyView ? "bd-layout-wide" : ""}`}
          >
            <div
              className={
                pane === "dialog" && !detail && !companyView
                  ? "bd-primary"
                  : "bd-primary bd-document"
              }
            >
              {content}
            </div>
            {pane === "dialog" && !detail && !companyView && (
              <aside className="bd-sidebar">
                <MapView
                  compact
                  state={state}
                  onOpen={(id) => setDetail({ id, view: "analysis" })}
                  onFocus={focus}
                />
                {boundary}
              </aside>
            )}
          </div>
        )}
      </main>
      <div className="bd-mobile-tabs">{nav}</div>
    </div>
  );
}
