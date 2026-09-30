"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

export default function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (window.innerWidth >= 700) return setShow(false);

      // appear once the visitor has scrolled past Hero, not at a fixed pixel guess
      const hero = document.getElementById("hero");
      const heroRect = hero?.getBoundingClientRect();
      const pastHero = heroRect ? heroRect.bottom <= 0 : window.scrollY > 700;

      // step aside while the form itself is on screen — the bar would sit on top of it
      const form = document.getElementById("contact");
      const r = form?.getBoundingClientRect();
      const formOnScreen = r ? r.top < window.innerHeight * 0.85 && r.bottom > 0 : false;

      setShow(pastHero && !formOnScreen);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className={
        "fixed inset-x-0 bottom-0 z-40 min-[700px]:hidden border-t border-cream/15 bg-graphite/95 px-4 pt-1.5 backdrop-blur-md transition-all duration-300 " +
        (show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0")
      }
      style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom))" }}
    >
      <a
        href="#contact"
        onClick={() => track("cta_click", { location: "sticky" })}
        className="flex min-h-[44px] items-center justify-center gap-2 bg-signal text-[14px] font-medium uppercase tracking-[0.04em] text-white"
      >
        Разобрать обучение <span aria-hidden>→</span>
      </a>
    </div>
  );
}
