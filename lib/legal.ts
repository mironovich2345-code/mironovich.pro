import fs from "node:fs";
import path from "node:path";
import { readImage } from "./image-size";
import { parseMarkdown, type Block } from "./markdown";
import { gaId, metricaId } from "./analytics";
import { consentRequired } from "./consent";
import { legal } from "@/config/legal";

/**
 * Privacy policy and consent texts from content/legal/. Read at build time.
 *
 * Which version a page shows:
 * - legal.published → the new text; the build FAILS if any [УТОЧНИТЬ …] / [ОПИСАТЬ …] / ⟦…⟧
 *   placeholder remains, if the edition does not match config/legal.ts, or (for
 *   the policy) if analytics would load without the consent banner although the
 *   policy says it loads only after permission;
 * - LEGAL_PREVIEW=1 (staging only) → the draft, marked «Проект», noindex;
 * - otherwise → the current published wording.
 */

export type LegalSlug = "privacy" | "consent";
export type LegalDoc = { slug: LegalSlug; title: string; edition: string; blocks: Block[]; placeholders: string[] };
export type LegalMode = "published" | "preview" | "legacy";

// any bracketed note written in capitals — [УТОЧНИТЬ …], [ОПИСАТЬ …] — or ⟦…⟧
const PLACEHOLDER = /\[[А-ЯЁA-Z][А-ЯЁA-Z ]{3,}[^\]]*\]|⟦[^⟧]*⟧/g;

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
    placeholders: [...new Set(body.match(PLACEHOLDER) ?? [])],
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
    if (doc.slug === "privacy" && (metricaId || gaId) && !consentRequired) {
      throw new Error("[legal] политика обещает аналитику только после согласия — задайте NEXT_PUBLIC_ANALYTICS_CONSENT=required");
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
