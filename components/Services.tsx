import Link from "next/link";
import CtaLink from "./CtaLink";
import SectionLabel from "./SectionLabel";
import { services } from "@/config/services";

/** Three self-contained columns, each leading to its service page. */
export default function Services() {
  return (
    <section id="services" className="relative overflow-hidden bg-graphite px-[22px] py-16 min-[560px]:py-24">
      <div className="relative mx-auto max-w-[1080px]">
        <SectionLabel index="02" label="Направления" note="Что делаю и что это даёт" />

        <h2 className="m-0 mb-12 max-w-[20ch] text-balance font-display text-[clamp(30px,5.8vw,54px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-cream min-[560px]:mb-16">
          Что я делаю и что это даёт бизнесу
        </h2>

        <div className="grid grid-cols-1 border-t border-cream/15 min-[900px]:grid-cols-3">
          {services.map((s, i) => (
            <article
              key={s.slug}
              aria-labelledby={s.slug + "-title"}
              className={
                "flex flex-col gap-6 border-b border-cream/15 py-10 min-[900px]:border-b-0 min-[900px]:py-12 " +
                (i > 0 ? "min-[900px]:border-l min-[900px]:border-cream/15 min-[900px]:pl-8 " : "") +
                (i < services.length - 1 ? "min-[900px]:pr-8" : "")
              }
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-display text-[clamp(44px,6vw,72px)] font-extrabold leading-none tracking-[-0.02em] text-signal">
                  {s.index}
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-stone">{s.label}</span>
              </div>

              <div>
                <h3
                  id={s.slug + "-title"}
                  className="m-0 mb-3 text-balance font-display text-[clamp(24px,3vw,30px)] font-extrabold uppercase leading-[1.08] tracking-[-0.015em] text-cream"
                >
                  {s.title}
                </h3>
                <p className="m-0 text-pretty text-[15.5px] leading-[1.55] text-cream/80">{s.lead}</p>
              </div>

              <div>
                <p className="m-0 mb-3 text-[11px] uppercase tracking-[0.16em] text-stone">Что делаю</p>
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[14.5px] leading-[1.45] text-cream">
                  {s.does.map((d) => (
                    <li key={d} className="flex gap-3">
                      <span aria-hidden className="text-signal">—</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-cream/15 pt-5">
                <p className="m-0 mb-2 text-[11px] uppercase tracking-[0.16em] text-signal">Что получает бизнес</p>
                <p className="m-0 text-pretty text-[14.5px] leading-[1.6] text-cream/80">{s.gives}</p>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-1">
                <Link
                  href={s.href}
                  className="inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.08em] text-cream underline decoration-signal underline-offset-4 transition-colors hover:text-signal"
                >
                  Подробнее о направлении →
                </Link>
                <CtaLink
                  href="#contact"
                  location="services"
                  className="inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.08em] text-stone underline decoration-stone/40 underline-offset-4 transition-colors hover:text-cream"
                >
                  Обсудить задачу
                </CtaLink>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
