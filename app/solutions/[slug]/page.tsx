import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SolutionPage from "@/components/SolutionPage";
import { solutions, solutionBySlug, solutionHref } from "@/config/solutions";
import { siteUrl } from "@/config/site";
import { pageMetadata, breadcrumbList } from "@/lib/seo";
import { jsonLd } from "@/lib/jsonld";
import { solutionServiceSchema } from "@/lib/solution-schema";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export const generateStaticParams = () =>
  solutions.map((s) => ({ slug: s.slug }));
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = solutionBySlug((await params).slug);
  return s
    ? pageMetadata({
        title: s.title + " — MIRONOVICH.PRO",
        description: s.problem + " " + s.build,
        path: solutionHref(s),
      })
    : {};
}
export default async function Page({ params }: Props) {
  const s = solutionBySlug((await params).slug);
  if (!s) notFound();
  const url = siteUrl + solutionHref(s);
  const graph = [
    solutionServiceSchema(s, siteUrl),
    {
      "@type": "WebPage",
      "@id": url + "#webpage",
      url,
      name: s.title,
      description: s.problem,
      inLanguage: "ru-RU",
      about: { "@id": url + "#service" },
      breadcrumb: { "@id": url + "#breadcrumb" },
    },
    {
      ...breadcrumbList([
        { name: "Главная", href: "/" },
        { name: "Решения", href: "/solutions" },
        { name: s.title, href: solutionHref(s) },
      ]),
      "@id": url + "#breadcrumb",
    },
  ];
  return (
    <>
      <SolutionPage solution={s} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({ "@context": "https://schema.org", "@graph": graph }),
        }}
      />
    </>
  );
}
