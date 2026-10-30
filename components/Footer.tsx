import Link from "next/link";
import { navLinks, serviceLinks, site } from "@/config/site";

const linkClass = "inline-flex min-h-[32px] items-center text-stone transition-colors hover:text-cream";
const headClass = "m-0 mb-3 text-[11px] uppercase tracking-[0.18em] text-cream/60";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-cream/10 bg-graphite px-[22px] pb-10 pt-16 min-[560px]:pt-20">
      <div className="mx-auto max-w-[1080px]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 border-b border-cream/10 pb-14 min-[760px]:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="col-span-2 min-[760px]:col-span-1">
            <p className={headClass}>Mironovich</p>
            <p className="m-0 text-[14px] text-cream">{site.person}</p>
            <p className="m-0 mt-2 max-w-[28ch] text-[13px] leading-[1.6] text-stone">{site.tagline}</p>
          </div>

          <nav aria-label="Услуги" className="flex flex-col">
            <p className={headClass}>Услуги</p>
            <ul className="m-0 flex list-none flex-col p-0 text-[14px]">
              {serviceLinks.map((l) => (
                <li key={l.href}><Link href={l.href} className={linkClass}>{l.label}</Link></li>
              ))}
              <li><Link href="/services" className={linkClass}>Все услуги</Link></li>
            </ul>
          </nav>

          <nav aria-label="Разделы сайта" className="flex flex-col">
            <p className={headClass}>Разделы</p>
            <ul className="m-0 flex list-none flex-col p-0 text-[14px]">
              <li><Link href="/" className={linkClass}>Главная</Link></li>
              {navLinks.map((l) => (
                <li key={l.href}><Link href={l.href} className={linkClass}>{l.label}</Link></li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col">
            <p className={headClass}>Связь и документы</p>
            <ul className="m-0 flex list-none flex-col p-0 text-[14px]">
              <li><a href={site.telegram} target="_blank" rel="noopener noreferrer" className={linkClass}>Telegram</a></li>
              <li><a href={site.instagram} target="_blank" rel="noopener noreferrer" className={linkClass}>Instagram</a></li>
              <li><Link href="/privacy" className={linkClass}>Политика конфиденциальности</Link></li>
              <li><Link href="/consent" className={linkClass}>Согласие на обработку ПД</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 pt-8">
          <p className="m-0 text-[12px] text-cream/60">© {year} {site.name}</p>
          <p className="m-0 text-[12px] text-cream/60">mironovich.pro</p>
        </div>

        <p
          aria-hidden
          className="mt-6 select-none overflow-hidden whitespace-nowrap font-display text-[clamp(64px,17vw,220px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream"
        >
          Mironovich
        </p>
      </div>
    </footer>
  );
}
