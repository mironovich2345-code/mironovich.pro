"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CtaLink from "./CtaLink";
import { contactHref, type NavLink } from "@/config/routes";
import { aboutMenuLinks } from "@/config/site";
import { careerLoginHref } from "@/config/career-access";

const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * Full-screen menu below 860px: three audience choices and one CTA,
 * keeps Tab inside while open, locks page scroll and returns focus to the toggle.
 *
 * The panel is portalled into <body>: the sticky header uses backdrop-filter,
 * which would make it the containing block of a `position: fixed` child and
 * clip the panel to the header's height. Its top edge follows the header's
 * actual bottom.
 */
export default function MobileMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(65);
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
      // The panel is portalled after the page. Bridge both directions between
      // the toggle and its first link instead of following background DOM order.
      if (!e.shiftKey && document.activeElement === toggle) { e.preventDefault(); items[1]?.focus(); }
      else if (e.shiftKey && document.activeElement === items[1]) { e.preventDefault(); toggle?.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
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
        onClick={() => {
          const header = toggleRef.current?.closest("header");
          if (header) setTop(Math.round(header.getBoundingClientRect().bottom));
          setOpen((v) => !v);
        }}
        className="relative z-50 inline-flex min-h-[44px] items-center border border-cream/25 px-4 text-[13px] uppercase tracking-[0.06em] text-cream transition-colors hover:border-signal"
      >
        {open ? "Закрыть" : "Меню"}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          id="mobile-menu"
          style={{ top }}
          className="fixed inset-x-0 bottom-0 z-40 overflow-y-auto border-t border-cream/10 bg-graphite px-[22px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-4"
        >
          <nav aria-label="Основная навигация">
            <ul className="m-0 flex list-none flex-col border-t border-cream/10 p-0">
              {links.map((l) => (
                <li key={l.href}>
                  {l.href === "/about" ? (
                    <div>
                      <p className={itemClass + " m-0"}>Кто я</p>
                      <ul className="m-0 list-none border-b border-cream/10 py-2 pl-4">
                        {aboutMenuLinks.map((item) => (
                          <li key={item.href}>
                            <Link href={item.href} onClick={close} className="flex min-h-[46px] items-center text-[14px] text-cream/85 hover:text-signal">
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <Link href={l.href} onClick={close} className={itemClass}>
                      {l.label} <span aria-hidden className="text-stone">→</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <a href={careerLoginHref} onClick={close} className={itemClass + " mt-4 border-t border-cream/20"} aria-label="Войти в обучение AI Career 3.0">
            Войти <span aria-hidden className="text-stone">→</span>
          </a>
          <CtaLink
            href={contactHref}
            location="header"
            onClick={close}
            className="mt-8 flex min-h-[56px] items-center justify-center bg-signal px-5 text-center text-[15px] font-medium uppercase tracking-[0.04em] text-white"
          >
            Обсудить задачу
          </CtaLink>
        </div>,
        document.body,
      )}
    </div>
  );
}
