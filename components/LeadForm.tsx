"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import ConsentDialog from "./ConsentDialog";
import { consentLabel, legal } from "@/config/legal";
import ContactLink from "./ContactLink";
import { contacts } from "@/config/contacts";
import { track, trackFormStartOnce } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";
import {
  HONEYPOT_FIELD, LEAD_DIRECTIONS, LEAD_LIMITS, leadFormExtended, validContact, type LeadDirection,
} from "@/lib/lead";

type Field = "name" | "company" | "phone" | "direction" | "task" | "consent";
type Errors = Partial<Record<Field, string>>;

/** Order the fields appear in — the first invalid one gets focus. */
const FIELD_ORDER: Field[] = ["name", "company", "phone", "direction", "task", "consent"];

const inputClass =
  "min-h-[52px] w-full border border-cream/25 bg-transparent px-4 text-base text-cream outline-none transition-colors placeholder:text-stone focus:border-signal aria-[invalid=true]:border-signal";
const labelClass = "text-[13px] uppercase tracking-[0.06em] text-stone";
const errorClass = "text-[13px] text-signal";

const errorId = (f: Field) => "lead-" + f + "-error";
const describedBy = (f: Field, errors: Errors, extra?: string) =>
  [errors[f] ? errorId(f) : "", extra ?? ""].filter(Boolean).join(" ") || undefined;

