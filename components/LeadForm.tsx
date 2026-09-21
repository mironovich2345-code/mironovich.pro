"use client";

import Link from "next/link";
import { useState } from "react";
import ConsentDialog from "./ConsentDialog";
import { site } from "@/config/site";
import { track, trackFormStartOnce } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";

type Errors = Partial<Record<"name" | "phone" | "task" | "consent" | "form", string>>;

const LIMITS = { name: 100, phone: 40, task: 2000 };

// accepts a phone number OR a Telegram username / t.me link
export const validContact = (v: string) => {
  const s = v.trim().replace(/^https?:\/\/t\.me\//i, "");
  if (/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(s)) return true;
  return s.replace(/\D/g, "").length >= 10;
};

const inputClass =
  "min-h-[52px] rounded-md border border-neutral-800 bg-bg px-4 text-base text-ink outline-none transition-colors placeholder:text-neutral-600 focus:border-accent";

export default function LeadForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [task, setTask] = useState("");
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState(""); // honeypot — must stay empty
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState(false);

  // one shared hook so any field can open the session
  const onFieldTouch = () => trackFormStartOnce();

  const validate = (): Errors => {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = "Укажите имя";
    if (!validContact(phone)) e.phone = "Укажите телефон или Telegram (@username)";
    if (task.trim().length < 10) e.task = "Опишите текущее обучение хотя бы парой предложений";
    if (task.trim().length > LIMITS.task) e.task = "Слишком длинное описание — до " + LIMITS.task + " символов";
    if (!consent) e.consent = "Нужно согласие на обработку данных";
    return e;
  };

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      track("lead_submit_error", { reason: "validation" });
      return;
    }

    setSending(true);
    setFailed(false);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, task, consent, company, attribution: getAttribution() }),
      });
      const data: { ok?: boolean; delivered?: boolean } = await res.json().catch(() => ({}));

      // Success is shown ONLY when Telegram confirmed delivery.
      if (res.ok && data.ok === true && data.delivered === true) {
        setSent(true);
        const a = getAttribution();
        track("lead_submit_success", {
          utm_source: a.utm_source,
          utm_medium: a.utm_medium,
          utm_campaign: a.utm_campaign,
        });
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

  return (
    <section id="contact" className="mx-auto max-w-[720px] scroll-mt-3 px-[22px] pb-11 pt-10 min-[560px]:pt-14">
      <div className="rounded-lg bg-gradient-to-b from-surface to-panel p-[clamp(22px,5vw,38px)] shadow-[0_0_0_1px_#3f424d,0_16px_40px_rgba(0,0,0,0.5)]">
        <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">08 — Обсудить задачу</p>
        <h2 className="m-0 mb-3.5 text-balance text-[clamp(26px,6.2vw,42px)] font-medium leading-[1.08] tracking-[-0.03em]">
          Расскажите, как сейчас обучаются ваши сотрудники
        </h2>
        <p className="m-0 mb-7 max-w-[50ch] text-pretty text-[15px] leading-[1.6] text-neutral-500">
          Я посмотрю на текущий процесс и предложу, в каком направлении его можно систематизировать.
        </p>

        {sent ? (
          <div role="status" className="flex items-start gap-3.5 rounded-md bg-accent-900 p-6 shadow-[0_0_0_1px_#5d5294]">
            <span className="mt-2 h-[7px] w-[7px] flex-none rounded-full bg-accent" />
            <div>
              <p className="m-0 text-[19px] tracking-[-0.02em]">Заявка отправлена.</p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.55] text-neutral-400">
                Свяжусь с вами для обсуждения текущего процесса обучения.
              </p>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
            {/* honeypot: hidden from humans, tempting for bots */}
            <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
              <label htmlFor="company">Компания</label>
              <input
                id="company" name="company" type="text" tabIndex={-1} autoComplete="off"
                value={company} onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-[13px] text-neutral-500">Имя <span className="text-accent-400">*</span></span>
              <input
                type="text" name="name" autoComplete="name" placeholder="Как к вам обращаться?"
                maxLength={LIMITS.name} value={name}
                onFocus={onFieldTouch}
                onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                aria-invalid={!!errors.name}
                className={inputClass}
              />
              {errors.name && <span className="text-[12.5px] text-[#e4a4a4]">{errors.name}</span>}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[13px] text-neutral-500">Телефон или Telegram <span className="text-accent-400">*</span></span>
              <input
                type="text" name="phone" autoComplete="tel" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                placeholder="+7 999 000-00-00 или @username"
                maxLength={LIMITS.phone} value={phone}
                onFocus={onFieldTouch}
                onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: undefined })); }}
                aria-invalid={!!errors.phone}
                className={inputClass}
              />
              {errors.phone && <span className="text-[12.5px] text-[#e4a4a4]">{errors.phone}</span>}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[13px] text-neutral-500">Как сейчас устроено обучение сотрудников? <span className="text-accent-400">*</span></span>
              <textarea
                name="task" rows={4} maxLength={LIMITS.task}
                placeholder="Например: новичков обучает управляющий, материалы лежат в Telegram и PDF, единых тестов и контроля прохождения нет."
                value={task}
                onFocus={onFieldTouch}
                onChange={(e) => { setTask(e.target.value); setErrors((p) => ({ ...p, task: undefined })); }}
                aria-invalid={!!errors.task}
                className="min-h-[124px] resize-y rounded-md border border-neutral-800 bg-bg p-4 text-base leading-[1.5] text-ink outline-none transition-colors placeholder:text-neutral-600 focus:border-accent"
              />
              <span className="self-end text-[12px] text-neutral-600">{task.length} / {LIMITS.task}</span>
              {errors.task && <span className="text-[12.5px] text-[#e4a4a4]">{errors.task}</span>}
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox" name="consent" checked={consent}
                onChange={(e) => { setConsent(e.target.checked); setErrors((p) => ({ ...p, consent: undefined })); }}
                className="mt-[1px] h-5 w-5 flex-none accent-[#9184d9]"
              />
              <span className="text-[13.5px] leading-[1.45] text-neutral-500">
                Я соглашаюсь на{" "}
                <button type="button" onClick={() => setDialog(true)} className="text-accent-300 underline underline-offset-[3px]">
                  обработку персональных данных
                </button>
              </span>
            </label>
            {errors.consent && <span className="-mt-2.5 text-[12.5px] text-[#e4a4a4]">{errors.consent}</span>}

            {failed && (
              <div role="alert" className="rounded-md bg-accent-900 p-4 text-[13.5px] leading-[1.55] text-neutral-300 shadow-[0_0_0_1px_#5d5294]">
                Не получилось доставить заявку. Попробуйте еще раз или напишите напрямую:{" "}
                <a
                  href={site.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track("telegram_fallback_click")}
                  className="text-accent-300 underline underline-offset-[3px]"
                >
                  {site.telegram.replace("https://", "")}
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="mt-1 min-h-[58px] rounded-md border border-accent bg-accent-900 text-base font-medium tracking-[-0.01em] text-accent-200 transition-colors hover:border-accent-400 hover:bg-accent-800 hover:text-accent-100 active:bg-accent-700 disabled:opacity-45"
            >
              {sending ? "Отправляю…" : "Разобрать систему обучения"}
            </button>
            <p className="m-0 text-pretty text-center text-[13px] leading-[1.5] text-neutral-500">
              После заявки я посмотрю описание и свяжусь с вами для уточнения деталей.
            </p>

            <p className="m-0 text-[12.5px] leading-[1.5] text-neutral-600">
              Нажимая кнопку, вы принимаете{" "}
              <Link href="/consent" className="text-neutral-500 underline underline-offset-[3px]">согласие на обработку данных</Link>{" "}
              и{" "}
              <Link href="/privacy" className="text-neutral-500 underline underline-offset-[3px]">политику</Link>.
            </p>
          </form>
        )}
      </div>

      <ConsentDialog open={dialog} onClose={() => setDialog(false)} />
    </section>
  );
}
