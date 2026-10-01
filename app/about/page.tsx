import type { Metadata } from "next";
import Image from "next/image";
import CtaLink from "@/components/CtaLink";
import { site, siteUrl, socialProfiles } from "@/config/site";
import { jsonLd } from "@/lib/jsonld";

const title = site.person + " — системы обучения сотрудников | " + site.name;
const description =
  "Данил Миронович — системы обучения и адаптации сотрудников, корпоративные базы знаний, автоматизация и AI для бизнеса.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: siteUrl + "/about" },
  openGraph: {
    type: "profile",
    firstName: "Данил",
    lastName: "Миронович",
    locale: "ru_RU",
    url: siteUrl + "/about",
    siteName: site.name,
    title,
    description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: site.name, type: "image/png" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  robots: { index: true, follow: true },
};

// 03 / Чем занимаюсь сейчас — short route, no descriptions, two columns.
const now = [
  "Адаптация",
  "Корпоративная академия",
  "База знаний",
  "Тестирование",
  "Аттестация",
  "Контроль прогресса",
  "Автоматизация",
  "AI",
];
const nowLeft = now.slice(0, 4);
const nowRight = now.slice(4);

// 04 / Подход — sequence shown as a flow row, matching the CaseStudy device.
const sequence = ["Разбор", "Архитектура", "Контент", "Инструмент", "Развитие"];

