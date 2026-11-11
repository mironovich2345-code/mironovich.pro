import Link from "next/link";
import CtaLink from "./CtaLink";
import MobileMenu from "./MobileMenu";
import ServicesMenu from "./ServicesMenu";
import { contactHref, navLinks, serviceLinks, site } from "@/config/site";

/**
 * Sticky editorial top bar: wordmark, «Услуги» group, page links, one CTA.
 * Server component; only the services disclosure and the mobile menu ship JS.
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

        <nav aria-label="Основная навигация" className="hidden items-center gap-4 min-[1024px]:flex">
          <ServicesMenu links={serviceLinks} />
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex min-h-[44px] items-center text-[13.5px] uppercase tracking-[0.08em] text-stone transition-colors hover:text-cream"
            >
              {l.label}
            </Link>
          ))}
          <CtaLink
            href={contactHref}
            location="header"
            className="inline-flex min-h-[44px] items-center bg-signal px-5 text-[13px] font-medium uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#b82323]"
          >
            Обсудить задачу
          </CtaLink>
        </nav>

        <MobileMenu services={serviceLinks} links={navLinks} />
      </div>
    </header>
  );
}
