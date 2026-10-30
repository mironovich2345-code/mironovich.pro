import type { Metadata } from "next";
import Link from "next/link";
import CtaLink from "@/components/CtaLink";
import { contactHref, serviceLinks } from "@/config/site";

// Next adds noindex to the 404 response itself; no canonical is emitted.
export const metadata: Metadata = {
  title: "Страница не найдена",
};

export default function NotFound() {
  return (
    <main id="main" className="bg-graphite px-[22px] py-20 min-[560px]:py-28">
      <div className="mx-auto max-w-[1080px]">
        <p className="m-0 mb-8 text-[11px] uppercase tracking-[0.22em] text-signal">Ошибка 404</p>
        <h1 className="m-0 mb-6 max-w-[14ch] font-display text-[clamp(40px,9vw,96px)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-cream">
          Такой страницы нет<span className="text-signal">.</span>
        </h1>
        <p className="m-0 mb-12 max-w-[48ch] text-pretty text-[16px] leading-[1.6] text-stone">
          Возможно, ссылка устарела или в адресе опечатка. Вот куда можно перейти:
        </p>

        <ul className="m-0 mb-12 flex max-w-[560px] list-none flex-col border-t border-cream/15 p-0">
          {[{ href: "/", label: "Главная" }, ...serviceLinks, { href: "/blog", label: "Блог" }, { href: "/about", label: "Обо мне" }].map(
            (l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex min-h-[52px] items-center justify-between border-b border-cream/15 text-[15px] uppercase tracking-[0.04em] text-cream transition-colors hover:text-signal"
                >
                  {l.label} <span aria-hidden>→</span>
                </Link>
              </li>
            ),
          )}
        </ul>

        <CtaLink
          href={contactHref}
          location="not_found"
          className="inline-flex min-h-[56px] items-center justify-center bg-signal px-8 text-[15px] font-medium uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#b82323]"
        >
          Обсудить задачу бесплатно
        </CtaLink>
      </div>
    </main>
  );
}
