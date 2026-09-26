import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
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

const experience = [
  "адаптация новичков;",
  "передача знаний внутри компании;",
  "ситуации, когда слишком многое в компании зависит от конкретного руководителя.",
];

const steps = [
  {
    title: "Процесс",
    body: "Разбираю, как в компании устроены адаптация и обучение сейчас: кто чему учит, где лежат знания, как проверяется результат и где всё держится на конкретных людях.",
  },
  {
    title: "Система",
    body: "Определяю роли, маршруты обучения, контрольные точки и правила обновления материалов. На этом этапе решается, что должно работать, а не на чём.",
  },
  {
    title: "Технологии",
    body: "Только после этого выбираю инструмент: платформу, разработку, автоматизацию или AI. Иногда достаточно простого решения, иногда нужна собственная система.",
  },
];

const contrast = [
  {
    subject: "Разработка",
    usual: "Начинается с задания: сделать приложение или платформу по готовому ТЗ.",
    mine: "Начинается с вопроса, как обучение работает сейчас и где оно ломается. ТЗ появляется после разбора, а не до него.",
  },
  {
    subject: "LMS",
    usual: "Даёт место для курсов и тестов, но не решает, чему и как учить сотрудников.",
    mine: "Сначала проектирую само обучение: маршруты, контроль, актуальность знаний. Платформа становится следствием, а не отправной точкой.",
  },
  {
    subject: "Результат",
    usual: "Система запущена, материалы загружены.",
    mine: "Обучение перестаёт зависеть от одного руководителя, а результат сотрудника можно увидеть.",
  },
];

const directions = [
  { title: "Системы адаптации сотрудников", body: "Понятный маршрут с первого рабочего дня до самостоятельной работы." },
  { title: "Корпоративные академии", body: "Уроки, видео, инструкции и программы обучения по должностям." },
  { title: "Базы знаний", body: "Регламенты, скрипты и инструкции в одном актуальном источнике." },
  { title: "Тестирование и аттестации", body: "Проверка знаний до допуска сотрудника к самостоятельной работе." },
  { title: "Автоматизация обучения", body: "Прогресс сотрудников, повторяющиеся действия и отчётность для руководителя." },
  { title: "AI-инструменты", body: "Создание и обновление материалов, работа с корпоративными знаниями и аналитика — там, где AI действительно полезен." },
];

const lead = "m-0 mb-4 max-w-[60ch] text-pretty text-[clamp(16px,4vw,18px)] leading-[1.75] text-neutral-300";
const hairline = {
  backgroundImage: "linear-gradient(90deg, #3f424d, transparent)",
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% 1px",
} as const;

