import Link from "next/link";

export type Crumb = { name: string; href: string };

/** Visible breadcrumb trail; the last item is the current page. Pair with breadcrumbList() for JSON-LD. */
export default function Breadcrumbs({ items, tone = "dark" }: { items: Crumb[]; tone?: "dark" | "light" }) {
  const link = tone === "dark" ? "text-stone hover:text-cream" : "text-graphite/65 hover:text-graphite";
  const current = tone === "dark" ? "text-cream/80" : "text-graphite";
  return (
    <nav aria-label="Хлебные крошки">
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-[12px] uppercase tracking-[0.14em]">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className={current}>{c.name}</span>
              ) : (
                <>
                  <Link href={c.href} className={"inline-flex min-h-[32px] items-center transition-colors " + link}>{c.name}</Link>
                  <span aria-hidden className="text-signal">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
