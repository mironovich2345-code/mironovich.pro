"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConsentBanner from "./ConsentBanner";
import { metricaId, trackPageView } from "@/lib/analytics";
import { initAttribution } from "@/lib/attribution";
import { CONSENT_EVENT, analyticsAllowed, clearLegacyGaCookies, consentRequired, purgeOptionalTracking, readConsent } from "@/lib/consent";

/**
 * Captures attribution ONLY after explicit opt-in and loads Yandex Metrica
 * ONLY when its ID is configured AND the visitor explicitly pressed «Согласен».
 *
 * `defer: true` turns off Metrica's automatic hit; the init script sends the
 * first page view itself and PageViewTracker one hit per later App Router
 * navigation. No other analytics provider exists (GA4 removed 2026-11-01).
 */
function PublicAnalytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // No non-essential tracking/attribution storage until affirmative consent.
    clearLegacyGaCookies();
    const initial = analyticsAllowed(readConsent());
    if (initial) initAttribution();
    else purgeOptionalTracking(); // clear optional state left by older versions
    setAllowed(initial);
    const onChange = () => {
      // Fail closed if browser storage rejects the choice; never trust an event payload.
      const next = analyticsAllowed(readConsent());
      if (next) initAttribution();
      else purgeOptionalTracking();
      setAllowed(next);
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  return (
    <>
      {allowed && metricaId && (
        <Script id="ym-init" strategy="afterInteractive">
          {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
          (window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
          (function(){var id=${Number(metricaId)},r="";
          try{var ru=new URL(document.referrer);r=ru.origin+ru.pathname}catch(e){}
          ym(id,"init",{defer:true,clickmap:true,trackLinks:true,accurateTrackBounce:true});
          ym(id,"hit",(window.__mrnvSafeUrl||function(){return location.href})(),{title:document.title,referer:r});})();`}
        </Script>
      )}


      {allowed && metricaId && <PageViewTracker />}
      {consentRequired && <ConsentBanner />}
    </>
  );
}

/** One Metrica hit per client-side navigation; the first view is sent by the init script. */
function PageViewTracker() {
  const pathname = usePathname();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (prev.current === null) {
      prev.current = pathname;
      return;
    }
    if (prev.current === pathname) return;
    trackPageView(pathname, window.location.origin + prev.current);
    prev.current = pathname;
  }, [pathname]);

  return null;
}


/** Never track private synthetic sign-in, diagnostic or payment return pages. */
export default function Analytics() {
  const pathname = usePathname();
  if (pathname === "/career/sandbox" || pathname === "/payment/result") return null;
  return <PublicAnalytics />;
}
