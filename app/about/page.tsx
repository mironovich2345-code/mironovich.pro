import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { site, siteUrl, socialProfiles } from "@/config/site";

export const metadata: Metadata = {
  title: { absolute: site.person + " — " + site.name },
  description:
    "Данил Миронович — специалист по цифровым продуктам и автоматизации бизнеса: внутренние приложения, обучение сотрудников, автоматизация процессов и AI-инструменты.",
  alternates: { canonical: siteUrl + "/about" },
  openGraph: {
    type: "profile",
    locale: "ru_RU",
    url: siteUrl + "/about",
    siteName: site.name,
    title: site.person + " — " + site.name,
    description:
      "Специалист по цифровым продуктам и автоматизации бизнеса: внутренние приложения, обучение сотрудников, автоматизация и AI.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: site.name, type: "image/png" }],
  },
  robots: { index: true, follow: true },
};

const directions = [
  { title: "Внутренние приложения", body: "Сервисы для сотрудников: заявки, задачи, база знаний, отчётность." },
  { title: "Обучение сотрудников", body: "Адаптация, курсы и проверка знаний внутри одного инструмента." },
  { title: "Автоматизация бизнес-процессов", body: "Интеграции API, рутинные операции, уведомления и контроль." },
  { title: "AI для бизнеса", body: "Работа с данными, анализ звонков, AI-ассистенты и аналитика." },
];

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": siteUrl + "/about#profilepage",
    url: siteUrl + "/about",
    inLanguage: "ru-RU",
    isPartOf: { "@id": siteUrl + "/#website" },
    mainEntity: {
      "@type": "Person",
      "@id": siteUrl + "/#person",
      name: site.person,
      alternateName: site.name,
      url: siteUrl,
      mainEntityOfPage: siteUrl + "/about",
      jobTitle: site.jobTitle,
      image: siteUrl + "/images/danil-mironovich-main.webp",
      knowsAbout: [
        "цифровые продукты",
        "автоматизация бизнес-процессов",
        "AI",
        "внутренние приложения",
        "обучение сотрудников",
      ],
      ...(socialProfiles.length > 0 ? { sameAs: socialProfiles } : {}),
    },
  };

  return (
    <>
      <main className="mx-auto max-w-[1080px] px-[22px] py-10 min-[560px]:py-16">
        <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">Обо мне</p>

        <div className="grid items-start gap-x-11 gap-y-[30px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <div>
            <h1 className="m-0 mb-[22px] text-[clamp(32px,7.6vw,56px)] font-medium leading-[1.06] tracking-[-0.035em]">
              Данил Миронович
            </h1>
            <p className="m-0 mb-4 max-w-[54ch] text-pretty text-[clamp(15px,4vw,17px)] leading-[1.7] text-neutral-300">
              Специалист по цифровым продуктам и автоматизации бизнеса. Пришёл в разработку из операционного
              управления, поэтому смотрю на продукт не только со стороны кода: мне знакомы реальные процессы
              компании — сотрудники, обучение, продажи и ежедневный контроль.
            </p>
            <p className="m-0 mb-[26px] max-w-[54ch] text-pretty text-[clamp(15px,4vw,17px)] leading-[1.7] text-neutral-300">
              Соединяю этот опыт с разработкой, автоматизацией и AI — чтобы решения работали внутри компании,
              а не только выглядели убедительно в презентации.
            </p>
            <p
              className="m-0 pt-[18px] text-[13px] uppercase tracking-[0.12em] text-neutral-400"
              style={{
                backgroundImage: "linear-gradient(90deg, #5d5294, transparent)",
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% 1px",
              }}
            >
              Операционное управление <span className="text-accent-400">→</span> продукт{" "}
              <span className="text-accent-400">→</span> разработка <span className="text-accent-400">→</span> AI
            </p>
          </div>

          <figure className="m-0 max-w-[420px]">
            <Image
              src="/images/danil-mironovich-main.webp"
              alt="Данил Миронович — цифровые продукты и автоматизация бизнеса"
              width={1024}
              height={1536}
              sizes="(max-width: 700px) 86vw, 420px"
              priority
              className="block aspect-[4/5] w-full rounded-md object-cover object-[50%_20%] shadow-[0_0_0_1px_#3f424d]"
            />
          </figure>
        </div>

        <section className="mt-14">
          <h2 className="m-0 mb-8 text-[clamp(24px,5.6vw,36px)] font-medium leading-[1.12] tracking-[-0.03em]">
            Направления работы
          </h2>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
            {directions.map((d) => (
              <article
                key={d.title}
                className="rounded-md bg-panel p-[26px_22px_28px] shadow-[0_0_0_1px_#292b31]"
              >
                <h3 className="m-0 mb-2.5 text-[19px] font-medium tracking-[-0.02em]">{d.title}</h3>
                <p className="m-0 text-pretty text-[15px] leading-[1.6] text-neutral-500">{d.body}</p>
              </article>
            ))}
          </div>
        </section>

        <p className="mt-12 text-[15px]">
          <Link href="/" className="text-accent-300 underline underline-offset-[3px] hover:text-accent-100">
            ← На главную страницу
          </Link>
        </p>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
