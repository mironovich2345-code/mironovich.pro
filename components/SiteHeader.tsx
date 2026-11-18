import Link from "next/link";
import CtaLink from "./CtaLink";
import MobileMenu from "./MobileMenu";
import { aboutMenuLinks, contactHref, navLinks, site } from "@/config/site";

/**
 * Three primary audience links and a single consultation CTA.
 * The full catalog and editorial sections are available through the footer.
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

        <nav aria-label="Основная навигация" className="hidden items-center gap-7 min-[860px]:flex">
          {navLinks.map((l) =>
            l.href === "/about" ? (
              <details key={l.href} className="group relative">
                <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 whitespace-nowrap text-[13.5px] uppercase tracking-[0.065em] text-cream/80 transition-colors hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal [&::-webkit-details-marker]:hidden">
                  Кто я <span aria-hidden="true" className="text-signal">⌄</span>
                </summary>
                <div className="absolute right-0 top-full z-50 min-w-[200px] border border-cream/20 bg-[#15151a] py-2 shadow-xl">
                  {aboutMenuLinks.map((item) => (
                    <Link key={item.href} href={item.href} className="block px-5 py-3 text-[13px] uppercase tracking-[0.055em] text-cream/85 transition-colors hover:bg-cream/10 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal">
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex min-h-[44px] items-center whitespace-nowrap text-[13.5px] uppercase tracking-[0.065em] text-cream/80 transition-colors hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
              >
                {l.label}
              </Link>
            ),
          )}
          <CtaLink
            href={contactHref}
            location="header"
            className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap bg-signal px-5 text-[13px] font-medium uppercase tracking-[0.035em] text-white transition-colors hover:bg-[#b82323] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream"
          >
            Обсудить задачу
          </CtaLink>
        </nav>

        <MobileMenu links={navLinks} />
      </div>
    </header>
  );
}
