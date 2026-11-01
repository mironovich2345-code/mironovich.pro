import fs from "node:fs";
import path from "node:path";
import { readImage } from "./image-size";
import { parseMarkdown, type Block } from "./markdown";
import { legal } from "@/config/legal";
import { findPlaceholders } from "./release-guard.mjs";

/**
 * Privacy policy and consent texts from content/legal/. Read at build time.
 *
 * Which version a page shows:
 * - legal.published → the new text; the build FAILS if any [УТОЧНИТЬ …] / [ОПИСАТЬ …] / ⟦…⟧
 *   placeholder remains or the edition does not match config/legal.json
 *   (analytics always waits for consent — lib/consent.ts);
 * - LEGAL_PREVIEW=1 (staging only) → the draft, marked «Проект», noindex;
 * - otherwise → the current published wording.
 */

export type LegalSlug = "privacy" | "consent";
export type LegalDoc = { slug: LegalSlug; title: string; edition: string; blocks: Block[]; placeholders: string[] };
export type LegalMode = "published" | "preview" | "legacy";


export function getLegalDoc(slug: LegalSlug): LegalDoc {
  const file = path.join(process.cwd(), "content", "legal", slug + ".md");
  const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error("[legal] " + slug + ".md: нужен frontmatter");
  const meta = Object.fromEntries(
    m[1].split("\n").filter((l) => l.includes(":")).map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]),
  );
  const body = m[2].trim();
  return {
    slug,
    title: meta.title,
    edition: meta.edition,
    blocks: parseMarkdown(body, readImage),
    placeholders: findPlaceholders(body),
  };
}

export function legalMode(doc: LegalDoc): LegalMode {
  if (legal.published) {
    if (doc.placeholders.length > 0) {
      throw new Error("[legal] " + doc.slug + ".md: нельзя публиковать с незаполненными полями: " + doc.placeholders.join(", "));
    }
    if (doc.edition !== legal.edition) {
      throw new Error("[legal] " + doc.slug + ".md: edition " + doc.edition + " не совпадает с config/legal.ts (" + legal.edition + ")");
    }
    return "published";
  }
  return process.env.LEGAL_PREVIEW === "1" ? "preview" : "legacy";
}

const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const formatEdition = (iso: string) => {
  const [y, mo, d] = iso.split("-").map(Number);
  return d + " " + months[mo - 1] + " " + y;
};
