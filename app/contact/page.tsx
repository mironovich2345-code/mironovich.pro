import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import ContactLink from "@/components/ContactLink";
import LeadForm from "@/components/LeadForm";
import { services } from "@/config/services";
import { confirmedContacts, site, siteUrl } from "@/config/site";
import { jsonLd } from "@/lib/jsonld";
import { breadcrumbList, pageMetadata } from "@/lib/seo";

const title = "Контакты: обсудить задачу — MIRONOVICH";
const description =
  "Опишите задачу по автоматизации, разработке приложения или обучению сотрудников. Первичное обсуждение бесплатно: варианты решения и следующие шаги.";

export const metadata: Metadata = pageMetadata({ title, description, path: "/contact" });

const crumbs = [
  { name: "Главная", href: "/" },
  { name: "Контакты", href: "/contact" },
];

const steps = [
  { title: "Вы отправляете заявку", body: "Достаточно описать ситуацию своими словами — готовое ТЗ не нужно." },
  { title: "Я изучаю описание", body: "И связываюсь с вами удобным способом, чтобы уточнить детали." },
  {
    title: "Бесплатное обсуждение",
    body: "В переписке или на созвоне: возможные варианты решения и следующие шаги.",
  },
  {
    title: "Дальше — по вашему решению",
    body: "Если нужна глубина — платный аудит процессов. Разработка и внедрение оцениваются отдельно.",
  },
];

export default function ContactPage() {
  const url = siteUrl + "/contact";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ContactPage",
        "@id": url + "#webpage",
        url,
        name: title,
        description,
        inLanguage: "ru-RU",
        isPartOf: { "@id": siteUrl + "/#website" },
        about: { "@id": siteUrl + "/#person" },
        breadcrumb: { "@id": url + "#breadcrumb" },
      },
      { "@type": "Person", "@id": siteUrl + "/#person", name: site.person, url: siteUrl + "/about" },
      { ...breadcrumbList(crumbs), "@id": url + "#breadcrumb" },
    ],
  };

  return (
    <>
      <main id="main">
        {/* first screen: short offer, the form starts right below on mobile and beside it on desktop */}
        <section id="contact" className="bg-graphite px-[22px] pb-16 pt-6 min-[560px]:pb-24 min-[560px]:pt-10">
          <div className="mx-auto max-w-[1080px]">
            <div className="mb-8 min-[560px]:mb-10">
              <Breadcrumbs items={crumbs} />
            </div>
            <div className="grid gap-10 min-[900px]:grid-cols-[1fr_1.1fr] min-[900px]:gap-20">
              <div className="flex flex-col gap-6">
                <h1 className="m-0 max-w-[12ch] font-display text-[clamp(40px,7vw,84px)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-cream">
                  Обсудить задачу<span className="text-signal">.</span>
                </h1>
                <p className="m-0 max-w-[40ch] text-pretty text-[17px] leading-[1.55] text-cream/80">
                  Расскажите, что хотите упростить или автоматизировать. Первичное обсуждение — бесплатно.
                </p>

                {confirmedContacts.length > 0 && (
                  <div className="hidden border-t border-cream/15 pt-6 min-[900px]:block">
                    <ContactList />
                  </div>
                )}
              </div>

              <div className="relative">
                <LeadForm />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-cream px-[22px] py-16 min-[560px]:py-24">
          <div className="mx-auto max-w-[1080px]">
            <p className="m-0 mb-10 text-[11px] uppercase tracking-[0.22em] text-maroon min-[560px]:mb-14">
              01 <span className="text-signal">/</span> Что дальше
            </p>
            <h2 className="m-0 mb-12 max-w-[18ch] text-balance font-display text-[clamp(30px,5.4vw,52px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-graphite min-[560px]:mb-14">
              Что происходит после заявки
            </h2>
            <ol className="m-0 grid list-none grid-cols-1 border-t border-graphite/15 p-0 min-[760px]:grid-cols-2 min-[1000px]:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-2 border-b border-graphite/15 py-7 min-[760px]:pr-6">
                  <span className="font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-none text-graphite/30">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="m-0 text-[15px] font-medium uppercase tracking-[0.04em] text-graphite">{s.title}</h3>
                  <p className="m-0 text-pretty text-[15px] leading-[1.6] text-graphite/75">{s.body}</p>
                </li>
              ))}
            </ol>

            {confirmedContacts.length > 0 && (
              <div className="mt-12 border-t border-graphite/15 pt-8 min-[900px]:hidden">
                <ContactList tone="light" />
              </div>
            )}
          </div>
        </section>

        <section className="bg-graphite px-[22px] py-16 min-[560px]:py-20">
          <div className="mx-auto grid max-w-[1080px] gap-10 min-[860px]:grid-cols-2 min-[860px]:gap-16">
            <div>
              <h2 className="m-0 mb-6 text-[12px] font-normal uppercase tracking-[0.18em] text-stone">Направления</h2>
              <ul className="m-0 flex list-none flex-col border-t border-cream/15 p-0">
                {services.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={s.href}
                      className="flex min-h-[56px] items-center justify-between gap-4 border-b border-cream/15 py-3 text-[16px] uppercase tracking-[0.04em] text-cream transition-colors hover:text-signal"
                    >
                      {s.title} <span aria-hidden className="text-stone">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="m-0 mb-6 text-[12px] font-normal uppercase tracking-[0.18em] text-stone">Кто будет разбирать задачу</h2>
              <p className="m-0 mb-5 max-w-[46ch] text-pretty text-[16px] leading-[1.6] text-cream/80">
                {site.person}. Пришёл в разработку из операционного управления бизнесом — поэтому смотрю на задачу и
                как руководитель, и как разработчик.
              </p>
              <Link
                href="/about"
                className="inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.1em] text-cream underline decoration-cream/30 underline-offset-4 hover:text-signal"
              >
                Обо мне →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}

/** Owner-confirmed contacts from config/contacts.ts. */
function ContactList({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const head = tone === "dark" ? "text-stone" : "text-graphite/65";
  const link = tone === "dark" ? "text-cream hover:text-signal" : "text-graphite hover:text-maroon";
  return (
    <div>
      <h2 className={"m-0 mb-3 text-[12px] font-normal uppercase tracking-[0.18em] " + head}>Написать напрямую</h2>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {confirmedContacts.map((c) => (
          <li key={c.channel}>
            <ContactLink contact={c} location="contact_page" className={"inline-flex min-h-[44px] items-center gap-3 text-[16px] transition-colors " + link}>
              <span className="text-[12px] uppercase tracking-[0.14em] opacity-70">{c.label}</span>
              {c.text}
            </ContactLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
