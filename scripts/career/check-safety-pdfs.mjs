#!/usr/bin/env node
// Reproducibility gate for the safety-module PDFs (#42).
// Rebuilds every PDF into a temporary directory and compares it with the committed file:
// page count, page size, the text of every page, embedded fonts and clickable links.
// PDF bytes are not compared: Chromium writes timestamps and object IDs that differ per run.
//
//   node scripts/career/check-safety-pdfs.mjs            # rebuild and compare
// Needs: Playwright + Chromium (dev only) and poppler-utils (pdftotext, pdfinfo, pdffonts).
import { readdirSync, readFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildTestMarkdown } from "./build-safety-materials.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const MAT = join(ROOT, "content/career/v3/materials/safety");
const COMMITTED = join(MAT, "pdf");

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`${cmd} is not available: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed:\n${r.stderr}`);
  return r.stdout;
};
const info = f => Object.fromEntries(run("pdfinfo", [f]).split("\n").filter(Boolean).map(l => {
  const i = l.indexOf(":"); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
}));
// Line structure is compared exactly; spaces inside a line are ignored, because pdftotext guesses
// word gaps from glyph positions (letter-spaced headings come out as "M IR ON OVICH").
const pages = f => run("pdftotext", ["-layout", f, "-"]).split("\f")
  .map(p => p.split("\n").map(l => l.replace(/\s+/g, "")).filter(Boolean).join("\n"));
const fonts = f => run("pdffonts", [f]).split("\n").slice(2).filter(Boolean);
const uris = f => new Set([...readFileSync(f, "latin1").matchAll(/\/URI \(([^)]*)\)/g)].map(m => m[1]));

export function comparePdf(committed, rebuilt) {
  const problems = [];
  const a = info(committed), b = info(rebuilt);
  if (a.Pages !== b.Pages) problems.push(`page count ${a.Pages} → ${b.Pages}`);
  if (a["Page size"] !== b["Page size"]) problems.push(`page size ${a["Page size"]} → ${b["Page size"]}`);
  const ta = pages(committed), tb = pages(rebuilt);
  const n = Math.min(ta.length, tb.length);
  for (let i = 0; i < n; i++) if (ta[i] !== tb[i]) {
    const la = ta[i].split("\n"), lb = tb[i].split("\n");
    const k = la.findIndex((l, j) => l !== lb[j]);
    problems.push(`page ${i + 1} text differs at line ${k + 1}:\n      committed: ${la[k] ?? "∅"}\n      rebuilt:   ${lb[k] ?? "∅"}`);
    break;
  }
  const notEmbedded = fonts(rebuilt).filter(l => l.split(/\s+/).at(-5) !== "yes");
  if (notEmbedded.length) problems.push("fonts not embedded:\n      " + notEmbedded.join("\n      "));
  const ua = uris(committed), ub = uris(rebuilt);
  if (ua.size !== ub.size || [...ua].some(u => !ub.has(u))) problems.push(`links differ: ${ua.size} → ${ub.size}`);
  return problems;
}

function main() {
  const failures = [];
  const testMd = readFileSync(join(MAT, "06-test.md"), "utf8");
  const lessons = ["SAF-01", "SAF-02", "SAF-03", "SAF-04"].map(id => JSON.parse(readFileSync(join(ROOT, "content/career/v3/lessons", id + ".json"), "utf8")));
  if (testMd !== buildTestMarkdown(lessons)) failures.push("06-test.md is stale — run the build");

  // SAFETY_PDF_KEEP=<dir> keeps the rebuilt PDFs (CI uploads them when the check fails)
  const keep = process.env.SAFETY_PDF_KEEP;
  const out = keep ? (mkdirSync(keep, { recursive: true }), keep) : mkdtempSync(join(tmpdir(), "safety-pdf-check-"));
  try {
    const build = spawnSync(process.execPath, [join(ROOT, "scripts/career/build-safety-materials.mjs"), "--out", out], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (build.status !== 0) throw new Error("build failed:\n" + build.stderr + build.stdout);
    const committed = readdirSync(COMMITTED).filter(f => f.endsWith(".pdf")).sort();
    const rebuilt = readdirSync(out).filter(f => f.endsWith(".pdf")).sort();
    for (const f of rebuilt) if (!committed.includes(f)) failures.push(`${f}: built but not committed`);
    for (const f of committed) {
      if (!existsSync(join(out, f))) { failures.push(`${f}: committed but no longer built`); continue; }
      const p = comparePdf(join(COMMITTED, f), join(out, f));
      console.log(`${p.length ? "FAIL" : "PASS"} ${f} (${info(join(out, f)).Pages} pages)`);
      for (const x of p) failures.push(`${f}: ${x}`);
    }
  } finally { if (!keep) rmSync(out, { recursive: true, force: true }); }

  if (failures.length) {
    console.error("\nCommitted PDFs do not match a fresh build. Rebuild with `node scripts/career/build-safety-materials.mjs` and commit:\n  " + failures.join("\n  "));
    process.exitCode = 1;
  } else console.log("PASS: committed PDFs are reproducible from the Markdown and lesson sources");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
