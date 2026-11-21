#!/usr/bin/env node
// Builds the AI Career v3 safety module PDFs from the Markdown sources in
// content/career/v3/materials/safety. Dev-only tool: needs a local Chromium via Playwright
// (not a project dependency). TOC page numbers are read from the PDF with pdf-lib.
// No network, no production services, no personal data.
//
//   node scripts/career/build-safety-materials.mjs          # build everything
//   node scripts/career/build-safety-materials.mjs --test-md # only regenerate 06-test.md
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PDFDocument, PDFName, PDFDict, PDFArray } from "pdf-lib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MAT = join(ROOT, "content/career/v3/materials/safety");
const OUT = join(MAT, "pdf");
const FONTS = join(ROOT, "assets/blog-covers/fonts");
const LESSONS = ["SAF-01", "SAF-02", "SAF-03", "SAF-04"].map(id =>
  JSON.parse(readFileSync(join(ROOT, "content/career/v3/lessons", id + ".json"), "utf8")));

// ------------------------------------------------------------------ markdown subset
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function inline(src) {
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
  s = esc(s)
    // typography: never break inside "201 600 ₽", "10 %", "№ 5" or before a dash
    .replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00a0").replace(/(\d) (?=[₽%])/g, "$1\u00a0").replace(/ (?=— )/g, "\u00a0");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    if (!/^(https:\/\/|#)/.test(u)) throw new Error("Only https:// or #anchor links are allowed: " + u);
    return `<a href="${u}">${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}

export function parseFrontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error("front matter missing");
  const meta = Object.fromEntries(m[1].split("\n").map(l => { const i = l.indexOf(":"); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  return { meta, body: md.slice(m[0].length) };
}

const CALLOUT = { note: "Обратите внимание", warn: "Важно", key: "Что сделать", example: "Пример", legal: "Юридическая оговорка — проверить с юристом" };

export function renderMarkdown(body, ctx = { headings: [], prefix: "s" }) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;
  const isBlockStart = l => /^(#{2,4} |```|\||>|- |\d+\. |<!--)/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.trim() === "<!-- pagebreak -->") { html.push('<div class="pagebreak"></div>'); i++; continue; }
    let m;
    if ((m = line.match(/^(#{2,4}) (.+)$/))) {
      const level = m[1].length, text = m[2].trim();
      const id = `${ctx.prefix}-${ctx.headings.length + 1}`;
      ctx.headings.push({ level, text, id });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++; continue;
    }
    if (line.startsWith("```")) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      if (i >= lines.length) throw new Error("unterminated code block");
      i++;
      html.push(`<pre class="prompt">${esc(buf.join("\n"))}</pre>`);
      continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const cells = r => r.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map(c => c.trim());
      const head = cells(rows[0]);
      if (!rows[1] || !/^\|[\s:|-]+\|$/.test(rows[1].trim())) throw new Error("table separator missing near: " + rows[0]);
      const body = rows.slice(2).map(cells);
      body.forEach(r => { if (r.length !== head.length) throw new Error("table row width mismatch: " + r.join(" | ")); });
      const cls = `cols-${head.length}`;
      html.push(`<table class="${cls}"><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>` +
        body.map(r => `<tr>${r.map((c, k) => `<td data-label="${esc(head[k].replace(/\*\*/g, ""))}">${inline(c)}</td>`).join("")}</tr>`).join("") +
        `</tbody></table>`);
      continue;
    }
    if (line.startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^> ?/, ""));
      let kind = null, title = null;
      const cm = buf[0].match(/^\[!(\w+)\]\s*(.*)$/);
      if (cm) { kind = cm[1]; title = cm[2] || CALLOUT[kind]; buf.shift(); if (!CALLOUT[kind]) throw new Error("unknown callout " + kind); }
      const paras = buf.join("\n").split(/\n\s*\n/).filter(p => p.trim());
      const inner = paras.map(p => `<p>${p.split("\n").map(inline).join("<br>")}</p>`).join("");
      html.push(kind
        ? `<aside class="callout callout-${kind}"><div class="callout-title">${inline(title)}</div>${inner}</aside>`
        : `<blockquote>${inner}</blockquote>`);
      continue;
    }
    if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items = [];
      while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]) : /^- /.test(lines[i]))) {
        let item = lines[i++].replace(/^(- |\d+\. )/, "");
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) item += " " + lines[i++].trim();
        items.push(item);
      }
      const check = !ordered && items.every(t => t.startsWith("[ ] "));
      const lis = items.map(t => check ? `<li class="check"><span class="box" aria-hidden="true"></span>${inline(t.slice(4))}</li>` : `<li>${inline(t)}</li>`);
      html.push(ordered ? `<ol>${lis.join("")}</ol>` : `<ul${check ? ' class="checklist"' : ""}>${lis.join("")}</ul>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
    if (!buf.length) throw new Error("unparsed line: " + line);
    html.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return html.join("\n");
}

// ------------------------------------------------------------------ generated test file
export function buildTestMarkdown(lessons) {
  const qs = lessons.flatMap(l => l.content.quiz.map(q => ({ ...q, lesson: l })));
  const letter = id => ({ a: "А", b: "Б", c: "В", d: "Г" })[id] ?? id.toUpperCase();
  const out = [
    "---", "id: SAF-TOOL-TEST", "title: Контрольный тест по безопасности ИИ",
    "subtitle: " + qs.length + " ситуационных вопросов с ответами и объяснениями",
    "version: 1.0.0-review", "date: 18.11.2026",
    "audience: Менеджеры по продажам после изучения пособия. Время: 15–20 минут.",
    "status: Черновик на проверке. Файл сгенерирован из content/career/v3/lessons/SAF-0*.json — не редактируйте вручную.",
    "---", "",
    "## Контрольный тест", "",
    `Выберите один ответ в каждом вопросе. Вопросы сгруппированы по урокам модуля. Ответы и объяснения — в конце теста. Зачёт — не меньше ${Math.ceil(qs.length * 0.8)} правильных ответов из ${qs.length}; вопросы с ошибками перечитайте в указанном уроке.`, "",
  ];
  let n = 0;
  for (const l of lessons) {
    out.push(`### ${l.id}. ${l.title}`, "");
    for (const q of l.content.quiz) {
      n++;
      out.push(`**Вопрос ${n}.** ${q.question}`, "");
      for (const o of q.options) out.push(`- [ ] ${letter(o.id)}) ${o.text}`);
      out.push("");
    }
  }
  out.push("<!-- pagebreak -->", "", "## Ответы и объяснения", "");
  out.push("| № | Ответ | Почему | Урок |", "| --- | --- | --- | --- |");
  qs.forEach((q, k) => {
    const right = q.options.find(o => o.id === q.correctId);
    out.push(`| ${k + 1} | ${letter(q.correctId)}) ${right.text} | ${q.reason} | \`${q.lesson.id}\` |`);
  });
  out.push("");
  return out.join("\n");
}

