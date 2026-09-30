import Link from "next/link";
import { site } from "@/config/site";

const linkClass = "text-stone transition-colors hover:text-cream";
const headClass = "m-0 mb-4 text-[11px] uppercase tracking-[0.18em] text-cream/40";

export default function Footer() {
  return (
    <footer className="border-t border-cream/10 bg-graphite px-[22px] pb-10 pt-16 min-[560px]:pt-20">
      <div className="mx-auto max-w-[1080px]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 border-b border-cream/10 pb-14 min-[560px]:grid-cols-4">
          <div className="col-span-2 min-[560px]:col-span-1">
            <p className={headClass}>Mironovich</p>
            <p className="m-0 text-[14px] text-cream">{site.person}</p>
            <p className="m-0 mt-2 max-w-[24ch] text-[12px] leading-[1.6] text-stone">
              Employee Training Systems — Automation — AI
            </p>
          </div>

          <nav aria-label="Разделы сайта" className="flex flex-col">
            <p className={headClass}>Меню</p>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[14px]">
              <li><Link href="/" className={linkClass}>Главная</Link></li>
              <li><Link href="/about" className={linkClass}>Обо мне</Link></li>
              <li><Link href="/blog" className={linkClass}>Блог</Link></li>
            </ul>
          </nav>

          <div className="flex flex-col">
            <p className={headClass}>Соцсети</p>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[14px]">
              <li><a href={site.instagram} target="_blank" rel="noopener noreferrer" className={linkClass}>Instagram</a></li>
              <li><a href={site.telegram} target="_blank" rel="noopener noreferrer" className={linkClass}>Telegram</a></li>
            </ul>
          </div>

          <div className="flex flex-col">
            <p className={headClass}>Документы</p>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px]">
              <li><Link href="/privacy" className={linkClass}>Политика конфиденциальности</Link></li>
              <li><Link href="/consent" className={linkClass}>Согласие на обработку ПД</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 pt-8">
          <p className="m-0 text-[12px] text-cream/40">© 2026 {site.name}</p>
          <p className="m-0 text-[12px] text-cream/40">mironovich.pro</p>
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
