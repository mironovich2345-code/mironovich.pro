import Image from "next/image";
import Link from "next/link";
import { categoryBySlug, categoryHref } from "@/config/blog";
import { formatDate, readingTimeLabel, type Post } from "@/lib/blog";

/** Editorial list of articles, no cards. Thumbnail is small and desktop-only; the title carries the scan. */
export default function PostList({ posts, startAt = 1, headingLevel = "h3" }: { posts: Post[]; startAt?: number; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <ol className="m-0 flex list-none flex-col border-t border-cream/15 p-0">
      {posts.map((p, i) => {
        const cat = categoryBySlug(p.category);
        return (
          <li key={p.slug} className="grid grid-cols-1 gap-5 border-b border-cream/15 py-9 min-[640px]:grid-cols-[88px_1fr] min-[640px]:gap-8">
            <span className="font-display text-[18px] font-extrabold text-signal">№ {String(i + startAt).padStart(2, "0")}</span>
            <div className={"grid gap-5 " + (p.cover ? "min-[700px]:grid-cols-[180px_1fr] min-[1000px]:grid-cols-[220px_1fr] min-[700px]:items-start" : "grid-cols-1")}>
              {p.cover && (
                <Link href={"/blog/" + p.slug} aria-hidden tabIndex={-1} className="hidden min-[700px]:block">
                  <Image
                    src={p.cover.src}
                    alt=""
                    width={p.cover.width}
                    height={p.cover.height}
                    sizes="220px"
                    className="block h-auto w-full opacity-90 transition-opacity hover:opacity-100"
                  />
                </Link>
              )}
              <div>
                <Link href={categoryHref(p.category)} className="mb-2 inline-flex min-h-[28px] items-center text-[11px] uppercase tracking-[0.2em] text-signal hover:text-cream">
                  {cat.name}
                </Link>
                <H className="m-0 mb-2.5 max-w-[32ch] text-balance font-display text-[clamp(21px,3.4vw,27px)] font-extrabold uppercase leading-[1.1] tracking-[-0.015em] text-cream">
                  <Link href={"/blog/" + p.slug} className="transition-colors hover:text-signal">
                    {p.title}
                  </Link>
                </H>
                <p className="m-0 mb-3 max-w-[56ch] text-pretty text-[15px] leading-[1.6] text-stone">{p.excerpt}</p>
                <p className="m-0 text-[13px] text-stone">
                  <time dateTime={p.publishDate}>{formatDate(p.publishDate)}</time>
                  <span aria-hidden> · </span>
                  {readingTimeLabel(p.readingTime)}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