// ------------------------------------------------------------------ html shell
function fontFace(family, file, range, weight = "100 900") {
  return `@font-face{font-family:"${family}";src:url("${pathToFileURL(join(FONTS, file)).href}") format("woff2");font-weight:${weight};unicode-range:${range};}`;
}
const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2193,U+20BD,U+2212,U+2215,U+FEFF,U+FFFD";
const CYR = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";

function css(format) {
  const mobile = format === "mobile";
  const page = mobile ? "size:110mm 196mm;margin:11mm 8mm 13mm 8mm;" : "size:A4;margin:18mm 18mm 20mm 18mm;";
  return `
${fontFace("Inter", "Inter-latin.woff2", LATIN)}${fontFace("Inter", "Inter-cyrillic.woff2", CYR)}
${fontFace("Roboto Condensed", "RobotoCondensed-latin.woff2", LATIN)}${fontFace("Roboto Condensed", "RobotoCondensed-cyrillic.woff2", CYR)}
@page{${page}background:#F2EFE8;}
:root{--cream:#F2EFE8;--ink:#0E0E11;--red:#D92D2D;--red-text:#C42828;--red-text-panel:#B02020;--muted:#55555c;--line:#d6d1c4;--panel:#e8e3d7;}
html{background:var(--cream);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{margin:0;color:var(--ink);font-family:"Inter","DejaVu Sans",sans-serif;font-size:${mobile ? "12pt" : "11pt"};line-height:${mobile ? "1.45" : "1.5"};
  hyphens:auto;-webkit-hyphens:auto;overflow-wrap:break-word;font-feature-settings:"kern","liga";}
a{color:var(--red-text);text-decoration:underline;text-underline-offset:2px;}
h1,h2,h3,h4{font-family:"Roboto Condensed","Inter",sans-serif;line-height:1.15;hyphens:none;-webkit-hyphens:none;break-after:avoid;page-break-after:avoid;}
h2{font-size:${mobile ? "18pt" : "20pt"};font-weight:700;margin:0 0 10pt;padding-top:4pt;border-top:3pt solid var(--red);padding-top:8pt;margin-top:18pt;}
h3{font-size:${mobile ? "14.5pt" : "14pt"};font-weight:700;margin:16pt 0 6pt;}
h4{font-size:12pt;margin:12pt 0 4pt;}
p{margin:0 0 7pt;orphans:3;widows:3;}
ul,ol{margin:0 0 8pt;padding-left:${mobile ? "15pt" : "18pt"};}
li{margin:0 0 3pt;}
ol li::marker{font-weight:700;color:var(--red-text);}
strong{font-weight:700;}
code{white-space:nowrap;font-family:"DejaVu Sans Mono",monospace;font-size:.9em;background:var(--panel);padding:0 2pt;border-radius:2pt;}
table{width:100%;border-collapse:collapse;margin:6pt 0 10pt;font-size:${mobile ? "11pt" : "9.5pt"};line-height:1.38;table-layout:auto;}
th{background:var(--ink);color:var(--cream);text-align:left;font-weight:600;padding:4pt 5pt;vertical-align:bottom;}
td{border-bottom:.6pt solid var(--line);padding:4pt 5pt;vertical-align:top;}
/* row labels are short words: do not split them with hyphens */
td:first-child,th{hyphens:none;-webkit-hyphens:none;}
tr{break-inside:avoid;page-break-inside:avoid;}
thead{display:table-header-group;}
.prompt{white-space:pre-wrap;font-family:"Inter",sans-serif;font-size:${mobile ? "11pt" : "10pt"};line-height:1.45;background:#fbfaf6;border:1pt solid var(--line);
  border-left:3pt solid var(--ink);padding:7pt 9pt;margin:4pt 0 9pt;break-inside:avoid;hyphens:none;}
.callout{border-left:3pt solid var(--red);background:var(--panel);padding:7pt 10pt;margin:8pt 0 10pt;break-inside:avoid;}
.callout p:last-child{margin-bottom:0;}
.callout-title{font-family:"Roboto Condensed","Inter",sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:${mobile ? "10pt" : "9pt"};color:var(--red-text-panel);margin-bottom:3pt;}
.callout a{color:var(--red-text-panel);}
.callout-example{border-left-color:var(--ink);background:#fbfaf6;border:1pt solid var(--line);border-left:3pt solid var(--ink);}
.callout-example .callout-title{color:var(--ink);}
.callout-legal{background:#fbfaf6;border:1pt dashed var(--muted);border-left:3pt solid var(--ink);}
.callout-legal .callout-title{color:var(--ink);}
.callout-legal .callout-title::before{content:"§ ";color:var(--red-text);}
/* one- or two-page memo: compact header instead of a cover */
.memo-head{border-bottom:1pt solid var(--ink);padding-bottom:6pt;margin-bottom:8pt;}
.memo-head h1{font-family:"Roboto Condensed","Inter",sans-serif;font-size:${mobile ? "21pt" : "24pt"};margin:6pt 0 3pt;}
.memo-head .bar{width:30mm;height:3pt;background:var(--red);margin-top:6pt;}
.memo-head p{color:var(--muted);margin:0;font-size:.92em;}
.memo h2:first-of-type{display:none;}
.memo ol>li{margin-bottom:${mobile ? "6pt" : "5pt"};}
.memo .status-line{font-size:8.5pt;color:var(--muted);margin-top:4pt;}
.checklist{list-style:none;padding-left:0;}
.checklist li{position:relative;padding-left:17pt;margin-bottom:4pt;break-inside:avoid;}
.checklist .box{position:absolute;left:0;top:2.5pt;width:9pt;height:9pt;border:1.1pt solid var(--ink);border-radius:1.5pt;background:#fff;}
.pagebreak{break-after:page;}
.pagebreak + h2{margin-top:0;}
/* cover */
.cover{height:${mobile ? "168mm" : "255mm"};display:flex;flex-direction:column;justify-content:space-between;break-after:page;}
.brand{font-family:"Roboto Condensed",sans-serif;font-weight:700;letter-spacing:.12em;font-size:10pt;}
.brand span{color:var(--red-text);}
.cover .bar{width:42mm;height:4pt;background:var(--red);margin:0 0 12pt;}
.cover h1{font-size:${mobile ? "26pt" : "38pt"};margin:0 0 10pt;font-weight:700;}
.cover .subtitle{font-size:${mobile ? "13pt" : "16pt"};color:var(--muted);margin:0 0 20pt;}
.meta{width:100%;font-size:9.5pt;border-top:1pt solid var(--ink);}
.meta td{border-bottom:.6pt solid var(--line);padding:4pt 0;}
.meta td:first-child{width:30%;color:var(--muted);padding-right:8pt;}
.status{display:inline-block;border:1pt solid var(--red);color:var(--red-text);font-weight:700;font-size:9pt;padding:2pt 6pt;margin-top:12pt;}
/* toc */
.toc{break-after:page;}
.toc h2{margin-top:0;}
.toc ol{list-style:none;padding:0;margin:0;}
.toc li{display:flex;align-items:baseline;gap:6pt;border-bottom:.6pt dotted var(--line);padding:4pt 0;margin:0;}
.toc li.l3{padding-left:14pt;font-size:.93em;}
.toc li a{color:var(--ink);text-decoration:none;flex:1;hyphens:none;-webkit-hyphens:none;}
.toc li .pg{font-variant-numeric:tabular-nums;color:var(--muted);min-width:16pt;text-align:right;}
.toc-intro{color:var(--muted);font-size:.95em;}
${mobile ? `
/* phone layout: tables become stacked cards so nothing scrolls sideways */
table,thead,tbody,tr,td{display:block;width:auto;}
thead{display:none;}
tr{border:1pt solid var(--line);background:#fbfaf6;margin:0 0 6pt;padding:3pt 6pt;}
td{border:0;padding:2pt 0;}
td::before{content:attr(data-label);display:block;font-weight:700;font-size:8.5pt;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;}
.meta tr{border:0;background:none;padding:0;margin:0;}
.meta td::before{content:none;}
` : ""}
`;
}

function coverHtml(meta, format) {
  return `<section class="cover">
<div><div class="brand">MIRONOVICH<span>.</span>PRO · AI CAREER</div></div>
<div><div class="bar"></div><h1>${inline(meta.title)}</h1><p class="subtitle">${inline(meta.subtitle)}</p>
<table class="meta"><tbody>
<tr><td>Модуль</td><td>1. Безопасность работы с ИИ</td></tr>
<tr><td>Для кого</td><td>${inline(meta.audience)}</td></tr>
<tr><td>Версия и дата</td><td>${esc(meta.version)} · ${esc(meta.date)}</td></tr>
<tr><td>Формат</td><td>${format === "mobile" ? "Версия для чтения с телефона" : "A4, для печати и чтения с компьютера"}</td></tr>
</tbody></table>
<div class="status">${inline(meta.status)}</div></div>
<div class="toc-intro">Все компании, люди, цены и события в примерах вымышлены. Материал не является юридической консультацией.</div>
</section>`;
}

function memoHeadHtml(meta) {
  return `<header class="memo-head"><div class="brand">MIRONOVICH<span>.</span>PRO · AI CAREER</div><div class="bar"></div>
<h1>${inline(meta.title)}</h1><p>${inline(meta.subtitle)}</p>
<p class="status-line">Версия ${esc(meta.version)} · ${esc(meta.date)} · ${inline(meta.status)}</p></header>`;
}

function tocHtml(headings, pages) {
  const items = headings.filter(h => h.level === 2 || h.level === 3 && h.toc)
    .map(h => `<li class="l${h.level}"><a href="#${h.id}">${inline(h.text)}</a><span class="pg">${pages?.[h.id] ?? "…"}</span></li>`);
  return `<section class="toc"><h2 id="toc">Содержание</h2><ol>${items.join("")}</ol></section>`;
}

export function documentHtml(parts, format, pages) {
  // parts: [{meta, body}] — first part supplies the cover
  const headings = [];
  const bodies = parts.map((p, k) => renderMarkdown(p.body, { headings, prefix: "s" + k }));
  headings.forEach(h => { h.toc = h.level === 3 && /^Кейс \d/.test(h.text); });
  const memo = parts[0].meta.layout === "memo";
  const toc = !memo && headings.filter(h => h.level === 2).length > 3 ? tocHtml(headings, pages) : "";
  const head = memo ? memoHeadHtml(parts[0].meta) : coverHtml(parts[0].meta, format);
  return { headings, html: `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(parts[0].meta.title)}</title>
<style>${css(format)}</style></head><body${memo ? ' class="memo"' : ""}>${head}${toc}${bodies.join("\n")}</body></html>` };
}

// ------------------------------------------------------------------ pdf
// TOC page numbers come from the PDF's own named destinations: Chromium writes one for every
// in-document link target (the TOC links to each heading id). No text extraction involved.
export async function headingPages(pdf, headings) {
  const doc = await PDFDocument.load(readFileSync(pdf), { updateMetadata: false });
  const dests = doc.catalog.lookupMaybe(PDFName.of("Dests"), PDFDict);
  if (!dests) throw new Error("no named destinations in " + pdf);
  const pageIndex = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i + 1]));
  const out = {};
  for (const h of headings.filter(x => x.level === 2 || x.toc)) {
    const dest = dests.lookupMaybe(PDFName.of(h.id), PDFArray);
    const page = dest && pageIndex.get(dest.get(0).toString());
    if (!page) throw new Error("no destination for heading: " + h.text);
    out[h.id] = page;
  }
  return out;
}

