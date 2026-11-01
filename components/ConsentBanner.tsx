"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CONSENT_OPEN_EVENT, readConsent, revokeConsent, saveConsent, type ConsentChoice } from "@/lib/consent";

/**
 * Compact consent panel, shown when NEXT_PUBLIC_ANALYTICS_CONSENT=required and no
 * choice is stored, or when reopened from «Настройки аналитики» in the footer.
 * Wording approved by the owner; the full list of analytics services is in the
 * privacy policy. Declining affects analytics only — the lead form always works.
 *
 * Layout: a bottom panel 12px from the screen edges on phones, a 440px card in
 * the bottom-right corner on desktop. While open, the page gets matching bottom
 * padding so nothing underneath becomes unreachable.
 *
 * Rendered open on the server so it paints with the page (it is often the LCP
 * element — waiting for hydration cost ~1.5 s). Returning visitors never see it:
 * consentPrecheckScript hides it before paint and the effect below unmounts it.
 */
export default function ConsentBanner() {
  const [open, setOpen] = useState(true);
  const [reopened, setReopened] = useState(false);
  const [current, setCurrent] = useState<ConsentChoice | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const focusOnOpen = useRef(false);

  useEffect(() => {
    const c = readConsent();
    setCurrent(c);
    setOpen(c === null);
    const reopen = () => {
      setCurrent(readConsent());
      focusOnOpen.current = true; // opened on purpose from the footer: move the keyboard there
      setReopened(true);
      setOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  // keep the end of the page scrollable above the panel
  useEffect(() => {
    if (!open || !panelRef.current) return;
    if (focusOnOpen.current) {
      firstButtonRef.current?.focus();
      focusOnOpen.current = false;
    }
    const panel = panelRef.current;
    const body = document.body;
    const prev = body.style.paddingBottom;
    const apply = () => {
      const gap = window.innerHeight - panel.getBoundingClientRect().top;
      body.style.paddingBottom = Math.ceil(gap + 8) + "px";
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(panel);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      body.style.paddingBottom = prev;
    };
  }, [open]);

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
      ref={panelRef}
      data-consent-banner=""
      data-reopened={reopened ? "" : undefined}
      role="region"
      aria-labelledby="consent-title"
      className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-[55] rounded-[6px] border border-cream/15 bg-graphite p-4 shadow-[0_12px_32px_rgba(0,0,0,0.5)] min-[560px]:inset-x-4 min-[560px]:bottom-[calc(16px+env(safe-area-inset-bottom))] min-[760px]:left-auto min-[760px]:right-6 min-[760px]:bottom-[calc(24px+env(safe-area-inset-bottom))] min-[760px]:w-[440px] min-[760px]:p-5"
    >
      <div className="mb-2 flex items-center gap-2.5">
        {/* cookie mark — decorative */}
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" className="flex-none text-signal">
          <path
            d="M21 12.5A9 9 0 1 1 11.5 3a3.5 3.5 0 0 0 4 4 3.5 3.5 0 0 0 4 4 3 3 0 0 0 1.5 1.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="8.5" cy="10" r="1.3" fill="currentColor" />
          <circle cx="13" cy="15.5" r="1.3" fill="currentColor" />
          <circle cx="8" cy="15.5" r="1" fill="currentColor" />
        </svg>
        <h2 id="consent-title" className="m-0 text-[15px] font-medium tracking-[-0.005em] text-cream">
          Используем cookies
        </h2>
      </div>

      <p className="m-0 text-pretty text-[13.5px] leading-[1.5] text-cream/80">
        Мы используем cookies для анализа посещаемости и улучшения сайта. Вы можете разрешить или отклонить аналитику.
      </p>
      {current && (
        <p className="m-0 mt-2.5 flex items-center gap-2 text-[12.5px] leading-[1.45] text-cream/85">
          <span
            aria-hidden
            className={`h-2 w-2 flex-none rounded-full ${current === "granted" ? "bg-[#3FB27F]" : "bg-stone"}`}
          />
          <span>
            Текущий выбор: аналитика <strong className="font-medium text-cream">{current === "granted" ? "разрешена" : "отклонена"}</strong>
          </span>
        </p>
      )}

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <button
          ref={firstButtonRef}
          type="button"
          onClick={() => choose("granted")}
          className="min-h-[44px] rounded-[4px] bg-signal px-3 text-center text-[14px] font-medium leading-[1.2] text-white transition-colors hover:bg-[#b82323]"
        >
          Разрешить
        </button>
        <button
          type="button"
          onClick={() => choose("denied")}
          className="min-h-[44px] rounded-[4px] border border-cream/35 bg-transparent px-3 text-center text-[14px] font-medium leading-[1.2] text-cream transition-colors hover:border-cream hover:bg-cream/5"
        >
          Отклонить
        </button>
      </div>

      <Link
        href="/privacy"
        className="mt-2.5 inline-flex min-h-[28px] items-center text-[12.5px] text-cream/75 underline decoration-cream/40 underline-offset-[3px] transition-colors hover:text-cream hover:decoration-cream"
      >
        Подробнее о cookies
      </Link>
    </div>
  );
}
