"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track, type CtaLocation } from "@/lib/analytics";

/**
 * A link that reports which CTA was used. On-page anchors ("#contact") stay a
 * plain <a>; paths on other pages ("/#contact") use next/link so navigating from
 * /about or an article to the form is a client-side transition. The only
 * addition either way is the cta_click event.
 */
export default function CtaLink({
  href,
  location,
  className,
  onClick,
  children,
}: {
  href: string;
  location: CtaLocation;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const handleClick = () => {
    track("cta_click", { location });
    onClick?.();
  };

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className} onClick={handleClick}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
