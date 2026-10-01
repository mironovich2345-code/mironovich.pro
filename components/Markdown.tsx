import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { parseInline, type Block, type Inline } from "@/lib/markdown";

// Reading context is cream — this file only ever renders inside the article
// body (app/blog/[slug]/page.tsx), so colors are fixed to that background.
const linkClass =
  "text-maroon underline decoration-maroon/40 underline-offset-[3px] transition-colors hover:text-signal hover:decoration-signal";

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return n.text;
      case "strong":
        return <strong key={i} className="font-semibold text-graphite">{renderInline(n.children)}</strong>;
      case "em":
        return <em key={i}>{renderInline(n.children)}</em>;
      case "code":
        return <code key={i} className="rounded-sm bg-graphite/8 px-1.5 py-0.5 font-mono text-[0.85em] text-graphite">{n.text}</code>;
      case "link":
        if (n.href.startsWith("/")) {
          return <Link key={i} href={n.href} className={linkClass}>{renderInline(n.children)}</Link>;
        }
        if (/^https?:\/\//i.test(n.href)) {
          return (
            <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {renderInline(n.children)}
            </a>
          );
        }
        return <a key={i} href={n.href} className={linkClass}>{renderInline(n.children)}</a>;
    }
  });
}

const inline = (text: string) => renderInline(parseInline(text));

const bullet =
  "relative pl-[22px] before:absolute before:left-0 before:top-[0.72em] before:h-[5px] before:w-[5px] before:rounded-full before:bg-signal";

function renderBlock(b: Block, i: number): ReactNode {
  switch (b.type) {
    case "h2":
      return (
        <h2
          key={i}
          className="m-0 mb-5 mt-14 text-balance font-display text-[clamp(26px,4.4vw,34px)] font-extrabold uppercase leading-[1.15] tracking-[-0.015em] text-graphite"
        >
          {inline(b.text)}
        </h2>
      );
    case "h3":
      return (
        <h3 key={i} className="m-0 mb-3 mt-10 text-balance text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-graphite">
          {inline(b.text)}
        </h3>
      );
    case "p":
      return (
        <p key={i} className="m-0 mb-6 text-pretty text-[17px] leading-[1.75] text-graphite/80 min-[760px]:text-[19px]">
          {inline(b.text)}
        </p>
      );
    case "ul":
      return (
        <ul key={i} className="m-0 mb-7 flex list-none flex-col gap-2.5 p-0 text-[17px] leading-[1.7] text-graphite/80 min-[760px]:text-[18px]">
          {b.items.map((t, j) => <li key={j} className={bullet}>{inline(t)}</li>)}
        </ul>
      );
    case "ol":
      return (
        <ol key={i} className="m-0 mb-7 flex list-decimal flex-col gap-2.5 pl-6 text-[17px] leading-[1.7] text-graphite/80 marker:text-signal min-[760px]:text-[18px]">
          {b.items.map((t, j) => <li key={j} className="pl-1.5">{inline(t)}</li>)}
        </ol>
      );
    case "quote":
      return (
        <blockquote key={i} className="m-0 mb-8 mt-9 border-l-2 border-signal pl-[18px]">
          {b.paragraphs.map((t, j) => (
            <p key={j} className="m-0 mb-3 text-balance text-[clamp(19px,3.4vw,23px)] leading-[1.45] tracking-[-0.01em] text-graphite last:mb-0">
              {inline(t)}
            </p>
          ))}
        </blockquote>
      );
    case "code":
      return (
        <pre key={i} className="m-0 mb-7 overflow-x-auto bg-graphite p-4 font-mono text-[14px] leading-[1.6] text-cream">
          <code>{b.text}</code>
        </pre>
      );
    case "image":
      // Text on a wide infographic is small, so on desktop it may run past the text
      // column; below 980px it simply takes the available width and never overflows.
      // A click opens the original file, which is what makes it legible on a phone.
      return (
        <figure key={i} className="m-0 my-10 min-[980px]:-mx-[72px]">
          <a
            href={b.src}
            target="_blank"
            rel="noopener noreferrer"
            title="Открыть в полном размере"
            className="block cursor-zoom-in"
          >
            <Image
              src={b.src}
              alt={b.alt}
              width={b.width}
              height={b.height}
              sizes="(max-width: 980px) calc(100vw - 44px), 820px"
              className="block h-auto w-full border border-graphite/15"
            />
          </a>
          {b.caption && (
            <figcaption className="mt-3 text-[11px] uppercase tracking-[0.1em] text-graphite/50">{b.caption}</figcaption>
          )}
        </figure>
      );
    case "hr":
      return <hr key={i} className="my-12 h-px border-0 bg-graphite/15" />;
  }
}

/** Renders the block list produced by lib/markdown.ts. Server component — ships no client JS. */
export default function Markdown({ blocks }: { blocks: Block[] }) {
  return <div>{blocks.map(renderBlock)}</div>;
}
