import type { Metadata } from "next";
import ContactSection from "@/components/ContactSection";
import Faq from "@/components/Faq";
import Hero from "@/components/Hero";
import HomeProjects from "@/components/HomeProjects";
import Services from "@/components/Services";
import StickyCta from "@/components/StickyCta";
import StructuredData from "@/components/StructuredData";
import CtoComparison from "@/components/CtoComparison";
import WorkApproach from "@/components/WorkApproach";
import OtherServices from "@/components/OtherServices";
import { projectsPublished, site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: site.title,
  description: site.description,
  path: "/",
});

// The portfolio registry remains the only source of approved public projects.
export default function Page() {
  return (
    <>
      <main id="main">
        <Hero />
        <Services />
        {projectsPublished && <HomeProjects />}
        <CtoComparison />
        <OtherServices />
        <WorkApproach />
        <Faq index="06" />
        <ContactSection index="07" />
      </main>
      <StickyCta />
      <StructuredData />
    </>
  );
}
