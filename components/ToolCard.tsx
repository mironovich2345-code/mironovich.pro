import Link from "next/link";
import type { ToolDefinition } from "@/config/tools";

/** The same composition becomes a link once the tool is available. */
export default function ToolCard({ tool }: { tool: ToolDefinition }) {
  const available = tool.status === "available";
  const className = "flex min-w-0 flex-col gap-4 border p-5 text-white min-[560px]:p-6 " +
    (tool.tone === "red" ? "border-signal bg-signal" : "border-cream/25 bg-graphite") +
    (available ? " transition-colors hover:border-cream focus-visible:outline-cream" : "");
  const content = <>
    <div className="flex items-center justify-between gap-3">
      <svg aria-hidden="true" width="22" height="26" viewBox="0 0 22 26" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="1" width="18" height="24" rx="1" /><path d="M5 5h12v5H5zM5 14h3m6 0h3M5 18h3m6 0h3M5 22h3m6 0h3" />
      </svg>
      {!available && <span className="border border-white/50 px-2 py-1 text-[10px] uppercase tracking-[0.15em]">Скоро</span>}
      {available && <span aria-hidden="true">↗</span>}
    </div>
    <h2 className="m-0 max-w-[19ch] text-balance font-display text-[clamp(23px,2.3vw,30px)] font-extrabold uppercase leading-[1.04] tracking-[-0.01em]">{tool.title}</h2>
    <p className="m-0 max-w-[32ch] text-pretty text-[14px] leading-[1.5] text-white/85">{tool.description}</p>
  </>;
  return available
    ? <Link href={tool.href} className={className}>{content}</Link>
    : <article className={className} data-tool-status="coming-soon">{content}</article>;
}
