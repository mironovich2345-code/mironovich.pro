#!/usr/bin/env node
// Renders public/products/ai-career-v3.png — the AI Career cover — from HTML with the site's own
// fonts. Replaces ai-career-v2.png, whose baked-in text said «план развития на 30 дней» while the
// program is 30 steps (not calendar days). Dev-only: Playwright with Chromium.
//   node scripts/audit/render-product-cover.mjs
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const font = f => pathToFileURL(join(ROOT, "assets/blog-covers/fonts", f)).href;
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
@font-face{font-family:RC;src:url("${font("RobotoCondensed-cyrillic.woff2")}");font-weight:100 900;unicode-range:U+0400-04FF}
@font-face{font-family:RC;src:url("${font("RobotoCondensed-latin.woff2")}");font-weight:100 900;unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:IN;src:url("${font("Inter-cyrillic.woff2")}");font-weight:100 900;unicode-range:U+0400-04FF}
@font-face{font-family:IN;src:url("${font("Inter-latin.woff2")}");font-weight:100 900;unicode-range:U+0000-00FF,U+2000-206F}
html,body{margin:0;width:1536px;height:1024px;background:#141418}
.c{position:relative;box-sizing:border-box;width:1536px;height:1024px;padding:140px 112px 0}
.bar{width:160px;height:12px;background:#D92D2D}
.k{margin-top:62px;font:600 34px/1 IN;letter-spacing:.16em;color:#C0B9B2;text-transform:uppercase}
h1{margin:44px 0 0;font:800 128px/1.02 RC;letter-spacing:-.01em;color:#F2EFE8;text-transform:uppercase}
.s{margin-top:52px;font:600 36px/1.2 IN;letter-spacing:.12em;color:#C0B9B2;text-transform:uppercase}
.f{position:absolute;left:112px;right:112px;bottom:96px;display:flex;justify-content:space-between;align-items:flex-end}
.b{font:500 34px/1 IN;letter-spacing:.06em;color:#C0B9B2}
.n{font:400 104px/1 RC;color:#D92D2D}
</style></head><body><div class="c"><div class="bar"></div><div class="k">Для сотрудников</div>
<h1>Как стать ценнее<br>для компании<br>с помощью ИИ</h1><div class="s">Диагностика · уроки · план из 30 шагов</div>
<div class="f"><div class="b">MIRONOVICH · ГОТОВИТСЯ К ЗАПУСКУ</div><div class="n">01</div></div></div></body></html>`;
const { chromium } = createRequire(import.meta.url)("playwright");
const b = await chromium.launch({ args: ["--font-render-hinting=none"] });
const p = await b.newPage({ viewport: { width: 1536, height: 1024 } });
// a file:// page may load the local font files; about:blank (setContent) may not
const dir = mkdtempSync(join(tmpdir(), "cover-"));
writeFileSync(join(dir, "cover.html"), html);
await p.goto(pathToFileURL(join(dir, "cover.html")).href, { waitUntil: "load" });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: join(ROOT, "public/products/ai-career-v3.png") });
await b.close();
rmSync(dir, { recursive: true, force: true });
console.log("wrote public/products/ai-career-v3.png");
