import Link from "next/link";
import { site } from "@/config/site";

const navClass = "text-neutral-300 hover:text-accent-300";
const legalClass = "text-neutral-500 underline underline-offset-[3px] hover:text-accent-300";

export default function Footer() {
  return (
    <footer
      className="mx-auto flex max-w-[1080px] flex-wrap items-start justify-between gap-x-12 gap-y-[26px] px-[22px] pb-28 pt-[34px]"
      style={{
        backgroundImage: "linear-gradient(90deg, transparent, #292b31 48px, #292b31 calc(100% - 48px), transparent)",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 1px",
      }}
    >
      <div>
        <p className="m-0 text-[17px] tracking-[0.1em]">{site.name}</p>
        <p className="m-0 mt-2 text-[13px] text-neutral-400">{site.person}</p>
        <p className="m-0 mt-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">{site.tagline}</p>
      </div>
      <nav aria-label="Разделы сайта" className="flex flex-col gap-2.5 text-sm">
        <Link href="/" className={navClass}>Главная</Link>
        <Link href="/about" className={navClass}>Обо мне</Link>
        <Link href="/blog" className={navClass}>Блог</Link>
      </nav>
      <div className="flex flex-col gap-2.5 text-sm">
        <a href={site.instagram} target="_blank" rel="noopener noreferrer" className={navClass}>Instagram</a>
        <a href={site.telegram} target="_blank" rel="noopener noreferrer" className={navClass}>Telegram</a>
      </div>
      <div className="flex flex-col gap-2.5 text-[13px] text-neutral-500">
        <span>© 2026</span>
        <Link href="/privacy" className={legalClass}>Политика конфиденциальности</Link>
        <Link href="/consent" className={legalClass}>Согласие на обработку персональных данных</Link>
      </div>
    </footer>
  );
}
