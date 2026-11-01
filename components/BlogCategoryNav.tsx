import Link from "next/link";
import { categoryHref, type CategorySlug } from "@/config/blog";
import { categoriesWithPosts, getPublishedPosts } from "@/lib/blog";

/**
 * Category filter as plain links (every state has its own URL). Only categories
 * with published articles are shown. On narrow screens the row scrolls sideways
 * inside its own box, so the page itself never scrolls horizontally.
 */
export default function BlogCategoryNav({ active }: { active?: CategorySlug }) {
  const categories = categoriesWithPosts();
  const total = getPublishedPosts().length;
  const chip =
    "inline-flex min-h-[44px] flex-none items-center gap-2 whitespace-nowrap border px-4 text-[13px] uppercase tracking-[0.08em] transition-colors";
  const on = "border-signal bg-signal text-white";
  const off = "border-cream/25 text-cream hover:border-cream";
  // the count is dimmed on dark chips only: dimmed white on the red active chip fails contrast
  const count = (isOn: boolean) => (isOn ? undefined : "opacity-70");

  return (
    <nav aria-label="Категории блога" className="-mx-[22px] overflow-x-auto px-[22px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="m-0 flex w-max list-none gap-2 p-0">
        <li>
          <Link href="/blog" aria-current={active ? undefined : "page"} className={chip + " " + (active ? off : on)}>
            Все статьи <span className={count(!active)}>{total}</span>
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={categoryHref(c.slug)}
              aria-current={active === c.slug ? "page" : undefined}
              className={chip + " " + (active === c.slug ? on : off)}
            >
              {c.short} <span className={count(active === c.slug)}>{c.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
