"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Keep the designed size when it fits; shrink only if font metrics overflow. */
export default function FitDisplay({ as: Tag, children, className, hidden = false }: {
  as: "h1" | "p"; children: ReactNode; className: string; hidden?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement & HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let width = -1;
    const fit = () => {
      element.style.setProperty("--display-fit", "1");
      const left = element.getBoundingClientRect().left;
      let right = left;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        for (const rect of range.getClientRects()) right = Math.max(right, rect.right);
      }
      const available = element.clientWidth;
      if (right - left > available) {
        element.style.setProperty("--display-fit", String((available - 1) / (right - left)));
      }
    };
    const observer = new ResizeObserver(() => {
      if (width === element.clientWidth) return;
      width = element.clientWidth;
      fit();
    });
    observer.observe(element);
    document.fonts.addEventListener("loadingdone", fit);
    window.addEventListener("resize", fit);
    fit();
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
      window.removeEventListener("resize", fit);
    };
  }, []);

  return <Tag ref={ref} aria-hidden={hidden || undefined} className={className}>{children}</Tag>;
}
