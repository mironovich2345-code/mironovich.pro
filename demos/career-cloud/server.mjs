import http from "node:http";
import { readFile } from "node:fs/promises";
const port = Number(process.env.PORT || 3000);
const root = new URL("./",import.meta.url);
const types = new Map([
  ["/",["index.html","text/html; charset=utf-8"]],
  ["/app.js",["app.js","text/javascript; charset=utf-8"]],
  ["/style.css",["style.css","text/css; charset=utf-8"]],
  ["/data.json",["data.json","application/json; charset=utf-8"]],
]);
const security = {
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin": "null",
};
http.createServer(async (req,res)=>{
  const path = new URL(req.url || "/","http://localhost").pathname;
  if (path === "/health") {
    res.writeHead(200, { ...security,"Content-Type":"text/plain" });
    return res.end("ok");
  }
  const file = types.get(path);
  if (req.method !== "GET" || !file) {
    res.writeHead(404, { ...security, "Content-Type":"text/plain" });
    return res.end("Not found");
  }
  try {
    const body = await readFile(new URL(file[0],root));
    res.writeHead(200, { ...security,"Content-Type":file[1],"Content-Length":body.length });
    return res.end(body);
  } catch {
    res.writeHead(503, { ...security,"Content-Type":"text/plain" });
    return res.end("Demo asset unavailable");
  }
}).listen(port,"0.0.0.0",()=>console.log("Career demonstration listening on port "+port));
