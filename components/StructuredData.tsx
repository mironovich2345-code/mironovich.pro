import { homeFaq } from "./Faq";
import { serviceId, serviceBySlug } from "@/config/services";
import { solutions } from "@/config/solutions";
import { solutionServiceSchema } from "@/lib/solution-schema";
import { ctoOffer } from "@/config/commercial";
import { site, siteUrl, socialProfiles } from "@/config/site";
import { jsonLd } from "@/lib/jsonld";

/**
 * Homepage graph: five offered systems, the separate CTO format and visible FAQ.
 * Starting prices come from the owner's brief. No invented organisation, clients,
 * ratings, reviews or client results; sameAs uses configured profiles only.
 */
export default function StructuredData() {
  const person = { "@id": siteUrl + "/#person" };

  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite",
      "@id": siteUrl + "/#website",
      name: site.name,
      url: siteUrl,
      inLanguage: "ru-RU",
      description: site.description,
      publisher: person,
    },
    {
      "@type": "Person",
      "@id": siteUrl + "/#person",
      name: site.person,
      alternateName: site.name,
      url: siteUrl,
      image: siteUrl + "/images/danil-mironovich-editorial.webp",
      jobTitle: site.jobTitle,
      knowsAbout: [
        "технологическая стратегия",
        "техническое сопровождение IT-продуктов",
        "оценка разработчиков и подрядчиков",
        "автоматизация бизнес-процессов",
        "интеграции CRM и API",
        "внедрение ИИ в рабочие процессы",
        "разработка внутренних приложений",
        "личные кабинеты и административные панели",
        "Telegram Mini Apps",
        "системы обучения и адаптации сотрудников",
        "операционное управление",
      ],
      ...(socialProfiles.length > 0 ? { sameAs: socialProfiles } : {}),
    },
    {
      "@type": "WebPage",
      "@id": siteUrl + "/#webpage",
      url: siteUrl,
      name: site.title,
      description: site.description,
      inLanguage: "ru-RU",
      isPartOf: { "@id": siteUrl + "/#website" },
      about: person,
    },
    ...solutions.map(s => solutionServiceSchema(s, siteUrl)),
    ...[serviceBySlug("cto")].map((s) => ({
      "@type": "Service",
      "@id": serviceId(siteUrl, s.slug),
      name: s.title,
      serviceType: s.serviceType,
      description: s.lead + " " + s.gives,
      provider: person,
      url: siteUrl + s.href,
      offers: { "@type": "Offer", priceSpecification: { "@type": "UnitPriceSpecification", price: ctoOffer.monthlyPrice, priceCurrency: "RUB", billingDuration: "P1M", description: `До ${ctoOffer.hours} часов в месяц; дополнительные работы отдельно.` } },
    })),
    {
      "@type": "FAQPage",
      "@id": siteUrl + "/#faq",
      mainEntity: homeFaq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@graph": graph }) }}
    />
  );
}
