"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { HeaderNavGroup } from "@/config/routes";

/** Desktop audience disclosure. Each group uses a separate, accessible menu ID. */
export default function ServicesMenu({ group }: { group: HeaderNavGroup }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const menuId = "header-menu-" + group.id;

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-[44px] items-center gap-2 text-[13.5px] uppercase tracking-[0.08em] text-stone transition-colors hover:text-cream aria-expanded:text-cream"
      >
        {group.label}
        <span aria-hidden className={"text-[10px] transition-transform " + (open ? "rotate-180" : "")}>▼</span>
      </button>

      {open && (
        <ul id={menuId} className="absolute left-[-18px] top-full m-0 mt-2 flex max-h-[min(70vh,520px)] w-[320px] list-none flex-col overflow-y-auto border border-cream/15 bg-graphite p-2 shadow-lg">
          {group.links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={() => setOpen(false)}
                className="flex min-h-[48px] items-center px-3 text-[14px] uppercase tracking-[0.04em] text-cream transition-colors hover:bg-cream/5 hover:text-signal">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
