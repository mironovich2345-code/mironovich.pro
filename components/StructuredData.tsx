import { site, siteUrl, socialProfiles } from "@/config/site";

/**
 * WebSite + Person + Service graph. Nothing here is invented: no awards, clients,
 * ratings, prices or reviews, and sameAs is emitted only for profiles set in env.
 */
export default function StructuredData() {
  const knowsAbout = [
    "системы обучения сотрудников",
    "адаптация сотрудников",
    "корпоративное обучение",
    "базы знаний",
    "автоматизация бизнес-процессов",
    "AI",
  ];

  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite",
      "@id": siteUrl + "/#website",
      name: site.name,
      url: siteUrl,
      inLanguage: "ru-RU",
      description: site.description,
      publisher: { "@id": siteUrl + "/#person" },
    },
    {
      "@type": "Person",
      "@id": siteUrl + "/#person",
      name: site.person,
      url: siteUrl,
      jobTitle: site.jobTitle,
      knowsAbout,
      ...(socialProfiles.length > 0 ? { sameAs: socialProfiles } : {}),
    },
    {
      "@type": "Service",
      "@id": siteUrl + "/#service",
      name: "Системы обучения сотрудников",
      serviceType: "Разработка систем обучения и адаптации сотрудников",
      description:
        "Проектирование и запуск системы обучения сотрудников: адаптация новичков, корпоративная академия, база знаний, тестирование, аттестации, контроль прогресса, автоматизация и AI.",
      provider: { "@id": siteUrl + "/#person" },
      areaServed: "RU",
      url: siteUrl,
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) }}
    />
  );
}
