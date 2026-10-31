"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONSENT_OPEN_EVENT, readConsent, revokeConsent, saveConsent, type ConsentChoice } from "@/lib/consent";

/**
 * Shown when NEXT_PUBLIC_ANALYTICS_CONSENT=required and no choice is stored, or
 * when reopened from the footer. DRAFT wording — to be approved together with
 * the privacy policy before the mode is switched on.
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
        <p className="m-0 max-w-[62ch] text-[14px] leading-[1.55] text-cream/85">
          Сайт может использовать Яндекс Метрику и Google Analytics для обезличенной статистики посещений.
          {current && <> Сейчас: {current === "granted" ? "разрешено" : "отклонено"}.</>}{" "}
          <Link href="/privacy" className="text-cream underline underline-offset-[3px] hover:text-signal">
            Подробнее
          </Link>
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => choose("granted")}
            className="min-h-[44px] bg-signal px-5 text-[13px] font-medium uppercase tracking-[0.06em] text-white hover:bg-[#b82323]"
          >
            Разрешить
          </button>
          <button
            type="button"
            onClick={() => choose("denied")}
            className="min-h-[44px] border border-cream/30 px-5 text-[13px] uppercase tracking-[0.06em] text-cream hover:border-cream"
          >
            Отклонить
          </button>
        </div>
      </div>
    </div>
  );
}
