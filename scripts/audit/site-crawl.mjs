#!/usr/bin/env node
// Full-site visual and functional crawl for the UX audit (docs/audits/).
// Dev-only: needs a running local build and Playwright with Chromium (not a project dependency).
//
//   npm run build:local && npx next start -p 3100
//   node scripts/audit/site-crawl.mjs --base http://localhost:3100 --out /tmp/audit-before [--shots]
//
// For every route from sitemap.xml plus the routes not listed there, at 7 widths:
// HTTP status, console errors, failed requests, horizontal overflow, clipped text,
// text smaller than 12px, tap targets smaller than 24px, and broken internal links.
// Writes report.json and (with --shots) first-screen + full-page PNGs.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3100");
const OUT = arg("--out", "audit-out");
const SHOTS = process.argv.includes("--shots");
const ONLY = arg("--only", null);
export const WIDTHS = [320, 375, 390, 768, 1024, 1440, 1920];
// shown in screenshots: one phone and one desktop width for every page, all widths for key pages
const KEY = new Set(["/", "/services", "/solutions", "/products/ai-career", "/offer/ai-career", "/contact", "/tools/labor-cost", "/about"]);
const EXTRA = ["/privacy", "/consent", "/delivery", "/refund", "/requisites", "/offer/ai-career", "/career/sandbox", "/payment/result", "/this-page-does-not-exist"];

const { chromium } = createRequire(import.meta.url)("playwright");
mkdirSync(OUT, { recursive: true });

async function routes() {
  const xml = await (await fetch(BASE + "/sitemap.xml")).text();
  const list = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
  return [...new Set([...list, ...EXTRA])].filter(r => !ONLY || r.startsWith(ONLY));
}

const slug = r => (r === "/" ? "home" : r.slice(1).replace(/\//g, "__"));

async function inspect(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const issues = [];
    if (doc.scrollWidth > window.innerWidth + 1) issues.push({ kind: "h-overflow", detail: `${doc.scrollWidth}px > ${window.innerWidth}px` });
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0"; };
    for (const el of document.querySelectorAll("h1,h2,h3,p,a,button,li,td,label,span")) {
      if (!visible(el)) continue;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 1 && s.position !== "fixed") issues.push({ kind: "offscreen", detail: el.tagName + ": " + el.textContent.trim().slice(0, 50) });
      if (el.scrollWidth > el.clientWidth + 2 && s.overflow !== "visible" && s.textOverflow !== "ellipsis" && el.clientWidth > 0) issues.push({ kind: "clipped", detail: el.tagName + ": " + el.textContent.trim().slice(0, 50) });
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (own && parseFloat(s.fontSize) < 12) issues.push({ kind: "tiny-text", detail: `${s.fontSize} ${el.tagName}: ${el.textContent.trim().slice(0, 40)}` });
    }
    for (const el of document.querySelectorAll("a[href],button,input,select,textarea,summary")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      const inline = getComputedStyle(el).display === "inline" && el.closest("p,li");
      if (!inline && (r.height < 24 || r.width < 24)) issues.push({ kind: "small-target", detail: `${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName}: ${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40)}` });
    }
    const imgs = [...document.images].filter(i => !i.alt && i.getAttribute("role") !== "presentation" && i.getAttribute("aria-hidden") !== "true").map(i => i.src);
    if (imgs.length) issues.push({ kind: "img-no-alt", detail: imgs.slice(0, 3).join(", ") });
    const h1 = document.querySelectorAll("h1").length;
    if (h1 !== 1) issues.push({ kind: "h1-count", detail: String(h1) });
    const links = [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href"));
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content ?? "",
      canonical: document.querySelector('link[rel="canonical"]')?.href ?? "",
      robots: document.querySelector('meta[name="robots"]')?.content ?? "",
      ogImage: document.querySelector('meta[property="og:image"]')?.content ?? "",
      h1: document.querySelector("h1")?.textContent.trim() ?? "",
      height: doc.scrollHeight,
      links, issues,
    };
  });
}

async function main() {
  const browser = await chromium.launch();
  const list = await routes();
  const report = { base: BASE, date: new Date().toISOString(), widths: WIDTHS, pages: {} };
  const internal = new Set();
  for (const route of list) {
    const entry = report.pages[route] = { widths: {} };
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 800 : 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [], failed = [], external = new Set();
      page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
      page.on("pageerror", e => errors.push("pageerror: " + e.message.slice(0, 200)));
      page.on("requestfailed", r => failed.push(r.url() + " " + (r.failure()?.errorText ?? "")));
      page.on("request", r => { const u = new URL(r.url()); if (!u.host.startsWith("localhost")) external.add(u.host); });
      const res = await page.goto(BASE + route, { waitUntil: "networkidle" }).catch(e => ({ status: () => "ERR " + e.message }));
      await page.waitForTimeout(300);
      const info = await inspect(page);
      entry.status = res.status();
      entry.title = info.title; entry.description = info.description; entry.canonical = info.canonical;
      entry.robots = info.robots; entry.ogImage = info.ogImage; entry.h1 = info.h1;
      entry.widths[width] = { issues: info.issues, errors, failed, external: [...external], height: info.height };
      for (const l of info.links) if (l && l.startsWith("/") && !l.startsWith("//")) internal.add(l.split("#")[0].split("?")[0]);
      if (SHOTS && (KEY.has(route) || width === 390 || width === 1440)) {
        const dir = join(OUT, "shots", slug(route));
        mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: join(dir, `${width}-first.png`) });
        if (KEY.has(route) ? [390, 1440].includes(width) : true) await page.screenshot({ path: join(dir, `${width}-full.png`), fullPage: true });
      }
      await ctx.close();
    }
    const n = Object.values(entry.widths).reduce((a, w) => a + w.issues.length + w.errors.length + w.failed.length, 0);
    console.log(`${entry.status} ${route} — ${n} findings`);
  }
  // broken internal links (every href found on any page)
  report.links = {};
  for (const href of [...internal].sort()) {
    const r = await fetch(BASE + href, { redirect: "manual" }).catch(() => ({ status: "ERR" }));
    report.links[href] = r.status;
  }
  const broken = Object.entries(report.links).filter(([, s]) => !(s >= 200 && s < 400));
  console.log("internal links:", Object.keys(report.links).length, "broken:", broken.length, broken.slice(0, 10));
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch(e => { console.error(e); process.exitCode = 1; });
