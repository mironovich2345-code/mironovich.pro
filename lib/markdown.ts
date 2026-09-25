/**
 * A deliberately small Markdown subset for blog articles — no dependency, no raw HTML.
 * Supported: ## / ### headings, paragraphs, - and 1. lists, > quotes, ``` code blocks,
 * --- rules and inline **bold**, *italic*, `code`, [links](url).
 * Anything outside the subset throws, so a bad article fails the build instead of
 * silently rendering wrong.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong" | "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "quote"; paragraphs: string[] }
  | { type: "code"; text: string }
  | { type: "image"; src: string; alt: string; width: number; height: number; caption?: string }
  | { type: "hr" };

const UL_ITEM = /^[-*]\s+(.*)$/;
const OL_ITEM = /^\d+[.)]\s+(.*)$/;
// a picture is always a block on its own line; the optional "title" becomes the caption
const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;

/**
 * `resolveImage` checks that a picture exists and reports its size, so a broken
 * path fails the build instead of shipping a missing image.
 */
export function parseMarkdown(
  src: string,
  resolveImage: (src: string) => { width: number; height: number },
): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ") });
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith("```")) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      if (i >= lines.length) throw new Error("незакрытый блок кода (```)");
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }

    if (trimmed === "") {
      flush();
      continue;
    }

    if (trimmed.startsWith("![")) {
      flush();
      const image = IMAGE.exec(trimmed);
      if (!image) throw new Error("картинка должна быть на отдельной строке в формате ![alt](/путь.png \"подпись\"): «" + trimmed + "»");
      const alt = image[1].trim();
      if (!alt) throw new Error("у картинки нет alt-текста: «" + trimmed + "»");
      const { width, height } = resolveImage(image[2]);
      blocks.push({ type: "image", src: image[2], alt, width, height, caption: image[3]?.trim() || undefined });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const level = heading[1].length;
      if (level === 1) throw new Error("заголовок первого уровня (#) не поддерживается: H1 берётся из поля title. Используйте ## и ###");
      if (level > 3) throw new Error("заголовки глубже ### не поддерживаются: «" + trimmed + "»");
      blocks.push({ type: level === 2 ? "h2" : "h3", text: heading[2].trim() });
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      flush();
      blocks.push({ type: "hr" });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flush();
      const paragraphs: string[] = [];
      let current: string[] = [];
      for (; i < lines.length && lines[i].trim().startsWith(">"); i++) {
        const text = lines[i].trim().replace(/^>\s?/, "").trim();
        if (text === "") {
          if (current.length) paragraphs.push(current.join(" "));
          current = [];
        } else {
          current.push(text);
        }
      }
      if (current.length) paragraphs.push(current.join(" "));
      i--;
      blocks.push({ type: "quote", paragraphs });
      continue;
    }

    const ordered = OL_ITEM.test(trimmed);
    if (ordered || UL_ITEM.test(trimmed)) {
      flush();
      const marker = ordered ? OL_ITEM : UL_ITEM;
      const items: string[] = [];
      for (; i < lines.length; i++) {
        const raw = lines[i];
        const t = raw.trim();
        const m = marker.exec(t);
        if (t === "") {
          // a blank line only continues the list when another item follows
          const next = lines.slice(i + 1).find((l) => l.trim() !== "");
          if (next !== undefined && marker.test(next.trim()) && !/^\s/.test(next)) continue;
          break;
        }
        if (m && (items.length === 0 || !/^\s/.test(raw))) {
          items.push(m[1].trim());
        } else if (/^\s/.test(raw) && items.length) {
          if (UL_ITEM.test(t) || OL_ITEM.test(t)) throw new Error("вложенные списки не поддерживаются: «" + t + "»");
          items[items.length - 1] += " " + t;
        } else {
          break;
        }
      }
      i--;
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }

    para.push(trimmed);
  }

  flush();

  // inline syntax is parsed at render time; run it once here so a bad link or a
  // stray picture is reported against the article file, not deep inside a render
  for (const b of blocks) {
    if (b.type === "p" || b.type === "h2" || b.type === "h3") parseInline(b.text);
    else if (b.type === "ul" || b.type === "ol") b.items.forEach(parseInline);
    else if (b.type === "quote") b.paragraphs.forEach(parseInline);
  }
  return blocks;
}

/** Only these targets are allowed in article links. */
function checkHref(href: string): string {
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href) || href.startsWith("#")) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  throw new Error("недопустимая ссылка «" + href + "»: разрешены /путь, #якорь, https://, mailto:, tel:");
}

export function parseInline(text: string): Inline[] {
  if (text.includes("![")) throw new Error("картинка не может стоять внутри строки текста: «" + text + "». Поставьте её отдельной строкой");
  // built per call: the regex is global and parseInline recurses
  const token = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*|`([^`]+)`/g;
  const out: Inline[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = token.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "link", href: checkHref(m[2]), children: parseInline(m[1]) });
    else if (m[3] !== undefined) out.push({ type: "strong", children: parseInline(m[3]) });
    else if (m[4] !== undefined) out.push({ type: "em", children: parseInline(m[4]) });
    else out.push({ type: "code", text: m[5] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** Plain text of a markdown fragment — used for reading-time estimates. */
export function plainWordCount(src: string): number {
  return src
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*#>_-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}