function Section({ n, heading, children }: { n: string; heading: string; children: ReactNode }) {
  return (
    <section
      className="grid gap-x-11 gap-y-4 pb-8 pt-10 min-[560px]:pb-10 min-[560px]:pt-14 min-[860px]:[grid-template-columns:150px_minmax(0,1fr)]"
      style={hairline}
    >
      <p className="m-0 text-[11px] uppercase tracking-[0.2em] text-accent-400">{n}</p>
      <div>
        <h2 className="m-0 mb-6 max-w-[24ch] text-balance text-[clamp(25px,5.6vw,38px)] font-medium leading-[1.14] tracking-[-0.03em]">
          {heading}
        </h2>
        {children}
      </div>
    </section>
  );
}

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
      <main className="mx-auto max-w-[1080px] px-[22px] pb-12 pt-8 min-[560px]:pt-12">
        <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">Обо мне</p>

        <div className="grid items-start gap-x-11 gap-y-[30px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <div>
            <h1 className="m-0 mb-7 text-[clamp(34px,8vw,60px)] font-medium leading-[1.04] tracking-[-0.035em]">
              Данил Миронович
            </h1>
            <p className="m-0 mb-7 max-w-[24ch] text-balance border-l-2 border-accent pl-[18px] text-[clamp(20px,4.4vw,28px)] leading-[1.32] tracking-[-0.02em] text-ink">
              Я пришёл к системам обучения не из EdTech, а из операционного управления.
            </p>
            <p className={lead}>
              Помогаю компаниям собрать обучение и адаптацию сотрудников в работающую систему: маршрут для новичка,
              база знаний, тестирование, аттестации и понятный контроль для руководителя.
            </p>
          </div>

          <figure className="m-0 max-w-[420px]">
            <Image
              src="/images/danil-mironovich-main.webp"
              alt="Данил Миронович — системы обучения сотрудников"
              width={1024}
              height={1536}
              sizes="(max-width: 700px) 86vw, 420px"
              priority
              className="block aspect-[4/5] w-full rounded-md object-cover object-[50%_20%] shadow-[0_0_0_1px_#3f424d]"
            />
          </figure>
        </div>

        <div className="mt-14 flex flex-col">
          <Section n="01" heading="Кто я">
            <p className={lead}>
              Меня зовут Данил Миронович. Я занимаюсь системами обучения и адаптации сотрудников: разбираю, как в
              компании передаются знания, и собираю обучение, базу знаний, тестирование и контроль прогресса в единую
              систему.
            </p>
            <p className={lead}>
              Разработка, автоматизация и AI — инструменты внутри этой специализации, а не самоцель. Сначала задача
              обучения сотрудников, потом технология.
            </p>
          </Section>

          <Section n="02" heading="Опыт операционного управления">
            <p className={lead}>
              Несколько лет я работал в операционном управлении фитнес-бизнесом и дошёл до управления несколькими
              клубами. На практике отвечал за сотрудников, обучение, продажи, стандарты и ежедневные операционные
              процессы.
            </p>
            <p className={lead}>
              Именно в этой работе я увидел, насколько бизнес зависит от того, как руководители передают знания
              сотрудникам — и что происходит, когда этой системы нет.
            </p>
            <p className="m-0 mb-3 text-[13px] uppercase tracking-[0.14em] text-neutral-500">С чем приходилось сталкиваться самому</p>
            <ul className="m-0 mb-2 flex max-w-[60ch] list-none flex-col gap-2.5 p-0 text-[clamp(16px,4vw,18px)] leading-[1.65] text-neutral-300">
              {experience.map((t) => (
                <li
                  key={t}
                  className="relative pl-[22px] before:absolute before:left-0 before:top-[0.72em] before:h-[5px] before:w-[5px] before:rounded-full before:bg-accent"
                >
                  {t}
                </li>
              ))}
            </ul>
          </Section>

          <Section n="03" heading="Почему я начал заниматься системами обучения сотрудников">
            <p className={lead}>
              Изнутри процессов видна одна и та же картина: обучение как будто есть, но как система не существует. Знания
              лежат в чатах, документах и головах сотрудников. Новичка вводит в работу тот, у кого сейчас есть время.
              Руководитель снова и снова объясняет одно и то же.
            </p>
            <p className={lead}>
              Отсюда мой вывод: проблема обычно не в отсутствии курса или платформы. Обучение как рабочий процесс никто
              не спроектировал. Этим я и занимаюсь — проектирую обучение как часть операционной системы компании, а уже
              потом подбираю для него инструменты.
            </p>
            <figure className="m-0 mt-8 max-w-[520px]">
              <Image
                src="/images/danil-mironovich-work.webp"
                alt="Данил Миронович на выступлении об адаптации и обучении сотрудников"
                width={1009}
                height={806}
                sizes="(max-width: 700px) 86vw, 520px"
                className="block aspect-[4/3] w-full rounded-md object-cover shadow-[0_0_0_1px_#3f424d]"
              />
              <figcaption className="mt-3 text-[13px] text-neutral-500">Выступление об адаптации и обучении сотрудников</figcaption>
            </figure>
          </Section>

          <Section n="04" heading="Мой подход: сначала процесс, затем система, затем технологии">
            <ol className="m-0 mb-12 grid list-none grid-cols-1 gap-x-5 gap-y-6 p-0 min-[700px]:grid-cols-3">
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  className="relative pt-[18px]"
                  style={{
                    backgroundImage: `linear-gradient(90deg, ${i === 0 ? "#5d5294" : "#3f424d"}, ${i === steps.length - 1 ? "transparent" : "#292b31"})`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "100% 1px",
                  }}
                >
                  <span className={"absolute -top-0.5 left-0 h-[5px] w-[5px] rounded-full " + (i === 0 ? "bg-accent" : "bg-neutral-700")} />
                  <p className="m-0 text-[11px] tracking-[0.14em] text-neutral-600">{String(i + 1).padStart(2, "0")}</p>
                  <p className="my-2 text-[13px] uppercase tracking-[0.14em] text-ink">{s.title}</p>
                  <p className="m-0 text-pretty text-[15px] leading-[1.6] text-neutral-400">{s.body}</p>
                </li>
              ))}
            </ol>

            <h3 className="m-0 mb-2 text-[clamp(20px,4.4vw,24px)] font-medium leading-[1.25] tracking-[-0.02em]">
              Чем это отличается от обычной разработки или LMS
            </h3>
            <div className="flex flex-col">
              {contrast.map((c, i) => (
                <div
                  key={c.subject}
                  className="grid grid-cols-1 gap-x-6 gap-y-3 pb-6 pt-6 min-[760px]:[grid-template-columns:96px_1fr_1fr]"
                  style={{
                    backgroundImage: `linear-gradient(90deg, ${i === 0 ? "#5d5294" : "#3f424d"}, ${i === contrast.length - 1 ? "transparent" : "#292b31"})`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "100% 1px",
                  }}
                >
                  <p className="m-0 text-[12px] uppercase tracking-[0.16em] text-ink">{c.subject}</p>
                  <div>
                    <p className="m-0 mb-2 text-[11px] uppercase tracking-[0.18em] text-neutral-600">Обычно</p>
                    <p className="m-0 text-pretty text-[15px] leading-[1.6] text-neutral-500">{c.usual}</p>
                  </div>
                  <div>
                    <p className="m-0 mb-2 text-[11px] uppercase tracking-[0.18em] text-accent-400">Мой подход</p>
                    <p className="m-0 text-pretty text-[15px] leading-[1.6] text-neutral-300">{c.mine}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section n="05" heading="Чем занимаюсь сейчас">
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
              {directions.map((d) => (
                <article key={d.title} className="rounded-md bg-panel px-[22px] pb-7 pt-[26px] shadow-[0_0_0_1px_#292b31]">
                  <h3 className="m-0 mb-2.5 text-[18px] font-medium leading-[1.3] tracking-[-0.02em]">{d.title}</h3>
                  <p className="m-0 text-pretty text-[15px] leading-[1.6] text-neutral-500">{d.body}</p>
                </article>
              ))}
            </div>
          </Section>
        </div>

        <section className="mx-auto mt-16 max-w-[720px] pb-4 text-center min-[560px]:mt-20">
          <h2 className="m-0 mb-3 text-balance text-[clamp(22px,5.2vw,32px)] font-medium leading-[1.2] tracking-[-0.025em]">
            Расскажите, как обучение устроено у вас
          </h2>
          <p className="m-0 mb-6 text-pretty text-[15px] leading-[1.6] text-neutral-500">
            Готовое ТЗ не требуется — достаточно описать, как сегодня проходят адаптация и обучение сотрудников.
          </p>
          <CtaLink
            href="/#contact"
            location="about"
            className="inline-flex min-h-[54px] items-center justify-center rounded-md border border-accent bg-accent-900 px-[30px] text-base font-medium tracking-[-0.01em] text-accent-200 transition-colors hover:border-accent-400 hover:bg-accent-800 hover:text-accent-100"
          >
            Обсудить систему обучения
          </CtaLink>
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
