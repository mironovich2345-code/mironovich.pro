import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaLink from "@/components/CtaLink";
import SectionLabel from "@/components/SectionLabel";
import { services } from "@/config/services";
import { contactHref, site, siteUrl, socialProfiles } from "@/config/site";
import { jsonLd } from "@/lib/jsonld";
import { breadcrumbList, pageMetadata } from "@/lib/seo";

const title = "Данил Миронович — внешний технологический директор";
const description =
  "Внешний CTO и технический партнёр бизнеса. Управленческий опыт, разработка, выбор подрядчиков и сопровождение IT-продуктов.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/about", type: "profile" });

const crumbs = [
  { name: "Главная", href: "/" },
  { name: "Обо мне", href: "/about" },
];

/*
 * Facts here are limited to what the site already stated and the owner has not
 * contradicted: the path from night administrator to regional director of a
 * fitness-club chain and the areas that work covered. No years, intermediate
 * titles, client names or results are added.
 */
const path = [
  {
    stage: "Операционное управление",
    title: "От ночного администратора до регионального директора сети фитнес-клубов",
    body: "Работа с сотрудниками, продажами, адаптацией новичков, стандартами, контролем и ежедневными операционными процессами.",
  },
  {
    stage: "Переход",
    title: "От ручного управления — к системам",
    body: "Хороший руководитель может многое держать вручную. Но если процесс живёт только в голове и переписке, он ломается вместе с людьми. Отсюда интерес к тому, как переводить процессы в инструменты.",
  },
  {
    stage: "Сейчас",
    title: "Автоматизация, приложения, обучение",
    body: "Разбираю процессы бизнеса и создаю для них цифровые решения: автоматизацию, внутренние приложения и системы обучения сотрудников.",
  },
];

const insideProblems = [
  { title: "Новичков обучает руководитель", body: "Каждый раз заново — и качество зависит от того, у кого есть время." },
  { title: "Знания разбросаны", body: "Инструкции живут в чатах, документах и в головах отдельных сотрудников." },
  { title: "Стандарт держится на людях", body: "Пока сильный человек на месте, всё работает. Когда он уходит — уходят и знания." },
  { title: "Контроль требует ручной работы", body: "Чтобы понять, что происходит, приходится спрашивать и собирать информацию вручную." },
];

const approach = [
  { title: "Сначала процесс", body: "Разбираюсь, как работа устроена сейчас, кто участвует и где теряется время." },
  { title: "Потом решение", body: "Сравниваю варианты: иногда достаточно готового сервиса или изменения порядка работы." },
  { title: "Потом инструмент", body: "Разработку начинаю с небольшого рабочего этапа и проверяю его на реальной задаче." },
];

const ctaClass =
  "inline-flex min-h-[56px] items-center justify-center whitespace-nowrap bg-signal px-5 text-center text-[14px] font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] min-[400px]:px-8 min-[400px]:text-[15px] min-[400px]:tracking-[0.06em]";

