import { site, siteUrl, socialProfiles } from "@/config/site";

/**
 * WebSite + Person graph. Nothing here is invented: no awards, clients, ratings
 * or employment claims, and sameAs is emitted only for profiles set in env.
 */
export default function StructuredData() {
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
      knowsAbout: [
        "цифровые продукты",
        "автоматизация бизнес-процессов",
        "AI",
        "внутренние приложения",
        "обучение сотрудников",
      ],
      ...(socialProfiles.length > 0 ? { sameAs: socialProfiles } : {}),
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) }}
    />
  );
}
