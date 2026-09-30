"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import CtaLink from "./CtaLink";

/** Plain disclosure below 760px: no animation, closes on link tap, route change and Escape. */
export default function MobileMenu({ links }: { links: readonly { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="min-[760px]:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[38px] items-center border border-cream/20 px-3.5 text-[13px] uppercase tracking-[0.06em] text-cream transition-colors hover:border-signal"
      >
        {open ? "Закрыть" : "Меню"}
      </button>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Основная навигация"
          className="absolute inset-x-0 top-full border-y border-cream/10 bg-graphite px-[22px] pb-5 pt-2"
        >
          <ul className="m-0 flex list-none flex-col p-0">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={close}
                  className="flex min-h-[48px] items-center border-b border-cream/10 text-[15px] uppercase tracking-[0.04em] text-stone hover:text-cream"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <CtaLink
            href="/#contact"
            location="header"
            onClick={close}
            className="mt-4 flex min-h-[50px] items-center justify-center bg-signal text-[15px] font-medium uppercase tracking-[0.06em] text-white"
          >
            Обсудить задачу
          </CtaLink>
        </nav>
      )}
    </div>
  );
}
