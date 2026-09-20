"use client";

import type { ReactNode } from "react";
import { track, type CtaLocation } from "@/lib/analytics";

/**
 * An anchor that reports which CTA was used. Plain <a> semantics and styling —
 * the only addition is the cta_click event.
 */
export default function CtaLink({
  href,
  location,
  className,
  children,
}: {
  href: string;
  location: CtaLocation;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className={className} onClick={() => track("cta_click", { location })}>
      {children}
    </a>
  );
}
