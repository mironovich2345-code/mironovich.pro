import CtaLink from "./CtaLink";
import { additionalServices } from "@/config/commercial";
import { serviceTopics } from "@/content/service-topics";
import type { ServiceSlug } from "@/config/services";

/** IDs sit on the headings themselves, so direct and App Router hash navigation agree. */
export default function ServiceTopics({ service }: { service: ServiceSlug }) {
  const topics = additionalServices.filter((t) => t.service === service);
  if (!topics.length) return null;
  return (
    <section
      aria-label="Конкретные задачи"
      className="bg-cream px-[22px] py-12 min-[560px]:py-16"
    >
      <div className="mx-auto max-w-[1080px] divide-y divide-graphite/20">
        {topics.map((t) => (
          <article
            key={t.id}
            data-service-topic={t.id}
            className="py-8 first:pt-0 last:pb-0"
          >
            <h2
              id={t.id}
            className="m-0 max-w-[30ch] font-display text-[clamp(24px,4vw,40px)] font-extrabold uppercase leading-[1.1] text-graphite"
            >
              {t.title}
            </h2>
            <div className="mt-5 grid gap-5 min-[860px]:grid-cols-2 min-[860px]:gap-12">
              <p className="m-0 max-w-[56ch] border-l-2 border-signal pl-4 text-[17px] leading-relaxed text-graphite">
                <span className="font-medium">Результат: </span>
                {serviceTopics[t.id].result}
              </p>
              <div>
                <p className="m-0 max-w-[56ch] text-[14px] leading-relaxed text-graphite/80">
                  {serviceTopics[t.id].scope}
                </p>
                <CtaLink
                  href="#contact"
                  location="service_topic"
                  service={service}
                  topic={t.id}
                  className="mt-3 inline-flex min-h-[48px] items-center gap-3 text-[14px] font-medium text-maroon underline underline-offset-4"
                >
                  Обсудить эту задачу <span aria-hidden>↓</span>
                </CtaLink>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
