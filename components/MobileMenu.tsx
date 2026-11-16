"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CtaLink from "./CtaLink";
import { contactHref, type HeaderNavGroup } from "@/config/routes";

const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * Accessible full-screen menu below 1150px: same audience categories as desktop.
 * Scrollable content, Escape to dismiss, focus trap, and scroll lock.
 */
export default function MobileMenu({ groups }: { groups: readonly HeaderNavGroup[] }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(65);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return setOpen(false);
      if (event.key !== "Tab" || !panelRef.current) return;
      const items = [toggle, ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(Boolean) as HTMLElement[];
      const first = items[0];
      const last = items[items.length - 1];
      if (!event.shiftKey && document.activeElement === toggle) {
        event.preventDefault();
        items[1]?.focus();
      } else if (event.shiftKey && document.activeElement === items[1]) {
        event.preventDefault();
        toggle?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      toggle?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);
  const itemClass =
    "flex min-h-[48px] items-center justify-between border-b border-cream/10 text-[15px] uppercase tracking-[0.04em] text-cream hover:text-signal";

  return (
    <div className="min-[1150px]:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => {
          const header = toggleRef.current?.closest("header");
          if (header) setTop(Math.round(header.getBoundingClientRect().bottom));
          setOpen((value) => !value);
        }}
        className="relative z-50 inline-flex min-h-[44px] items-center border border-cream/25 px-4 text-[13px] uppercase tracking-[0.06em] text-cream transition-colors hover:border-signal"
      >
        {open ? "Закрыть" : "Меню"}
      </button>

      {open && createPortal(
        <div ref={panelRef} id="mobile-menu" style={{ top }}
          className="fixed inset-x-0 bottom-0 z-40 overflow-y-auto border-t border-cream/10 bg-graphite px-[22px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-4">
          <nav aria-label="Основная навигация">
            {groups.map((group) => (
              <section key={group.id} aria-labelledby={"mobile-nav-" + group.id} className="mb-5">
                <h2 id={"mobile-nav-" + group.id} className="m-0 mb-2 text-[12px] font-medium uppercase tracking-[0.18em] text-signal">
                  {group.label}
                </h2>
                <ul className="m-0 flex list-none flex-col border-t border-cream/10 p-0">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} onClick={close} className={itemClass}>
                        {link.label} <span aria-hidden className="text-stone">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          <CtaLink href={contactHref} location="header" onClick={close}
            className="mt-6 flex min-h-[56px] items-center justify-center bg-signal text-[15px] font-medium uppercase tracking-[0.06em] text-white">
            Разбор задачи
          </CtaLink>
        </div>,
        document.body,
      )}
    </div>
  );
}