export default function AboutPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": siteUrl + "/about#profilepage",
    url: siteUrl + "/about",
    name: title,
    description,
    inLanguage: "ru-RU",
    isPartOf: { "@id": siteUrl + "/#website" },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl + "/" },
        { "@type": "ListItem", position: 2, name: "Обо мне", item: siteUrl + "/about" },
      ],
    },
    mainEntity: {
      "@type": "Person",
      "@id": siteUrl + "/#person",
      name: site.person,
      alternateName: site.name,
      url: siteUrl,
      mainEntityOfPage: siteUrl + "/about",
      jobTitle: site.jobTitle,
      description:
        "Занимается системами обучения и адаптации сотрудников. Пришёл к ним из операционного управления фитнес-бизнесом.",
      image: siteUrl + "/images/danil-mironovich-main.webp",
      knowsAbout: [
        "системы обучения сотрудников",
        "адаптация сотрудников",
        "корпоративное обучение",
        "корпоративные академии",
        "базы знаний",
        "тестирование и аттестация сотрудников",
        "автоматизация обучения",
        "AI",
      ],
      ...(socialProfiles.length > 0 ? { sameAs: socialProfiles } : {}),
    },
  };

  return (
    <>
      <main>
        {/* 01 — Hero */}
        <section className="bg-graphite px-[22px] py-16 min-[560px]:py-24">
          <div className="mx-auto max-w-[1080px]">
            <p className="m-0 mb-10 text-[11px] uppercase tracking-[0.22em] text-signal min-[560px]:mb-14">
              01 / Данил Миронович
            </p>

            <div className="grid gap-12 min-[900px]:grid-cols-[1.15fr_0.85fr] min-[900px]:gap-16">
              <div className="flex flex-col gap-6">
                <h1 className="m-0 font-display text-[clamp(44px,10vw,104px)] font-extrabold uppercase leading-[0.94] tracking-[-0.025em] text-cream">
                  Не из <span className="text-signal">EdTech.</span>
                </h1>
                <p className="m-0 max-w-[40ch] text-balance text-[clamp(18px,3vw,22px)] leading-[1.4] tracking-[-0.01em] text-stone">
                  Я пришёл к системам обучения сотрудников из операционного управления.
                </p>
                <p className="m-0 max-w-[40ch] border-l-2 border-signal pl-5 text-pretty text-[15.5px] leading-[1.6] text-cream">
                  Прошёл путь от ночного администратора до регионального директора сети фитнес-клубов.
                </p>
              </div>

              <figure className="relative m-0 w-full overflow-hidden aspect-[2/3]">
                <Image
                  src="/images/danil-mironovich-editorial.webp"
                  alt="Данил Миронович"
                  width={853}
                  height={1280}
                  sizes="(max-width: 900px) 100vw, 40vw"
                  priority
                  className="block h-full w-full object-cover"
                />
              </figure>
            </div>
          </div>
        </section>

        {/* 02 — Откуда это взялось */}
        <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
          <div className="mx-auto max-w-[1080px]">
            <p className="m-0 mb-10 text-[11px] uppercase tracking-[0.22em] text-maroon min-[560px]:mb-14">
              02 / Откуда это взялось
            </p>

            <div className="grid gap-x-16 gap-y-8 min-[860px]:grid-cols-[1fr_1fr]">
              <h2 className="m-0 max-w-[14ch] text-balance font-display text-[clamp(32px,6.4vw,56px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-graphite">
                Систему обучения я начал видеть как руководитель.
              </h2>

              <div className="flex flex-col gap-5 border-t border-graphite/15 pt-6 min-[860px]:border-t-0 min-[860px]:pt-0">
                <p className="m-0 max-w-[52ch] text-pretty text-[16px] leading-[1.75] text-graphite/70">
                  Работа была связана с сотрудниками, продажами, адаптацией новичков, стандартами, контролем и
                  ежедневными операционными процессами.
                </p>
                <p className="m-0 max-w-[48ch] border-l-2 border-signal pl-5 text-pretty text-[clamp(18px,3vw,21px)] leading-[1.4] tracking-[-0.01em] text-graphite">
                  Хороший руководитель может хорошо обучать сотрудников вручную — но это ещё не значит, что у бизнеса
                  есть система обучения.
                </p>
                <p className="m-0 max-w-[52ch] text-pretty text-[16px] leading-[1.75] text-graphite/70">
                  Знания часто живут в головах людей, в чатах, в документах, в отдельных инструкциях и в привычках
                  конкретного руководителя.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 03 — Чем занимаюсь сейчас */}
        <section className="relative overflow-hidden bg-graphite px-[22px] py-16 min-[560px]:py-24">
          <p
            aria-hidden
            className="pointer-events-none absolute -right-4 bottom-0 select-none whitespace-nowrap font-display text-[clamp(110px,22vw,260px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream/5"
          >
            System
          </p>

          <div className="relative mx-auto max-w-[1080px]">
            <p className="m-0 mb-10 text-[11px] uppercase tracking-[0.22em] text-signal min-[560px]:mb-14">
              03 / Что я делаю сейчас
            </p>

            <h2 className="m-0 mb-14 max-w-[16ch] text-balance font-display text-[clamp(32px,6.4vw,56px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-cream min-[560px]:mb-20">
              Собираю знания бизнеса в систему.
            </h2>

            <div className="grid grid-cols-1 border-t border-cream/15 min-[700px]:grid-cols-2">
              <div className="flex flex-col min-[700px]:border-r min-[700px]:border-cream/15 min-[700px]:pr-10">
                {nowLeft.map((label, i) => (
                  <div key={label} className="flex items-baseline gap-4 border-b border-cream/15 py-5">
                    <span className="font-display text-[14px] font-extrabold text-signal">
                      {String(i + 1).padStart(2, "0")} /
                    </span>
                    <span className="text-[16px] font-medium uppercase tracking-[0.01em] text-cream">{label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col min-[700px]:pl-10">
                {nowRight.map((label, i) => (
                  <div key={label} className="flex items-baseline gap-4 border-b border-cream/15 py-5">
                    <span className="font-display text-[14px] font-extrabold text-signal">
                      {String(i + 5).padStart(2, "0")} /
                    </span>
                    <span className="text-[16px] font-medium uppercase tracking-[0.01em] text-cream">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 04 — Подход */}
        <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
          <div className="mx-auto max-w-[1080px]">
            <p className="m-0 mb-10 text-[11px] uppercase tracking-[0.22em] text-maroon min-[560px]:mb-14">
              04 / Подход
            </p>

            <h2 className="m-0 mb-10 max-w-[18ch] text-balance font-display text-[clamp(30px,6vw,52px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-graphite min-[560px]:mb-12">
              Сначала процесс. Потом система. Только потом технология.
            </h2>

            <div className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-graphite/15 pt-8 text-[13px] uppercase tracking-[0.14em] text-graphite min-[560px]:mb-12">
              {sequence.map((step, i) => (
                <span key={step} className="flex items-center gap-3">
                  {step}
                  {i < sequence.length - 1 && <span aria-hidden className="text-signal">→</span>}
                </span>
              ))}
            </div>

            <p className="m-0 max-w-[62ch] text-pretty text-[16px] leading-[1.75] text-graphite/70">
              Я не начинаю работу с выбора LMS или разработки приложения. Сначала нужно понять, что сотрудник должен
              знать, как он этому учится и как компания проверяет результат.
            </p>
          </div>
        </section>

        {/* 05 — CTA */}
        <section className="bg-maroon px-[22px] py-20 text-center min-[560px]:py-28">
          <div className="mx-auto max-w-[720px]">
            <h2 className="m-0 mb-6 text-balance font-display text-[clamp(32px,7vw,64px)] font-extrabold uppercase leading-[1] tracking-[-0.02em] text-cream">
              Обучение держится на нескольких людях?
            </h2>
            <p className="m-0 mb-9 text-pretty text-[16px] leading-[1.6] text-stone">
              Можно начать с разбора текущего процесса без готового технического задания.
            </p>
            <CtaLink
              href="/#contact"
              location="about"
              className="inline-flex min-h-[56px] items-center justify-center bg-signal px-9 text-base font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323]"
            >
              Разобрать систему обучения →
            </CtaLink>
          </div>
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
