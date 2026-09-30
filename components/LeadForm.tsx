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
  "min-h-[52px] border border-cream/20 bg-transparent px-4 text-base text-cream outline-none transition-colors placeholder:text-stone/70 focus:border-signal";
const fieldLabelClass = "text-[13px] uppercase tracking-[0.06em] text-stone";
const errorClass = "text-[12.5px] text-signal";

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
    <section id="contact" className="scroll-mt-3 bg-graphite px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-10 flex items-end justify-between gap-6 min-[560px]:mb-14">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-signal">08 / Обсудить задачу</p>
          <p className="m-0 hidden text-[11px] uppercase tracking-[0.22em] text-stone min-[560px]:block">Mironovich / 2026</p>
        </div>

        <div className="grid gap-14 min-[900px]:grid-cols-[1fr_1.1fr] min-[900px]:gap-20">
          <div>
            <h2 className="m-0 mb-5 max-w-[14ch] text-balance font-display text-[clamp(34px,7vw,68px)] font-extrabold uppercase leading-[0.98] tracking-[-0.02em] text-cream">
              Расскажите, как у вас обучают людей<span className="text-signal">.</span>
            </h2>
            <p className="m-0 max-w-[42ch] text-pretty text-[15.5px] leading-[1.65] text-stone">
              Я посмотрю на текущий процесс и предложу, в каком направлении его можно систематизировать.
            </p>
          </div>

          <div>
            {sent ? (
              <div role="status" className="flex items-start gap-3.5 border border-cream/15 p-6">
                <span className="mt-2 h-[7px] w-[7px] flex-none rounded-full bg-signal" />
                <div>
                  <p className="m-0 font-display text-[20px] font-extrabold uppercase tracking-[-0.01em] text-cream">
                    Заявка отправлена.
                  </p>
                  <p className="m-0 mt-1.5 text-[15px] leading-[1.55] text-stone">
                    Свяжусь с вами для обсуждения текущего процесса обучения.
                  </p>
                </div>
              </div>
            ) : (
              <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
                {/* honeypot: hidden from humans, tempting for bots */}
                <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
                  <label htmlFor="company">Компания</label>
                  <input
                    id="company" name="company" type="text" tabIndex={-1} autoComplete="off"
                    value={company} onChange={(e) => setCompany(e.target.value)}
                  />
                </div>

                <label className="flex flex-col gap-2">
                  <span className={fieldLabelClass}>Имя <span className="text-signal">*</span></span>
                  <input
                    type="text" name="name" autoComplete="name" placeholder="Как к вам обращаться?"
                    maxLength={LIMITS.name} value={name}
                    onFocus={onFieldTouch}
                    onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                    aria-invalid={!!errors.name}
                    className={inputClass}
                  />
                  {errors.name && <span className={errorClass}>{errors.name}</span>}
                </label>

                <label className="flex flex-col gap-2">
                  <span className={fieldLabelClass}>Телефон или Telegram <span className="text-signal">*</span></span>
                  <input
                    type="text" name="phone" autoComplete="tel" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                    placeholder="+7 999 000-00-00 или @username"
                    maxLength={LIMITS.phone} value={phone}
                    onFocus={onFieldTouch}
                    onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: undefined })); }}
                    aria-invalid={!!errors.phone}
                    className={inputClass}
                  />
                  {errors.phone && <span className={errorClass}>{errors.phone}</span>}
                </label>

                <label className="flex flex-col gap-2">
                  <span className={fieldLabelClass}>Как сейчас устроено обучение сотрудников? <span className="text-signal">*</span></span>
                  <textarea
                    name="task" rows={4} maxLength={LIMITS.task}
                    placeholder="Например: новичков обучает управляющий, материалы лежат в Telegram и PDF, единых тестов и контроля прохождения нет."
                    value={task}
                    onFocus={onFieldTouch}
                    onChange={(e) => { setTask(e.target.value); setErrors((p) => ({ ...p, task: undefined })); }}
                    aria-invalid={!!errors.task}
                    className="min-h-[124px] resize-y border border-cream/20 bg-transparent p-4 text-base leading-[1.5] text-cream outline-none transition-colors placeholder:text-stone/70 focus:border-signal"
                  />
                  <span className="self-end text-[12px] text-stone/70">{task.length} / {LIMITS.task}</span>
                  {errors.task && <span className={errorClass}>{errors.task}</span>}
                </label>

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox" name="consent" checked={consent}
                    onChange={(e) => { setConsent(e.target.checked); setErrors((p) => ({ ...p, consent: undefined })); }}
                    className="mt-[1px] h-5 w-5 flex-none accent-[#D92D2D]"
                  />
                  <span className="text-[13.5px] leading-[1.45] text-stone">
                    Я соглашаюсь на{" "}
                    <button type="button" onClick={() => setDialog(true)} className="text-cream underline underline-offset-[3px] hover:text-signal">
                      обработку персональных данных
                    </button>
                  </span>
                </label>
                {errors.consent && <span className={"-mt-2.5 " + errorClass}>{errors.consent}</span>}

                {failed && (
                  <div role="alert" className="border border-signal/40 p-4 text-[13.5px] leading-[1.55] text-cream">
                    Не получилось доставить заявку. Попробуйте еще раз или напишите напрямую:{" "}
                    <a
                      href={site.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track("telegram_fallback_click")}
                      className="text-signal underline underline-offset-[3px]"
                    >
                      {site.telegram.replace("https://", "")}
                    </a>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="mt-1 min-h-[58px] bg-signal text-base font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] disabled:opacity-45"
                >
                  {sending ? "Отправляю…" : "Разобрать систему обучения"}
                </button>
                <p className="m-0 text-pretty text-center text-[13px] leading-[1.5] text-stone">
                  После заявки я посмотрю описание и свяжусь с вами для уточнения деталей.
                </p>

                <p className="m-0 text-[12.5px] leading-[1.5] text-stone/70">
                  Нажимая кнопку, вы принимаете{" "}
                  <Link href="/consent" className="text-stone underline underline-offset-[3px] hover:text-cream">согласие на обработку данных</Link>{" "}
                  и{" "}
                  <Link href="/privacy" className="text-stone underline underline-offset-[3px] hover:text-cream">политику</Link>.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      <ConsentDialog open={dialog} onClose={() => setDialog(false)} />
    </section>
  );
}