export default function LeadForm({ defaultDirection }: { defaultDirection?: LeadDirection }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [direction, setDirection] = useState<LeadDirection | "">(defaultDirection ?? "");
  const [task, setTask] = useState("");
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState(""); // honeypot — must stay empty
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState(false);

  const refs = useRef<Partial<Record<Field, HTMLElement | null>>>({});
  const bind = (f: Field) => (el: HTMLElement | null) => { refs.current[f] = el; };
  const successRef = useRef<HTMLDivElement>(null);

  const closeDialog = useCallback(() => setDialog(false), []);

  const onFieldTouch = () => trackFormStartOnce();
  const clear = (f: Field) => setErrors((p) => ({ ...p, [f]: undefined }));

  const validate = (): Errors => {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = "Укажите имя";
    if (!validContact(phone)) e.phone = "Укажите телефон или Telegram (@username)";
    if (leadFormExtended && !direction) e.direction = "Выберите направление или «Пока не знаю»";
    if (task.trim().length < 10) e.task = "Опишите задачу хотя бы парой предложений";
    if (task.trim().length > LEAD_LIMITS.task) e.task = "Слишком длинное описание — до " + LEAD_LIMITS.task + " символов";
    if (!consent) e.consent = "Нужно согласие на обработку данных";
    return e;
  };

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (sending) return;
    const e = validate();
    setErrors(e);
    const firstInvalid = FIELD_ORDER.find((f) => e[f]);
    if (firstInvalid) {
      refs.current[firstInvalid]?.focus();
      track("lead_submit_error", { reason: "validation" });
      return;
    }

    setSending(true);
    setFailed(false);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, task, consent,
          ...(leadFormExtended ? { company, direction } : {}),
          [HONEYPOT_FIELD]: trap,
          // normalised against known routes on the server
          page: window.location.pathname,
          attribution: getAttribution(),
        }),
      });
      const data: { ok?: boolean; delivered?: boolean } = await res.json().catch(() => ({}));

      // Success is shown ONLY when Telegram confirmed delivery.
      if (res.ok && data.ok === true && data.delivered === true) {
        setSent(true);
        const a = getAttribution();
        track("lead_submit_success", { utm_source: a.utm_source, utm_medium: a.utm_medium, utm_campaign: a.utm_campaign });
        requestAnimationFrame(() => successRef.current?.focus());
      } else {
        setFailed(true);
        track("lead_submit_error", { reason: "delivery" });
      }
    } catch {
      setFailed(true);
      track("lead_submit_error", { reason: "network" });
    } finally {
      setSending(false);
    }
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  if (sent) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="flex items-start gap-3.5 border border-cream/20 p-6 outline-none">
        <span aria-hidden className="mt-2 h-[7px] w-[7px] flex-none rounded-full bg-signal" />
        <div>
          <p className="m-0 font-display text-[20px] font-extrabold uppercase tracking-[-0.01em] text-cream">Заявка отправлена.</p>
          <p className="m-0 mt-1.5 text-[15px] leading-[1.55] text-stone">Я изучу описание и свяжусь с вами, чтобы уточнить детали.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <form noValidate onSubmit={onSubmit} aria-busy={sending} className="flex flex-col gap-5">
        {/* honeypot: hidden from people and assistive tech, tempting for bots */}
        <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="lead-trap">Сайт</label>
          <input
            id="lead-trap" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off"
            value={trap} onChange={(e) => setTrap(e.target.value)}
          />
        </div>

        {errorCount > 0 && (
          <p role="alert" className="m-0 border-l-2 border-signal pl-4 text-[14px] leading-[1.5] text-cream">
            {errorCount === 1 ? "Проверьте отмеченное поле." : "Проверьте отмеченные поля: " + errorCount + "."}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="lead-name" className={labelClass}>
            Имя <span aria-hidden className="text-signal">*</span>
          </label>
          <input
            id="lead-name" ref={bind("name")} type="text" name="name" autoComplete="name" required aria-required
            placeholder="Как к вам обращаться?" maxLength={LEAD_LIMITS.name} value={name}
            onFocus={onFieldTouch}
            onChange={(e) => { setName(e.target.value); clear("name"); }}
            aria-invalid={!!errors.name} aria-describedby={describedBy("name", errors)}
            className={inputClass}
          />
          {errors.name && <span id={errorId("name")} className={errorClass}>{errors.name}</span>}
        </div>

        {leadFormExtended && (
          <div className="flex flex-col gap-2">
            <label htmlFor="lead-company" className={labelClass}>
              Компания <span className="normal-case tracking-normal text-stone">— необязательно</span>
            </label>
            <input
              id="lead-company" ref={bind("company")} type="text" name="company" autoComplete="organization"
              placeholder="Название или сфера бизнеса" maxLength={LEAD_LIMITS.company} value={company}
              onFocus={onFieldTouch}
              onChange={(e) => setCompany(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="lead-phone" className={labelClass}>
            Телефон или Telegram <span aria-hidden className="text-signal">*</span>
          </label>
          <input
            id="lead-phone" ref={bind("phone")} type="text" name="phone" autoComplete="tel" required aria-required
            autoCapitalize="off" autoCorrect="off" spellCheck={false}
            placeholder="+7 999 000-00-00 или @username" maxLength={LEAD_LIMITS.phone} value={phone}
            onFocus={onFieldTouch}
            onChange={(e) => { setPhone(e.target.value); clear("phone"); }}
            aria-invalid={!!errors.phone} aria-describedby={describedBy("phone", errors)}
            className={inputClass}
          />
          {errors.phone && <span id={errorId("phone")} className={errorClass}>{errors.phone}</span>}
        </div>

        {leadFormExtended && (
          <fieldset
            className="m-0 flex flex-col gap-2 border-0 p-0"
            aria-describedby={describedBy("direction", errors)}
            aria-invalid={!!errors.direction}
          >
            <legend className={labelClass + " mb-2 p-0"}>
              Направление <span aria-hidden className="text-signal">*</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
              {LEAD_DIRECTIONS.map((d, i) => (
                <label
                  key={d.value}
                  className="flex min-h-[48px] cursor-pointer items-center gap-3 border border-cream/25 px-4 text-[15px] text-cream transition-colors hover:border-cream/50 has-[:checked]:border-signal has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal"
                >
                  <input
                    ref={i === 0 ? bind("direction") : undefined}
                    type="radio" name="direction" value={d.value} checked={direction === d.value}
                    onFocus={onFieldTouch}
                    onChange={() => { setDirection(d.value); clear("direction"); }}
                    className="h-4 w-4 flex-none accent-[#D92D2D] focus-visible:outline-none"
                  />
                  {d.label}
                </label>
              ))}
            </div>
            {errors.direction && <span id={errorId("direction")} className={errorClass}>{errors.direction}</span>}
          </fieldset>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="lead-task" className={labelClass}>
            Описание задачи <span aria-hidden className="text-signal">*</span>
          </label>
          <textarea
            id="lead-task" ref={bind("task")} name="task" rows={4} maxLength={LEAD_LIMITS.task} required aria-required
            placeholder="Например: каждую неделю вручную собираем отчёт из CRM и таблиц, на это уходит полдня."
            value={task}
            onFocus={onFieldTouch}
            onChange={(e) => { setTask(e.target.value); clear("task"); }}
            aria-invalid={!!errors.task} aria-describedby={describedBy("task", errors, "lead-task-count")}
            className="min-h-[124px] w-full resize-y border border-cream/25 bg-transparent p-4 text-base leading-[1.5] text-cream outline-none transition-colors placeholder:text-stone focus:border-signal aria-[invalid=true]:border-signal"
          />
          <span id="lead-task-count" className="self-end text-[12px] text-stone">
            {task.length} / {LEAD_LIMITS.task}
          </span>
          {errors.task && <span id={errorId("task")} className={errorClass}>{errors.task}</span>}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <input
              id="lead-consent" ref={bind("consent")} type="checkbox" name="consent" checked={consent} required aria-required
              onChange={(e) => { setConsent(e.target.checked); clear("consent"); }}
              aria-invalid={!!errors.consent} aria-describedby={describedBy("consent", errors)}
              className="mt-[2px] h-5 w-5 flex-none cursor-pointer accent-[#D92D2D]"
            />
            <p className="m-0 text-[14px] leading-[1.5] text-stone">
              <label htmlFor="lead-consent" className="cursor-pointer">{consentLabel}</label>
              {" "}
              <button
                type="button"
                onClick={() => setDialog(true)}
                className="inline-flex min-h-[24px] items-center text-cream underline underline-offset-[3px] hover:text-signal"
              >
                Подробнее
              </button>
            </p>
          </div>
          {errors.consent && <span id={errorId("consent")} className={errorClass}>{errors.consent}</span>}
        </div>

        {failed && (
          <div role="alert" className="border border-signal/50 p-4 text-[14px] leading-[1.55] text-cream">
            Не получилось доставить заявку. Попробуйте ещё раз или напишите напрямую:{" "}
            <ContactLink contact={contacts.telegram} location="form_fallback" className="text-signal underline underline-offset-[3px]">
              {contacts.telegram.text}
            </ContactLink>
          </div>
        )}

        <button
          type="submit"
          disabled={sending}
          className="mt-1 min-h-[58px] bg-signal text-base font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] disabled:cursor-wait disabled:opacity-60"
        >
          {sending ? "Отправляю…" : "Отправить задачу"}
        </button>

        {legal.published ? (
          // the approved consent is a separate document and is not bundled with the policy
          <p className="m-0 text-[13px] leading-[1.5] text-stone">
            Как обрабатываются данные — в{" "}
            <Link href="/privacy" className="text-cream/80 underline underline-offset-[3px] hover:text-cream">Политике обработки персональных данных</Link>.
          </p>
        ) : (
          <p className="m-0 text-[13px] leading-[1.5] text-stone">
            Нажимая кнопку, вы принимаете{" "}
            <Link href="/consent" className="text-cream/80 underline underline-offset-[3px] hover:text-cream">согласие на обработку данных</Link>{" "}
            и{" "}
            <Link href="/privacy" className="text-cream/80 underline underline-offset-[3px] hover:text-cream">политику</Link>.
          </p>
        )}
      </form>

      <ConsentDialog open={dialog} onClose={closeDialog} />
    </>
  );
}
