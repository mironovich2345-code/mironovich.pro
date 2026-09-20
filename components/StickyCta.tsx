"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

export default function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (window.innerWidth >= 700) return setShow(false);
      // step aside while the form itself is on screen — the bar would sit on top of it
      const form = document.getElementById("contact");
      const r = form?.getBoundingClientRect();
      const formOnScreen = r ? r.top < window.innerHeight * 0.85 && r.bottom > 0 : false;
      setShow(window.scrollY > 700 && !formOnScreen);
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
        "fixed inset-x-0 bottom-0 z-40 min-[700px]:hidden border-t border-neutral-900 bg-[rgba(22,24,38,0.9)] px-4 pt-2.5 backdrop-blur-md transition-all duration-300 " +
        (show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0")
      }
      style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
    >
      <a
        href="#contact"
        onClick={() => track("cta_click", { location: "sticky" })}
        className="flex min-h-[50px] items-center justify-center rounded-md border border-accent bg-accent-900 text-base font-medium text-accent-200"
      >
        Обсудить задачу
      </a>
    </div>
  );
}
