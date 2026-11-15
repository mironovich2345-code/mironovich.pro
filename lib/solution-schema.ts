import { solutionHref, type Solution } from "../config/solutions.ts";
export function solutionServiceSchema(s: Solution, siteUrl: string) {
  const url = siteUrl + solutionHref(s);
  return {
    "@type": "Service",
    "@id": url + "#service",
    url,
    name: s.title,
    description: s.problem + " " + s.build,
    provider: { "@id": siteUrl + "/#person" },
    offers: {
      "@type": "Offer",
      name: s.full
        ? "Пилот: предварительная стартовая оценка"
        : "Ограниченный MVP: предварительная стартовая оценка",
      url,
      priceSpecification: {
        "@type": "PriceSpecification",
        minPrice: s.pilot,
        priceCurrency: "RUB",
        description:
          s.pilotScope +
          " Итоговый состав и стоимость согласуются до начала работ.",
      },
    },
  };
}
