"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONSENT_OPEN_EVENT, readConsent, revokeConsent, saveConsent, type ConsentChoice } from "@/lib/consent";

/**
 * Shown when NEXT_PUBLIC_ANALYTICS_CONSENT=required and no choice is stored, or
 * when reopened from «Настройки аналитики» in the footer. Wording: owner's
 * docs/legal/cookies.md. Both choices look the same — neither is pushed.
 * Declining affects analytics only; the lead form works either way.
 */
export default function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ConsentChoice | null>(null);

  useEffect(() => {
    const c = readConsent();
    setCurrent(c);
    setOpen(c === null);
    const reopen = () => {
      setCurrent(readConsent());
      setOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (c: ConsentChoice) => {
    // withdrawing a previous «yes» must also remove the counters' cookies
    if (c === "denied" && current === "granted") return revokeConsent();
    saveConsent(c);
    setCurrent(c);
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Согласие на аналитику"
      className="fixed inset-x-0 bottom-0 z-[55] border-t border-cream/15 bg-graphite px-[22px] pb-[calc(16px+env(safe-area-inset-bottom))] pt-4"
    >
      <div className="mx-auto flex max-w-[1080px] flex-col gap-4 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
        <p className="m-0 max-w-[68ch] text-[14px] leading-[1.55] text-cream/85">
          Мы используем Яндекс Метрику и Google Analytics 4, чтобы понимать, как посетители пользуются сайтом.
          Аналитика может использовать cookies и передавать технические данные поставщикам сервисов. До вашего
          разрешения необязательная аналитика не загружается. Подробнее — в{" "}
          <Link href="/privacy" className="text-cream underline underline-offset-[3px] hover:text-signal">
            Политике обработки персональных данных
          </Link>
          .
          {current && <> Сейчас: {current === "granted" ? "аналитика разрешена" : "аналитика отклонена"}.</>}
        </p>
        <div className="grid grid-cols-2 gap-3 min-[760px]:flex min-[760px]:flex-none">
          {(
            [
              ["granted", "Разрешить аналитику"],
              ["denied", "Отклонить"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              className="min-h-[48px] border border-cream/40 px-4 text-[13px] font-medium uppercase tracking-[0.04em] text-cream transition-colors hover:border-cream hover:bg-cream/10"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
