import Link from "next/link";
import CtaLink from "./CtaLink";
import MobileMenu from "./MobileMenu";
import ServicesMenu from "./ServicesMenu";
import { contactHref, headerGroups, site } from "@/config/site";

/**
 * Sticky editorial top bar: wordmark, three audience groups, one lead CTA.
 * Server component; only the dropdowns and the mobile menu ship JS.
 */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-cream/10 bg-graphite/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-6 px-[22px] py-2.5 min-[860px]:py-3">
        <Link
          href="/"
          aria-label={site.name + " — на главную"}
          className="inline-flex min-h-[44px] items-center text-[15px] tracking-[0.14em] text-cream"
        >
          {site.name}
        </Link>

        <nav aria-label="Основная навигация" className="hidden items-center gap-4 min-[1150px]:flex">
          {headerGroups.map((group) => <ServicesMenu key={group.id} group={group} />)}
          <CtaLink
            href={contactHref}
            location="header"
            className="inline-flex min-h-[44px] items-center bg-signal px-5 text-[13px] font-medium uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#b82323]"
          >
            Разбор задачи
          </CtaLink>
        </nav>

        <MobileMenu groups={headerGroups} />
      </div>
    </header>
  );
}
