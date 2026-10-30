"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="bg-graphite px-[22px] py-20 min-[560px]:py-28">
      <div className="mx-auto max-w-[1080px]">
        <p className="m-0 mb-8 text-[11px] uppercase tracking-[0.22em] text-signal">Ошибка</p>
        <h1 className="m-0 mb-6 max-w-[16ch] font-display text-[clamp(36px,8vw,80px)] font-extrabold uppercase leading-[0.98] tracking-[-0.02em] text-cream">
          Что-то пошло не так<span className="text-signal">.</span>
        </h1>
        <p className="m-0 mb-10 max-w-[48ch] text-pretty text-[16px] leading-[1.6] text-stone">
          Страница не загрузилась. Попробуйте ещё раз или вернитесь на главную.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[56px] items-center justify-center bg-signal px-8 text-[15px] font-medium uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#b82323]"
          >
            Попробовать ещё раз
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[56px] items-center justify-center border border-cream/30 px-8 text-[15px] uppercase tracking-[0.06em] text-cream transition-colors hover:border-cream"
          >
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
