import Link from "next/link";
import CtaLink from "./CtaLink";
import MobileMenu from "./MobileMenu";
import { site, navLinks } from "@/config/site";

/**
 * Quiet editorial top bar: wordmark, three links, one CTA. Solid graphite so it
 * reads correctly regardless of what the page's first section looks like — not
 * sticky, the landing page keeps its own rhythm and long articles use the footer.
 * Server component; only the mobile toggle ships JS.
 */
export default function SiteHeader() {
  return (
    <header className="relative z-30 border-b border-cream/10 bg-graphite">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-6 px-[22px] py-4 min-[760px]:py-5">
        <Link href="/" aria-label={site.name + " — на главную"} className="text-[15px] tracking-[0.14em] text-cream">
          {site.name}
        </Link>

        <nav aria-label="Основная навигация" className="hidden items-center gap-8 min-[760px]:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="text-[13.5px] uppercase tracking-[0.08em] text-stone transition-colors hover:text-cream">
              {l.label}
            </Link>
          ))}
          <CtaLink
            href="/#contact"
            location="header"
            className="inline-flex min-h-[38px] items-center bg-signal px-4 text-[13px] font-medium uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#b82323]"
          >
            Обсудить задачу
          </CtaLink>
        </nav>

        <MobileMenu links={navLinks} />
      </div>
    </header>
  );
}
