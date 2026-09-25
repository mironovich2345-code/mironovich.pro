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
        className="inline-flex min-h-[40px] items-center rounded-md border border-neutral-800 px-3.5 text-sm text-neutral-300 transition-colors hover:border-accent-700 hover:text-ink"
      >
        {open ? "Закрыть" : "Меню"}
      </button>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Основная навигация"
          className="absolute inset-x-0 top-full border-y border-neutral-900 bg-bg px-[22px] pb-5 pt-2"
        >
          <ul className="m-0 flex list-none flex-col p-0">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={close}
                  className="flex min-h-[48px] items-center border-b border-neutral-900 text-base text-neutral-300 hover:text-ink"
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
            className="mt-4 flex min-h-[50px] items-center justify-center rounded-md border border-accent bg-accent-900 text-base font-medium text-accent-200"
          >
            Обсудить задачу
          </CtaLink>
        </nav>
      )}
    </div>
  );
}
