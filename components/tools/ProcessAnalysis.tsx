"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ANALYSIS_NOTICE, ANALYSIS_VERSION, approaches, parseProcessAnalysis, processInputError, processText, type ProcessAnalysis as Analysis, type ProcessInput } from "@/lib/tools/process-analysis-contract";
import { taskLabels, type Task } from "@/lib/tools/guided";
import { buttonClass, controlClass } from "./Fields";

export default function ProcessAnalysis({ tasks, mode }: { tasks: Task[]; mode: "mock" | "live" }) {
  const [open, setOpen] = useState(false), [preview, setPreview] = useState(false), [consent, setConsent] = useState(false);
  const [input, setInput] = useState<ProcessInput>({ task: tasks[0], description: "", tools: "", consequence: "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const description = useRef<HTMLTextAreaElement>(null), previewHeading = useRef<HTMLHeadingElement>(null), resultHeading = useRef<HTMLHeadingElement>(null);
  const launchButton = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function change(key: keyof ProcessInput, value: string) {
    setInput(old => ({ ...old, [key]: value })); setConsent(false); setPreview(false); setError(""); setAnalysis(null);
  }
  function review() {
    const problem = processInputError(input);
    if (problem) { setError(problem); description.current?.focus(); return; }
    setConsent(false); setError(""); setPreview(true);
    requestAnimationFrame(() => previewHeading.current?.focus());
  }
  async function send() {
    const problem = processInputError(input);
    if (!preview || !consent || busy || problem) { setError(problem ?? "Проверьте текст и подтвердите отдельное согласие."); return; }
    setBusy(true); setError(""); setAnalysis(null);
    const abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 22_000);
    try {
      const response = await fetch("/api/tools/process-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal, body: JSON.stringify({ version: ANALYSIS_VERSION, noticeVersion: ANALYSIS_NOTICE, consent: true, input }) });
      const data = await response.json();
      const checked = response.ok && data.ok && data.version === ANALYSIS_VERSION && data.source === (mode === "mock" ? "mock" : "openai") ? parseProcessAnalysis(data.analysis) : null;
      if (!checked) {
        setError(response.status === 429 ? "Достигнут лимит ИИ-разборов. Попробуйте позже; базовое заключение выше доступно." : "ИИ-разбор недоступен или ответ не прошёл проверку. Базовое заключение выше сохранено.");
        return;
      }
      setAnalysis(checked); setPreview(false); setConsent(false);
      requestAnimationFrame(() => resultHeading.current?.focus());
    } catch { setError("Время ожидания истекло или связь прервалась. Базовое заключение выше сохранено."); }
    finally { clearTimeout(timer); setBusy(false); controller.current = null; }
  }
  if (!open) return <div className="mt-7 border-t border-cream/20 pt-6">
    <button ref={launchButton} type="button" className="min-h-[52px] w-full border border-cream/40 px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal" onClick={() => { setOpen(true); requestAnimationFrame(() => description.current?.focus()); }}>Разобрать мою ситуацию с ИИ</button>
    <p className="text-xs leading-relaxed text-stone">Один процесс своими словами. Бесплатный базовый результат остаётся доступным.</p>
  </div>;
  return <section aria-label="Индивидуальный разбор процесса" className="mt-7 min-w-0 border-t border-cream/20 pt-6 [overflow-wrap:anywhere]">
    <h3 className="font-display text-2xl font-extrabold uppercase">Один процесс — конкретный разбор</h3>
    {mode === "mock" && <p role="note" className="border-l-2 border-signal pl-3 text-sm">Демонстрация на синтетических данных. Это пример интерфейса, а не ответ OpenAI. Внешних вызовов нет.</p>}
    {!preview && !analysis && <form noValidate onSubmit={e => { e.preventDefault(); review(); }}>
      {tasks.length > 1 ? <><label htmlFor="process-task" className="mb-2 block text-sm">Какую одну задачу разбираем?</label><select id="process-task" className={controlClass} value={input.task} onChange={e => change("task", e.target.value)}>{tasks.map(task => <option key={task} value={task}>{taskLabels[task]}</option>)}</select></> : <p className="text-sm text-stone">Задача: {taskLabels[input.task]}</p>}
      <label htmlFor="process-description" className="mb-2 mt-5 block text-sm">Опишите один бизнес-процесс</label>
      <textarea ref={description} id="process-description" maxLength={1800} minLength={60} className={controlClass + " min-h-[180px] py-3"} value={input.description} onChange={e => change("description", e.target.value)} aria-invalid={Boolean(error)} aria-describedby="process-help process-safety" placeholder="Что происходит сейчас? Что хотите получить? Какие инструменты используете?" />
      <p id="process-help" className="text-xs leading-relaxed text-stone">От 60 до 1800 символов. Например: «Менеджер переносит обращения из общей таблицы в карточки задач. Нужно проверять дубли и показывать спорные записи ответственному».</p>
      <details className="my-4 border-y border-cream/20 py-2"><summary className="min-h-[48px] cursor-pointer py-3 text-sm">Если в описании не хватает деталей — два необязательных уточнения</summary>
        <label htmlFor="process-tools" className="my-2 block text-sm">Какие инструменты участвуют?</label><input id="process-tools" maxLength={240} className={controlClass} value={input.tools} onChange={e => change("tools", e.target.value)} />
        <label htmlFor="process-consequence" className="mb-2 mt-4 block text-sm">Что произойдёт при ошибке?</label><input id="process-consequence" maxLength={240} className={controlClass} value={input.consequence} onChange={e => change("consequence", e.target.value)} />
      </details>
      <button type="submit" className="min-h-[52px] w-full border border-cream/40 px-4 py-3 text-sm">Проверить текст перед передачей</button>
    </form>}
    <p id="process-safety" className="text-xs leading-relaxed text-stone">Не вводите имена, контакты, URL, документы, банковские, медицинские или кадровые личные сведения, пароли и коммерческие секреты. Замените людей и организации ролями. Автоматические проверки не гарантируют обезличивание.</p>
    {preview && <div>
      <h4 ref={previewHeading} tabIndex={-1} className="text-lg font-medium">Именно этот текст будет передан в OpenAI</h4>
      <pre className="max-w-full whitespace-pre-wrap break-words border border-cream/20 p-4 font-sans text-sm leading-relaxed" data-testid="process-payload-preview">{processText(input)}</pre>
      <p id="process-notice" className="text-sm leading-relaxed text-stone">По отдельному действию сайт передаст этот текст в OpenAI для предварительного разбора процесса. Контакты из формы заявки, файлы и другие поля калькулятора не добавляются. Сохранение состояния ответа отключено; это не означает нулевого хранения у поставщика. Можно вернуться к бесплатному результату без передачи. <Link href="/privacy" className="underline">Политика обработки данных</Link>.</p>
      <label className="my-4 flex min-h-[48px] items-start gap-3 text-sm leading-relaxed"><input id="process-consent" type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#D92D2D]" checked={consent} disabled={busy} aria-describedby="process-notice" onChange={e => setConsent(e.target.checked)} /><span>Я проверил текст, удалил личные данные и секреты, прочитал уведомление и согласен передать показанный текст в OpenAI для разбора</span></label>
      <button type="button" className={buttonClass + " w-full"} disabled={!consent || busy} onClick={send}>{busy ? "Готовим разбор…" : mode === "mock" ? "Показать тестовый разбор" : "Отправить текст и получить разбор"}</button>
      <button type="button" className="mt-3 min-h-[48px] underline" disabled={busy} onClick={() => { setPreview(false); setConsent(false); setError(""); requestAnimationFrame(() => description.current?.focus()); }}>Вернуться и изменить текст</button>
    </div>}
    {busy && <p role="status" className="text-sm text-stone">Анализируем один процесс. Базовый результат выше остаётся доступным.</p>}
    {error && <p role="alert" className="border-l-2 border-signal pl-3 text-sm">{error}</p>}
    {analysis && <article aria-label="Индивидуальное заключение" className="space-y-5">
      <h4 ref={resultHeading} tabIndex={-1} className="text-xl font-medium">{mode === "mock" ? "Демонстрационное заключение" : "Индивидуальное заключение"}</h4>
      <p className="text-sm leading-relaxed">{analysis.understanding}</p>
      <p className="text-sm font-medium">{analysis.decision === "wait" ? "Сначала уточнить процесс" : analysis.decision === "pilot" ? "Проверить на небольшом пилоте" : "Можно рассмотреть автоматизацию"} · {approaches[analysis.approach]}</p>
      <p className="text-sm leading-relaxed text-stone">{analysis.rationale}</p>
      <h5 className="font-medium">Чем может помочь</h5><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone">{analysis.benefits.map(s => <li key={s}>{s}</li>)}</ul>
      <h5 className="font-medium">Последовательность действий</h5><ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed">{analysis.actions.map(s => <li key={s.title}><strong>{s.title}</strong><p className="mb-0 mt-1 text-stone">{s.detail}</p></li>)}</ol>
      <h5 className="font-medium">Что проверить</h5><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone">{analysis.checks.map(s => <li key={s}>{s}</li>)}</ul>
      <h5 className="font-medium">Минимальный пилот</h5><p className="text-sm leading-relaxed text-stone">{analysis.pilot}</p>
      <h5 className="font-medium">Критерии успеха</h5><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone">{analysis.successCriteria.map(s => <li key={s}>{s}</li>)}</ul>
      <h5 className="font-medium">Риски и ограничения</h5><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone">{[...analysis.risks, ...analysis.uncertainties].map(s => <li key={s}>{s}</li>)}</ul>
      <p className="text-xs leading-relaxed text-stone">Предварительная гипотеза, а не проверка ваших систем. Решения и действия подтверждает человек. Бюджет, срок и экономия здесь не рассчитываются.</p>
      <button type="button" className="min-h-[48px] underline" onClick={() => { setAnalysis(null); setConsent(false); setError(""); requestAnimationFrame(() => description.current?.focus()); }}>Уточнить описание</button>
    </article>}
    <button type="button" disabled={busy} className="mt-4 block min-h-[48px] underline" onClick={() => { setOpen(false); setPreview(false); setConsent(false); setError(""); setAnalysis(null); requestAnimationFrame(() => launchButton.current?.focus()); }}>К базовому результату без ИИ</button>
  </section>;
}
