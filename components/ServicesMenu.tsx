"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavLink } from "@/config/site";

/** «Услуги» disclosure for the desktop header: button + list of links, no menu-role semantics. */
export default function ServicesMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      // close once keyboard focus leaves the whole group
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="services-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center gap-2 text-[13.5px] uppercase tracking-[0.08em] text-stone transition-colors hover:text-cream aria-expanded:text-cream"
      >
        Услуги
        <span aria-hidden className={"text-[10px] transition-transform " + (open ? "rotate-180" : "")}>▼</span>
      </button>

      {open && (
        <ul
          id="services-menu"
          className="absolute left-[-18px] top-full m-0 mt-2 flex w-[300px] list-none flex-col border border-cream/15 bg-graphite p-2"
        >
          {links.map((l, i) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[48px] items-center gap-4 px-3 text-[14px] uppercase tracking-[0.04em] text-cream transition-colors hover:bg-cream/5 hover:text-signal"
              >
                <span aria-hidden className="font-display text-[13px] font-extrabold text-signal">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