export default function AboutPage() {
  const url = siteUrl + "/about";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": url + "#profilepage",
        url,
        name: title,
        description,
        inLanguage: "ru-RU",
        isPartOf: { "@id": siteUrl + "/#website" },
        breadcrumb: { "@id": url + "#breadcrumb" },
        mainEntity: { "@id": siteUrl + "/#person" },
      },
      {
        "@type": "Person",
        "@id": siteUrl + "/#person",
        name: site.person,
        alternateName: site.name,
        url: siteUrl,
        mainEntityOfPage: url,
        jobTitle: site.jobTitle,
        description:
          "Пришёл в разработку из операционного управления: прошёл путь от ночного администратора до регионального директора сети фитнес-клубов. Помогает бизнесу выбирать технологии, управлять разработкой и сопровождать продукты.",
        image: [siteUrl + "/images/danil-mironovich-editorial.webp", siteUrl + "/images/danil-mironovich-main.webp"],
        knowsAbout: [
          "автоматизация бизнес-процессов",
          "разработка приложений для бизнеса",
          "системы обучения и адаптации сотрудников",
          "операционное управление",
        ],
        ...(socialProfiles.length > 0 ? { sameAs: socialProfiles } : {}),
      },
      { ...breadcrumbList(crumbs), "@id": url + "#breadcrumb" },
    ],
  };

  return (
    <>
      <main id="main">
        {/* 01 — first screen: name, one line, CTA; portrait to the right on desktop, below on mobile */}
        <section id="hero" className="bg-graphite px-[22px] pb-14 pt-6 min-[560px]:pb-20 min-[560px]:pt-10">
          <div className="mx-auto mb-6 max-w-[1080px] min-[560px]:mb-10">
            <Breadcrumbs items={crumbs} />
          </div>
          <div className="mx-auto grid max-w-[1080px] gap-10 min-[900px]:grid-cols-[1.2fr_0.8fr] min-[900px]:items-end min-[900px]:gap-16">
            <div className="flex flex-col gap-5 min-[560px]:gap-8">
              <h1 className="m-0 font-display text-[clamp(44px,8.4vw,104px)] font-extrabold uppercase leading-[0.92] tracking-[-0.025em] text-cream">
                Данил Миронович<span className="text-signal">.</span>
              </h1>
              <p className="m-0 max-w-[30ch] text-balance text-[clamp(18px,2.6vw,24px)] leading-[1.35] tracking-[-0.01em] text-cream/80">
                Внешний технологический директор. Разработка и сопровождение продуктов для бизнеса.
              </p>
              <div className="flex flex-col gap-2.5 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-6">
                <CtaLink href={contactHref} location="about" className={ctaClass}>
                  Обсудить задачу бесплатно
                </CtaLink>
                <p className="m-0 text-[13px] text-stone">Первичное обсуждение — бесплатно</p>
              </div>
            </div>
            <figure className="relative m-0 aspect-[4/5] w-full overflow-hidden min-[900px]:aspect-[2/3]">
              <Image
                src="/images/danil-mironovich-editorial.webp"
                alt="Данил Миронович"
                width={853}
                height={1280}
                sizes="(max-width: 900px) 100vw, 40vw"
                priority
                className="block h-full w-full object-cover object-[50%_25%]"
              />
            </figure>
          </div>
        </section>

        {/* 02 — path */}
        <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
          <div className="mx-auto max-w-[1080px]">
            <SectionLabel index="01" label="Путь" note="Операционное управление → разработка" tone="light" />
            <div className="grid gap-12 min-[900px]:grid-cols-[1fr_1.15fr] min-[900px]:gap-16">
              <div className="flex flex-col gap-8">
                <h2 className="m-0 max-w-[16ch] text-balance font-display text-[clamp(30px,5.4vw,52px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-graphite">
                  Пришёл в разработку из управления бизнесом
                </h2>
                <figure className="m-0">
                  <div className="relative aspect-[4/5] w-full overflow-hidden">
                    <Image
                      src="/images/danil-mironovich-main.webp"
                      alt="Данил Миронович выступает с микрофоном"
                      width={1024}
                      height={1536}
                      sizes="(max-width: 900px) 100vw, 45vw"
                      className="block h-full w-full object-cover object-[50%_20%]"
                    />
                  </div>
                </figure>
              </div>
              <ol className="m-0 flex list-none flex-col p-0">
                {path.map((p, i) => (
                  <li key={p.stage} className="relative grid grid-cols-[44px_1fr] gap-5 pb-10 last:pb-0">
                    {i < path.length - 1 && <span aria-hidden className="absolute bottom-0 left-[21px] top-11 w-px bg-signal/50" />}
                    <span className="flex h-11 w-11 items-center justify-center border border-signal font-display text-[15px] font-extrabold text-signal">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="pt-1">
                      <p className="m-0 mb-2 text-[11px] uppercase tracking-[0.18em] text-maroon">{p.stage}</p>
                      <h3 className="m-0 mb-3 text-balance font-display text-[clamp(21px,2.6vw,27px)] font-extrabold uppercase leading-[1.1] tracking-[-0.01em] text-graphite">
                        {p.title}
                      </h3>
                      <p className="m-0 max-w-[52ch] text-pretty text-[15.5px] leading-[1.65] text-graphite/75">{p.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 03 — problems understood from the inside */}
        <section className="bg-graphite px-[22px] py-16 min-[560px]:py-24">
          <div className="mx-auto max-w-[1080px]">
            <SectionLabel index="02" label="Изнутри" note="С чем сталкивался сам" />
            <div className="mb-12 grid gap-6 min-[860px]:mb-14 min-[860px]:grid-cols-2 min-[860px]:items-end min-[860px]:gap-16">
              <h2 className="m-0 max-w-[18ch] text-balance font-display text-[clamp(30px,5.4vw,52px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-cream">
                Проблемы, которые знаю не по учебникам
              </h2>
              <p className="m-0 max-w-[46ch] text-pretty text-[16px] leading-[1.6] text-cream/80">
                Мне приходилось самому решать эти задачи как руководителю. Поэтому, разбирая процесс клиента, я смотрю
                не только на технологию, но и на то, как этим будут пользоваться люди.
              </p>
            </div>
            <ul className="m-0 grid list-none grid-cols-1 gap-x-12 p-0 min-[760px]:grid-cols-2">
              {insideProblems.map((p) => (
                <li key={p.title} className="border-t-2 border-signal py-7">
                  <h3 className="m-0 mb-2 font-display text-[clamp(20px,2.4vw,25px)] font-extrabold uppercase leading-[1.1] text-cream">{p.title}</h3>
                  <p className="m-0 max-w-[44ch] text-pretty text-[15.5px] leading-[1.6] text-cream/80">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 04 — what I do now */}
        <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
          <div className="mx-auto max-w-[1080px]">
            <SectionLabel index="03" label="Сейчас" note="Четыре направления" tone="light" />
            <h2 className="m-0 mb-12 max-w-[18ch] text-balance font-display text-[clamp(30px,5.4vw,52px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-graphite min-[560px]:mb-14">
              Чем занимаюсь сейчас
            </h2>
            <ul className="m-0 grid list-none grid-cols-1 border-t border-graphite/15 p-0 min-[900px]:grid-cols-2">
              {services.map((s, i) => (
                <li key={s.slug} className={"border-b border-graphite/15 " + (i % 2 === 1 ? "min-[900px]:border-l min-[900px]:pl-8 " : "") + (i % 2 === 0 ? "min-[900px]:pr-8" : "")}>
                  <Link href={s.href} className="group flex h-full flex-col gap-3 py-8">
                    <span className="font-display text-[clamp(36px,4vw,52px)] font-extrabold leading-none text-signal">{s.index}</span>
                    <h3 className="m-0 text-balance font-display text-[clamp(22px,2.6vw,28px)] font-extrabold uppercase leading-[1.08] text-graphite transition-colors group-hover:text-maroon">
                      {s.title}
                    </h3>
                    <p className="m-0 text-pretty text-[15px] leading-[1.6] text-graphite/75">{s.lead}</p>
                    <span className="mt-auto inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.1em] text-maroon underline decoration-maroon/30 underline-offset-4 transition-colors group-hover:text-signal">
                      Подробнее →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 05 — approach + tools */}
        <section className="bg-graphite px-[22px] py-16 min-[560px]:py-24">
          <div className="mx-auto max-w-[1080px]">
            <SectionLabel index="04" label="Подход" note="Процесс → Решение → Инструмент" />
            <h2 className="m-0 mb-12 max-w-[18ch] text-balance font-display text-[clamp(30px,5.4vw,52px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-cream min-[560px]:mb-14">
              Сначала процесс. Потом инструмент.
            </h2>
            <ol className="m-0 grid list-none grid-cols-1 border-t border-cream/15 p-0 min-[760px]:grid-cols-3">
              {approach.map((a, i) => (
                <li key={a.title} className={"flex flex-col gap-2 border-b border-cream/15 py-7 min-[760px]:border-b-0 min-[760px]:pr-6 " + (i > 0 ? "min-[760px]:border-l min-[760px]:pl-6" : "")}>
                  <span className="font-display text-[15px] font-extrabold text-signal">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="m-0 text-[16px] font-medium uppercase tracking-[0.04em] text-cream">{a.title}</h3>
                  <p className="m-0 text-pretty text-[15px] leading-[1.6] text-cream/80">{a.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-14 grid gap-4 border-t border-cream/15 pt-10 min-[860px]:grid-cols-[1fr_1.4fr] min-[860px]:gap-16">
              <h3 className="m-0 text-[12px] font-normal uppercase tracking-[0.18em] text-stone">Технологии и инструменты</h3>
              <p className="m-0 max-w-[56ch] text-pretty text-[16px] leading-[1.65] text-cream/80">
                Подбираю под задачу: требования к процессу, интеграциям, безопасности и дальнейшей поддержке. Конкретный
                набор обсуждаем, когда понятна задача, — без привязки к одной платформе.
              </p>
            </div>
          </div>
        </section>

        {/* 06 — CTA */}
        <section className="bg-maroon px-[22px] py-20 min-[560px]:py-28">
          <div className="mx-auto flex max-w-[1080px] flex-col gap-8 min-[860px]:flex-row min-[860px]:items-end min-[860px]:justify-between">
            <div>
              <h2 className="m-0 mb-5 max-w-[16ch] text-balance font-display text-[clamp(32px,6vw,60px)] font-extrabold uppercase leading-[1] tracking-[-0.02em] text-cream">
                Есть процесс, который отнимает время?
              </h2>
              <p className="m-0 max-w-[46ch] text-pretty text-[16px] leading-[1.6] text-cream/80">
                Расскажите о нём. Первичное обсуждение бесплатно — разберёмся, что стоит менять и с чего начать.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <CtaLink href={contactHref} location="about" className={ctaClass}>
                Обсудить задачу бесплатно
              </CtaLink>
              <Link href="/services" className="inline-flex min-h-[44px] items-center justify-center text-[13px] uppercase tracking-[0.1em] text-cream underline decoration-cream/30 underline-offset-4 hover:text-signal">
                Все услуги →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
