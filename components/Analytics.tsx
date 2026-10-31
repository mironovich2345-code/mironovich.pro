"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConsentBanner from "./ConsentBanner";
import { gaId, metricaId, trackPageView } from "@/lib/analytics";
import { initAttribution } from "@/lib/attribution";
import { CONSENT_EVENT, analyticsAllowed, consentRequired, readConsent, type ConsentChoice } from "@/lib/consent";

/**
 * Captures first-touch attribution (used only inside a submitted lead) and loads
 * Yandex Metrica and/or GA4 when their ids are set and consent allows it.
 *
 * Metrica: `defer: true` turns off its automatic hit; the init script sends the
 * first page view itself and PageViewTracker sends one hit per later App Router
 * navigation. GA4: page views come from `config` and Enhanced Measurement only.
 * Advertising storage and signals stay off.
 */
export default function Analytics() {
  const [allowed, setAllowed] = useState(!consentRequired);

  useEffect(() => {
    initAttribution();
    if (!consentRequired) return;
    setAllowed(analyticsAllowed(readConsent()));
    const onChange = (e: Event) => setAllowed(analyticsAllowed((e as CustomEvent<ConsentChoice>).detail));
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

      {allowed && gaId && (
        <>
          <Script src={"https://www.googletagmanager.com/gtag/js?id=" + gaId} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
            gtag("consent","default",{analytics_storage:"granted",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"});
            gtag("js",new Date());
            gtag("config","${gaId}",{allow_google_signals:false,allow_ad_personalization_signals:false});`}
          </Script>
        </>
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
