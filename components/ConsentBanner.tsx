"use client";

import Link from "next/link";
import { metricaId } from "@/lib/analytics";
import { useEffect, useRef, useState } from "react";
import { CONSENT_OPEN_EVENT, purgeOptionalTracking, readConsent, revokeConsent, saveConsent, type ConsentChoice } from "@/lib/consent";

/**
 * Explicit opt-in for OPTIONAL analytics/attribution storage, whether or not
 * Yandex Metrica is configured. No optional data is stored or transmitted
 * until "Согласен"; a rejection must be equally easy and leave the form working.
 * If Metrica is configured later, a different consent key requires a NEW choice.
 *
 * Layout: at every width the panel is in normal document flow, right below the
 * sticky header, so it never covers navigation, calls to action or sale status.
 * From 760px its content is one row inside the 1080px page grid: text left,
 * choices right. (A bottom-right overlay covered the hero CTA at 768–1440px.)
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
      // The panel is in normal flow, not an overlay: no extra bottom padding needed.
      if (getComputedStyle(panel).position !== "fixed") {
        body.style.paddingBottom = prev;
        return;
      }
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
    if (c === "denied") purgeOptionalTracking();
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
      className="relative z-[55] w-full border-y border-cream/15 bg-graphite px-4 py-3 min-[760px]:px-[22px] min-[760px]:py-4"
    >
      <div className="mx-auto max-w-[1080px] min-[760px]:grid min-[760px]:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] min-[760px]:items-center min-[760px]:gap-x-8">
      <div className="min-w-0">
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
          Настройки cookies
        </h2>
      </div>

      <p className="m-0 text-pretty text-[13px] leading-[1.45] text-cream/80 min-[560px]:text-[13.5px] min-[560px]:leading-[1.5]">
        {metricaId
          ? "Только с вашего согласия мы используем необязательные cookies и данные о посещениях для Яндекс Метрики и аналитики сайта. До согласия аналитика не загружается. Отказ не мешает пользоваться сайтом."
          : "Только с вашего согласия мы сохраняем необязательные данные об источниках посещений. Яндекс Метрика пока не подключена. Без согласия необязательные cookies и отслеживание отключены."}
      </p>
      {current && (
        <p className="m-0 mt-2.5 flex items-center gap-2 text-[12.5px] leading-[1.45] text-cream/85">
          <span
            aria-hidden
            className={`h-2 w-2 flex-none rounded-full ${current === "granted" ? "bg-[#3FB27F]" : "bg-stone"}`}
          />
          <span>
            Ваш выбор: <strong className="font-medium text-cream">{current === "granted" ? "согласие дано" : "согласия нет"}</strong>
          </span>
        </p>
      )}

      </div>
      <div>
      <div className="mt-3 grid grid-cols-2 gap-2 min-[560px]:mt-3.5 min-[760px]:mt-0">
        <button
          ref={firstButtonRef}
          type="button"
          onClick={() => choose("granted")}
          className="min-h-[44px] rounded-[4px] bg-signal px-3 text-center text-[14px] font-medium leading-[1.2] text-white transition-colors hover:bg-[#b82323]"
        >
          Согласен
        </button>
        <button
          type="button"
          onClick={() => choose("denied")}
          className="min-h-[44px] rounded-[4px] border border-cream/35 bg-transparent px-3 text-center text-[14px] font-medium leading-[1.2] text-cream transition-colors hover:border-cream hover:bg-cream/5"
        >
          Не согласен
        </button>
      </div>

      <Link
        href="/privacy"
        className="mt-2.5 inline-flex min-h-[28px] items-center text-[12.5px] text-cream/75 underline decoration-cream/40 underline-offset-[3px] transition-colors hover:text-cream hover:decoration-cream"
      >
        Подробнее о cookies
      </Link>
      </div>
      </div>
    </div>
  );
}
