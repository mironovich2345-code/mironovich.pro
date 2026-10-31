/**
 * Inline script that runs before hydration and before any analytics:
 *
 * - keeps only utm_* (unless the value looks like an e-mail / phone), yclid,
 *   gclid and _ym_debug in the address bar and drops every other query
 *   parameter with history.replaceState — so a link like ?email=… never
 *   reaches Metrica, GA4 or the lead attribution;
 * - exposes window.__mrnvSafeUrl(), the page URL for analytics hits with a
 *   path that looks personal replaced by /redacted.
 *
 * The personal-data test mirrors looksPersonal() in lib/lead.ts.
 */
export const urlHygieneScript = `(function(){
function personal(v){v=String(v||"").trim();if(!v)return false;if(/@|%40|mailto:|tel:/i.test(v))return true;return /\\d{7,}/.test(v.replace(/[\\s()+\\-.]/g,""));}
window.__mrnvSafeUrl=function(){var p=location.pathname;try{p=decodeURIComponent(p)}catch(e){}return location.origin+(personal(p)?"/redacted":location.pathname)+location.search;};
try{
var u=new URL(location.href);if(!u.search)return;
var keep=/^(utm_(source|medium|campaign|content|term)|yclid|gclid|_ym_debug)$/,out=new URLSearchParams(),changed=false;
u.searchParams.forEach(function(v,k){if(keep.test(k)&&!personal(v)){out.append(k,v.slice(0,100));}else{changed=true;}});
if(!changed)return;
var q=out.toString();history.replaceState(history.state,"",u.pathname+(q?"?"+q:"")+u.hash);
}catch(e){}
})();`;
