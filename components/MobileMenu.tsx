"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CtaLink from "./CtaLink";
import { contactHref, type NavLink } from "@/config/site";

const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * Full-screen menu below 860px: closes on link tap, route change and Escape,
 * keeps Tab inside while open, locks page scroll and returns focus to the toggle.
 */
export default function MobileMenu({ services, links }: { services: NavLink[]; links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [toggle, ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(Boolean) as HTMLElement[];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      toggle?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);
  const itemClass =
    "flex min-h-[52px] items-center justify-between border-b border-cream/10 text-[16px] uppercase tracking-[0.04em] text-cream hover:text-signal";

  return (
    <div className="min-[860px]:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="relative z-50 inline-flex min-h-[44px] items-center border border-cream/25 px-4 text-[13px] uppercase tracking-[0.06em] text-cream transition-colors hover:border-signal"
      >
        {open ? "Закрыть" : "Меню"}
      </button>

      {open && (
        <div
          ref={panelRef}
          id="mobile-menu"
          className="fixed inset-x-0 bottom-0 top-[65px] z-40 overflow-y-auto border-t border-cream/10 bg-graphite px-[22px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-4"
        >
          <nav aria-label="Основная навигация">
            <Link
              href="/services"
              onClick={close}
              className="mb-1 mt-1 inline-flex min-h-[44px] items-center text-[11px] uppercase tracking-[0.22em] text-signal"
            >
              Услуги — все направления →
            </Link>
            <ul className="m-0 mb-6 flex list-none flex-col border-t border-cream/10 p-0">
              {services.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={close} className={itemClass}>
                    {l.label} <span aria-hidden className="text-stone">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="m-0 flex list-none flex-col border-t border-cream/10 p-0">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={close} className={itemClass}>
                    {l.label} <span aria-hidden className="text-stone">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <CtaLink
            href={contactHref}
            location="header"
            onClick={close}
            className="mt-8 flex min-h-[56px] items-center justify-center bg-signal text-[15px] font-medium uppercase tracking-[0.06em] text-white"
          >
            Обсудить задачу бесплатно
          </CtaLink>
        </div>
      )}
    </div>
  );
}