async function renderPdf(browser, html, outPdf, footerTitle) {
  const dir = mkdtempSync(join(tmpdir(), "saf-pdf-"));
  try {
    const file = join(dir, "doc.html");
    writeFileSync(file, html);
    const page = await browser.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // QA: nothing may overflow its box horizontally (cut-off text in the PDF)
    const overflow = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll("p,li,td,th,pre,h1,h2,h3,h4,table,aside,.toc li")) {
        if (el.scrollWidth > el.clientWidth + 1) bad.push(el.tagName + ": " + el.textContent.slice(0, 60));
      }
      const body = document.body;
      if (body.scrollWidth > body.clientWidth + 1) bad.push("BODY wider than page");
      return bad;
    });
    if (overflow.length) throw new Error("Horizontal overflow in " + outPdf + ":\n  " + overflow.join("\n  "));
    const missing = await page.evaluate(() => [...document.fonts].filter(f => f.status === "error").map(f => f.family));
    if (missing.length) throw new Error("fonts failed to load: " + missing.join(", "));
    await page.pdf({
      path: outPdf, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true, tagged: true, outline: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-family:Inter,'DejaVu Sans',sans-serif;font-size:7.5pt;color:#55555c;padding:0 12mm;display:flex;justify-content:space-between;"><span>MIRONOVICH.PRO · ${esc(footerTitle)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    await page.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function buildDocument(browser, { parts, format, out, footer }) {
  const first = documentHtml(parts, format);
  await renderPdf(browser, first.html, out, footer);
  if (first.html.includes('class="toc"')) {
    const pages = await headingPages(out, first.headings);
    const second = documentHtml(parts, format, pages);
    await renderPdf(browser, second.html, out, footer);
    const check = await headingPages(out, second.headings);
    for (const id of Object.keys(pages)) if (check[id] !== pages[id]) throw new Error("TOC page drift for " + id);
  }
  return out;
}

const read = f => parseFrontMatter(readFileSync(join(MAT, f), "utf8"));

async function main() {
  const outArg = process.argv.indexOf("--out");
  const out = outArg > 0 ? process.argv[outArg + 1] : OUT;
  if (outArg > 0 && !out) throw new Error("--out needs a directory");
  // a check build into another directory must not touch the committed sources
  if (outArg < 0) writeFileSync(join(MAT, "06-test.md"), buildTestMarkdown(LESSONS));
  if (process.argv.includes("--test-md")) { console.log("wrote 06-test.md"); return; }

  let playwright;
  try { playwright = createRequire(import.meta.url)("playwright"); }
  catch { throw new Error("Playwright with Chromium is required to build PDFs (dev-only; not a project dependency)."); }
  if (!existsSync(FONTS)) throw new Error("font directory missing: " + FONTS);
  mkdirSync(out, { recursive: true });

  const guide = read("guide.md");
  const memo = read("07-rules-memo.md");
  const tools = ["01-checklist.md", "02-data-matrix.md", "03-prompts.md", "04-manager-request.md", "05-practicum.md", "06-test.md"].map(read);
  const workbookMeta = { ...tools[0].meta, id: "SAF-WORKBOOK", title: "Рабочая тетрадь по безопасности ИИ",
    subtitle: "Памятка, чек-лист, матрица данных, промпты, обращение к руководителю, практикум и контрольный тест", layout: "",
    audience: "Менеджеры по продажам. Используется вместе с пособием «Безопасность использования ИИ на работе»." };

  const jobs = [
    { parts: [guide], format: "a4", out: join(out, "safety-guide-a4.pdf"), footer: "Безопасность использования ИИ на работе" },
    { parts: [guide], format: "mobile", out: join(out, "safety-guide-mobile.pdf"), footer: "Безопасность ИИ" },
    { parts: [{ meta: workbookMeta, body: [memo, ...tools].map(t => t.body).join("\n<!-- pagebreak -->\n") }], format: "a4", out: join(out, "safety-workbook-a4.pdf"), footer: "Рабочая тетрадь по безопасности ИИ" },
    ...[["safety-checklist-a4.pdf", 0], ["safety-data-matrix-a4.pdf", 1], ["safety-prompts-a4.pdf", 2], ["safety-manager-request-a4.pdf", 3], ["safety-practicum-a4.pdf", 4], ["safety-test-a4.pdf", 5]]
      .map(([file, k]) => ({ parts: [tools[k]], format: "a4", out: join(out, file), footer: tools[k].meta.title })),
    { parts: [memo], format: "a4", out: join(out, "safety-rules-memo-a4.pdf"), footer: memo.meta.title },
    { parts: [memo], format: "mobile", out: join(out, "safety-rules-memo-mobile.pdf"), footer: "10 правил безопасной работы с ИИ" },
  ];
  // Glyph advances must not depend on the host's fontconfig hinting, otherwise line breaks and
  // page counts differ between machines (seen on the GitHub runner: 76 vs 77 phone pages).
  const browser = await playwright.chromium.launch({ args: ["--font-render-hinting=none"] });
  try {
    for (const job of jobs) { await buildDocument(browser, job); console.log("built", job.out.replace(ROOT + "/", "")); }
  } finally { await browser.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => { console.error(e.message); process.exitCode = 1; });
}
