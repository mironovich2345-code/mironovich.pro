import { homeFaq } from "./Faq";
import { serviceId, services } from "@/config/services";
import { site, siteUrl, socialProfiles } from "@/config/site";
import { jsonLd } from "@/lib/jsonld";

/**
 * Homepage graph: WebSite, Person, WebPage, one Service per direction and the
 * visible FAQ. Nothing here is invented: no organisation, awards, clients,
 * ratings, prices or reviews, and sameAs is emitted only for profiles set in env.
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
    ...services.map((s) => ({
      "@type": "Service",
      "@id": serviceId(siteUrl, s.slug),
      name: s.title,
      serviceType: s.serviceType,
      description: s.lead + " " + s.gives,
      provider: person,
      url: siteUrl + s.href,
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
