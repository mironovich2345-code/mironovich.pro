"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const paragraphs = [
  "Отправляя форму, вы даете согласие на обработку указанных вами персональных данных: имени, номера телефона и текста обращения.",
  "Данные используются исключительно для связи с вами и обсуждения задачи. Они не передаются третьим лицам и не используются для рассылок.",
  "Заявка передается в закрытый Telegram-чат владельца сайта и хранится до завершения обсуждения. Согласие можно отозвать в любой момент.",
];

export default function ConsentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-graphite/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[86vh] w-full max-w-[620px] overflow-y-auto border-t border-cream/15 bg-graphite px-[22px] pb-[34px] pt-[26px]"
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-cream/15 pb-4">
          <h3 id="consent-title" className="m-0 text-xl font-medium tracking-[-0.02em] text-cream">
            Согласие на обработку персональных данных
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="h-9 w-9 flex-none border border-cream/20 text-lg text-stone transition-colors hover:border-signal hover:text-cream"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-3 text-sm leading-[1.65] text-stone">
          {paragraphs.map((p) => <p key={p} className="m-0">{p}</p>)}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px]">
          <Link href="/consent" className="text-cream underline underline-offset-[3px] hover:text-signal">Полный текст согласия</Link>
          <Link href="/privacy" className="text-cream underline underline-offset-[3px] hover:text-signal">Политика обработки данных</Link>
        </div>
      </div>
    </div>
  );
}
