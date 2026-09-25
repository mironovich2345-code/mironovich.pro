import Link from "next/link";
import CtaLink from "./CtaLink";
import MobileMenu from "./MobileMenu";
import { site, navLinks } from "@/config/site";

/**
 * Quiet top bar: wordmark, three links, one CTA. Not sticky — the landing page
 * keeps its own rhythm, and long articles have the footer for navigation.
 * Server component; only the mobile toggle ships JS.
 */
export default function SiteHeader() {
  return (
    <header className="relative z-30 mx-auto flex max-w-[1080px] items-center justify-between gap-6 px-[22px] py-3.5 min-[760px]:py-4">
      <Link href="/" aria-label={site.name + " — на главную"} className="text-[15px] tracking-[0.1em] text-ink">
        {site.name}
      </Link>

      <nav aria-label="Основная навигация" className="hidden items-center gap-7 min-[760px]:flex">
        {navLinks.map((l) => (
          <Link key={l.href} href={l.href} className="text-sm text-neutral-400 transition-colors hover:text-ink">
            {l.label}
          </Link>
        ))}
        <CtaLink
          href="/#contact"
          location="header"
          className="inline-flex min-h-[40px] items-center rounded-md border border-accent-700 px-4 text-sm text-accent-300 transition-colors hover:border-accent hover:bg-accent-900 hover:text-accent-100"
        >
          Обсудить задачу
        </CtaLink>
      </nav>

      <MobileMenu links={navLinks} />
    </header>
  );
}
