"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  careerQuestions,
  careerTasks,
  syntheticAnswers,
  type CareerAnswers,
  type CareerResult,
} from "@/lib/career-diagnostic";

type Order = {
  id: string;
  kind: "initial" | "extension";
  amountKopeks: number;
  status: string;
  confirmationUrl?: string;
};
type State = {
  authenticated?: boolean;
  active?: boolean;
  synthetic?: boolean;
  paymentMode?: string;
  reportRetained?: boolean;
  account?: {
    email: string;
    access_until: string | null;
    analysis_consumed: boolean;
    analysis_state: string;
    grant_order_id: string | null;
  };
  orders?: Order[];
  answers?: CareerAnswers;
  result?: CareerResult;
  progress?: { day: number; done: boolean }[];
};
const input =
  "min-h-11 w-full rounded border border-cream/30 bg-graphite px-3 py-2 text-cream";
const button =
  "inline-flex min-h-11 items-center justify-center rounded border border-cream/40 px-4 py-2 text-sm font-medium text-cream hover:border-signal disabled:opacity-50";
const card = "rounded-xl border border-cream/25 p-4 sm:p-6";
const labels: Record<string, string> = {
  operations: "Операционная работа",
  sales: "Продажи",
  analyst: "Аналитика",
  support: "Поддержка",
  starter: "Начинающий",
  practiced: "Есть практика",
  experienced: "Опытный",
  documents: "Документы",
  tables: "Таблицы",
  communication: "Общение",
  research: "Источники",
  daily: "Каждый день",
  weekly: "Каждую неделю",
  monthly: "Каждый месяц",
  short: "До 15 минут",
  medium: "15–60 минут",
  long: "Больше часа",
  clear: "Шаги описаны",
  partial: "Частично",
  unclear: "Пока неясно",
  structured: "Структурированные",
  text: "Текст",
  mixed: "Смешанные",
  synthetic: "Только учебные",
  public: "Открытые",
  restricted: "Закрытые — не передавать",
  approved: "Разрешены",
  ask_first: "Сначала согласовать",
  forbidden: "Запрещены",
  low: "Низкие",
  high: "Высокие",
  checklist: "Проверочный список",
  expert_review: "Проверка человеком",
  not_defined: "Не определены",
  same: "Одинаковые",
  variable: "Изменяются",
  unique: "Уникальны",
  none: "Нет",
  basic: "Базовый",
  regular: "Регулярный",
  available: "Есть время",
  limited: "Ограничено",
  human: "Я проверяю",
  supervisor: "Руководитель",
  regulated: "Регламент и ответственный человек",
  measured: "Есть замер",
  estimate: "Оценка",
  one_hour: "Один час",
  three_hours: "Три часа",
  five_hours: "Пять часов",
  quality: "Качество",
  speed: "Скорость",
  clarity: "Понятность",
};
async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch(
    "/api/career/" + path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const value = await r.json();
  if (!r.ok) throw new Error(value.error || "Тестовый сервис недоступен");
  return value;
}
export default function CareerSandbox() {
  const [gate, setGate] = useState(false),
    [accessCode, setAccessCode] = useState(""),
    [onlySynthetic, setOnlySynthetic] = useState(false),
    [email, setEmail] = useState(""),
    [challenge, setChallenge] = useState(""),
    [code, setCode] = useState(""),
    [state, setState] = useState<State>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [adult, setAdult] = useState(false),
    [offer, setOffer] = useState(false),
    [kind, setKind] = useState<"initial" | "extension">("initial"),
    [answers, setAnswers] = useState<CareerAnswers>({
      questions: {},
      tasks: [],
    });
  const alreadyPurchased =
    state.orders?.some(
      (o) =>
        o.kind === "initial" &&
        (o.status === "paid" || o.status === "refunded"),
    ) || false;
  const canExtend =
    state.reportRetained &&
    state.orders?.some((o) => o.kind === "initial" && o.status === "paid");
  const orderKind = alreadyPurchased ? "extension" : kind;
  const refresh = useCallback(async () => {
    const value = await api<State>("session");
    setGate(true);
    setState(value);
    if (value.answers) setAnswers(value.answers);
  }, []);
  useEffect(() => {
    setEmail("demo-" + crypto.randomUUID().slice(0, 8) + "@example.invalid");
    void refresh().catch(() => {});
  }, [refresh]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка тестового сервиса");
    } finally {
      setBusy(false);
    }
  }
  function submit(fn: () => Promise<void>) {
    return (e: FormEvent) => {
      e.preventDefault();
      void run(fn);
    };
  }
  return (
    <main id="main" className="mx-auto max-w-5xl px-[22px] py-10 text-cream">
      <p className="mb-4 border-l-2 border-signal bg-cream/5 p-4 text-sm leading-relaxed">
        Закрытый синтетический стенд. Это не действующий магазин. Нельзя вводить
        реальные email, сведения о работе или третьих лицах. Только учебные
        варианты; реальные платежи и настоящий ИИ отключены.
      </p>
      <h1 className="font-display text-[clamp(28px,5vw,46px)] font-bold uppercase leading-tight">
        Учебный кабинет продукта сотрудников
      </h1>
      <p className="mt-3 text-sm text-stone">
        18 вопросов · один успешный анализ · план из 30 шагов · PDF · 90 дней
        тестового доступа
      </p>
      {error && (
        <p
          role="alert"
          className="my-4 rounded border border-signal p-4 text-cream"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-4 rounded border border-cream/30 p-4">
          {notice}
        </p>
      )}
      {!gate ? (
        <form
          className={card + " mt-6 space-y-4"}
          onSubmit={submit(async () => {
            await api("tester", { accessCode, onlySynthetic });
            setAccessCode("");
            await refresh();
          })}
        >
          <h2 className="text-xl font-bold">Допуск тестировщика</h2>
          <label className="block">
            Код доступа тестировщика
            <input
              type="password"
              autoComplete="off"
              required
              className={input}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
            />
          </label>
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={onlySynthetic}
              onChange={(e) => setOnlySynthetic(e.target.checked)}
              required
            />
            Работаю только с синтетическими данными
          </label>
          <button className={button} disabled={busy}>
            Открыть тестовый контур
          </button>
        </form>
      ) : !state.account ? (
        <section className={card + " mt-6 space-y-5"}>
          <h2 className="text-xl font-bold">Вход по учебному email-коду</h2>
          <form
            className="space-y-4"
            onSubmit={submit(async () => {
              const r = await api<{ challengeId: string }>("auth/request", {
                email,
              });
              setChallenge(r.challengeId);
              setNotice(
                "Код отправлен в контролируемый тестовый почтовый стенд. Действует 5 минут.",
              );
            })}
          >
            <label className="block">
              Учебный email
              <input
                type="email"
                required
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </label>
            <p className="text-sm text-stone">
              Разрешены только адреса demo-…@example.invalid. Обычные адреса
              сервер не принимает.
            </p>
            <button className={button} disabled={busy}>
              Получить код
            </button>
          </form>
          {challenge && (
            <form
              className="space-y-4"
              onSubmit={submit(async () => {
                await api("auth/verify", { challengeId: challenge, code });
                setCode("");
                await refresh();
              })}
            >
              <label className="block">
                Одноразовый код
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className={input}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button className={button} disabled={busy}>
                Войти по коду
              </button>
            </form>
          )}
        </section>
      ) : (
        <>
          <section className={card + " mt-6"}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Аккаунт</h2>
                <p className="break-all text-sm">{state.account.email}</p>
                <p className="mt-2">
                  {state.active
                    ? "Учебный доступ действует"
                    : "Учебный доступ пока не предоставлен или истёк"}
                </p>
                {state.account.access_until && (
                  <p className="text-sm text-stone">
                    До{" "}
                    {new Date(state.account.access_until).toLocaleString(
                      "ru-RU",
                      { timeZone: "Europe/Moscow" },
                    )}{" "}
                    (МСК)
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => void run(refresh)}
                >
                  Обновить кабинет
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api("auth/logout", {});
                      setState({});
                      setGate(false);
                    })
                  }
                >
                  Выйти
                </button>
              </div>
            </div>
          </section>
          {(!alreadyPurchased || canExtend) && (
            <form
              className={card + " mt-6 space-y-4"}
              onSubmit={submit(async () => {
                await api("orders", { kind: orderKind, adult, offer });
                setAdult(false);
                setOffer(false);
                await refresh();
                setNotice(
                  "Создан только тестовый заказ. Цена определена сервером.",
                );
              })}
            >
              <h2 className="text-xl font-bold">Тестовый заказ</h2>
              <label className="block">
                Вид доступа
                <select
                  className={input}
                  value={orderKind}
                  onChange={(e) =>
                    setKind(e.target.value as "initial" | "extension")
                  }
                >
                  <option value="initial" disabled={alreadyPurchased}>
                    1 993 ₽ · 90 дней · один анализ
                  </option>
                  <option value="extension" disabled={!canExtend}>
                    1 490 ₽ · 12 месяцев · без нового анализа
                  </option>
                </select>
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                  required
                />
                Мне исполнилось 18 лет
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={offer}
                  onChange={(e) => setOffer(e.target.checked)}
                  required
                />
                <span>
                  Я ознакомился(лась) и принимаю{" "}
                  <a
                    href="/offer/ai-career"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    проект условий
                  </a>{" "}
                  для тестовой операции. Документы не утверждены для реальных
                  продаж.
                </span>
              </label>
              <p className="text-sm text-stone">
                Это не согласие на рекламу или аналитику. Обработка в прототипе
                допускает только учебные данные. Продление отсчитывается с
                отдельной оплаты, остаток не суммируется; удалённый отчёт не
                восстанавливается.
              </p>
              <button className={button} disabled={busy}>
                Создать тестовый заказ
              </button>
            </form>
          )}
          <section className={card + " mt-6"}>
            <h2 className="text-xl font-bold">Заказы и статусы</h2>
            {!state.orders?.length ? (
              <p>Учебных заказов пока нет.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {state.orders.map((o) => (
                  <li
                    key={o.id}
                    className="rounded border border-cream/20 p-4"
                    data-order={o.id}
                  >
                    <p>
                      {o.kind === "initial"
                        ? "Первоначальный доступ"
                        : "Дополнительный доступ"}{" "}
                      · {(o.amountKopeks / 100).toLocaleString("ru-RU")} ₽
                    </p>
                    <p className="text-sm">
                      Статус:{" "}
                      <span data-status>
                        {(
                          {
                            pending: "Ожидает тестовой оплаты",
                            paid: "Тестовая оплата подтверждена",
                            canceled: "Отменён",
                            refunded: "Тестовый возврат",
                            refund_required:
                              "Платёж проверен, доступ не выдан — нужен тестовый возврат",
                          } as Record<string, string>
                        )[o.status] || o.status}
                      </span>
                    </p>
                    {o.status === "pending" && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {state.paymentMode === "fixture" ? (
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api("orders/fixture-complete", {
                                  orderId: o.id,
                                });
                                await refresh();
                              })
                            }
                          >
                            Завершить локальную симуляцию
                          </button>
                        ) : (
                          o.confirmationUrl && (
                            <a className={button} href={o.confirmationUrl}>
                              Перейти к тестовой оплате ЮKassa
                            </a>
                          )
                        )}
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api("orders/refresh", { orderId: o.id });
                              await refresh();
                            })
                          }
                        >
                          Независимо проверить платёж
                        </button>
                      </div>
                    )}
                    {["paid", "refund_required"].includes(o.status) &&
                      (state.account?.grant_order_id === o.id ||
                        o.status === "refund_required") && (
                        <button
                          className={button + " mt-3"}
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api("orders/refund", { orderId: o.id });
                              await refresh();
                              setNotice(
                                "Результат тестового возврата независимо проверен.",
                              );
                            })
                          }
                        >
                          Проверить полный тестовый возврат
                        </button>
                      )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {state.active && !state.account.analysis_consumed && (
            <section className={card + " mt-6"}>
              <h2 className="text-xl font-bold">18 основных вопросов</h2>
              <p className="mt-2 text-sm text-stone">
                Без свободных полей: только вымышленные варианты и учебные
                задачи. Сбой не расходует второй анализ.
              </p>
              <button
                className={button + " my-4"}
                onClick={() => setAnswers(syntheticAnswers())}
                disabled={busy}
              >
                Заполнить учебным примером
              </button>
              <form
                onSubmit={submit(async () => {
                  await api("diagnostic", { answers });
                  setNotice("18 учебных ответов сохранены");
                  await refresh();
                })}
                className="space-y-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {careerQuestions.map(([key, title, options], i) => (
                    <label key={key} className="block">
                      {i + 1}. {title}
                      <select
                        name={key}
                        className={input}
                        required
                        value={answers.questions[key] || ""}
                        onChange={(e) =>
                          setAnswers((a) => ({
                            ...a,
                            questions: {
                              ...a.questions,
                              [key]: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="" disabled>
                          Выберите учебный вариант
                        </option>
                        {options.map((o) => (
                          <option key={o} value={o}>
                            {labels[o] || o}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <fieldset className="space-y-3">
                  <legend className="mb-3 font-bold">
                    Учебные задачи (1–5)
                  </legend>
                  {careerTasks.map((t) => (
                    <label key={t.id} className="flex gap-3">
                      <input
                        type="checkbox"
                        checked={answers.tasks.includes(t.id)}
                        onChange={(e) =>
                          setAnswers((a) => ({
                            ...a,
                            tasks: e.target.checked
                              ? [...a.tasks, t.id]
                              : a.tasks.filter((id) => id !== t.id),
                          }))
                        }
                      />
                      {t.title}
                    </label>
                  ))}
                </fieldset>
                <button className={button} disabled={busy}>
                  Сохранить 18 ответов
                </button>
              </form>
              <button
                className={button + " mt-4"}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await api<{ status: string }>("analysis", {});
                    await refresh();
                    setNotice(
                      r.status === "completed"
                        ? "Один учебный анализ готов"
                        : "Генерация уже выполняется; повторная покупка не нужна.",
                    );
                  })
                }
              >
                {state.account.analysis_state === "failed"
                  ? "Повторить после технического сбоя"
                  : "Сформировать один учебный анализ"}
              </button>
            </section>
          )}
          {state.active && state.result && (
            <section className={card + " mt-6"}>
              <h2 className="text-xl font-bold">
                Персональный учебный результат
              </h2>
              <p className="mt-3 text-sm">{state.result.disclaimer}</p>
              <ul className="my-4 space-y-3">
                {state.result.tasks.map((t) => (
                  <li key={t.id}>
                    <strong>{t.title}</strong>
                    <p className="text-sm text-stone">{t.recommendation}</p>
                  </li>
                ))}
              </ul>
              <a href="/api/career/report" className={button} download>
                Скачать учебный PDF
              </a>
              <h3 className="mb-4 mt-7 text-lg font-bold">План из 30 шагов</h3>
              <p className="mb-4 text-sm text-stone">Идите в собственном темпе. Каждый шаг содержит действие и результат для самопроверки.</p>
              <ol className="grid gap-3 sm:grid-cols-2">
                {state.result.plan.map((d) => (
                  <li
                    className="rounded border border-cream/20 p-3"
                    key={d.day}
                  >
                    <label className="flex gap-3">
                      <input
                        type="checkbox"
                        checked={
                          state.progress?.some(
                            (x) => x.day === d.day && x.done,
                          ) || false
                        }
                        disabled={busy}
                        onChange={(e) => {
                          const done = e.target.checked;
                          setState((s) => ({
                            ...s,
                            progress: [
                              ...(s.progress || []).filter(
                                (p) => p.day !== d.day,
                              ),
                              { day: d.day, done },
                            ],
                          }));
                          void run(async () => {
                            try {
                              await api("progress", { day: d.day, done });
                            } finally {
                              await refresh();
                            }
                          });
                        }}
                      />
                      <span>
                        <strong>
                          Шаг {d.day}. {d.theme}
                        </strong>
                        <span className="mt-1 block text-sm text-stone">
                          {d.action}
                        </span>
                        <span className="mt-2 block text-xs text-cream/75">Результат: {d.evidence}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {!state.active && state.reportRetained && (
            <p className={card + " mt-6"}>
              Срок доступа истёк. Результат пока сохранён, но недоступен без
              действующего доступа. Дополнительная покупка не включает новый
              анализ.
            </p>
          )}
        </>
      )}
    </main>
  );
}
