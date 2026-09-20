"use client";

import Script from "next/script";
import { useEffect } from "react";
import { gaId, metricaId } from "@/lib/analytics";
import { initAttribution } from "@/lib/attribution";

/**
 * Captures first-touch attribution and loads whichever analytics provider is
 * configured. With no ids in env nothing is loaded and nothing is requested —
 * the site behaves exactly as before, which is also why no cookie banner is
 * shipped yet. When a consent prompt is added later, it only has to gate the
 * two <Script> tags below.
 */
export default function Analytics() {
  useEffect(() => {
    initAttribution();
  }, []);

  return (
    <>
      {metricaId && (
        <Script id="ym-init" strategy="afterInteractive">
          {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
          (window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
          ym(${Number(metricaId)},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});`}
        </Script>
      )}

      {gaId && (
        <>
          <Script src={"https://www.googletagmanager.com/gtag/js?id=" + gaId} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
            gtag("js",new Date());gtag("config","${gaId}");`}
          </Script>
        </>
      )}
    </>
  );
}
