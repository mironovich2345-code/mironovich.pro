import Link from "next/link";
import { additionalServices } from "@/config/commercial";

/** Native disclosure works with keyboard/screen readers and without client JavaScript. */
export default function OtherServices() {
  return (
    <section
      id="other-services"
      className="bg-cream px-[22px] py-12 min-[560px]:py-16"
    >
      <div className="mx-auto max-w-[1080px]">
        <details className="group border-y border-graphite/20">
          <summary className="flex min-h-[80px] cursor-pointer list-none items-center justify-between gap-5 py-5 text-graphite [&::-webkit-details-marker]:hidden">
            <span className="font-display text-[clamp(28px,4vw,42px)] font-extrabold uppercase leading-tight">
              Другие услуги
            </span>
            <span
              aria-hidden
              className="text-2xl text-maroon transition-transform group-open:rotate-180"
            >
              ↓
            </span>
          </summary>
          <ul className="m-0 grid list-none gap-x-12 border-t border-graphite/15 p-0 min-[760px]:grid-cols-2">
            {additionalServices.map((s) => (
              <li
                key={s.title}
                className="border-b border-graphite/15 py-6 last:border-b-0"
              >
                <Link
                  href={s.href}
                  className="inline-flex min-h-[44px] items-center gap-3 text-[18px] font-medium text-graphite underline decoration-maroon/40 underline-offset-4 hover:text-maroon"
                >
                  {s.title}
                  <span aria-hidden>↗</span>
                </Link>
                <p className="m-0 mt-2 text-[14px] leading-relaxed text-graphite/75">
                  {s.description}
                </p>
              </li>
            ))}
          </ul>
          <Link
            href="/services"
            className="my-6 inline-flex min-h-[44px] items-center text-maroon underline underline-offset-4"
          >
            Все услуги и прежние направления →
          </Link>
        </details>
      </div>
    </section>
  );
}
