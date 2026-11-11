import type { Metadata } from "next";
import About from "@/components/About";
import ContactSection from "@/components/ContactSection";
import Diagnostics from "@/components/Diagnostics";
import Faq from "@/components/Faq";
import Hero from "@/components/Hero";
import HomeProjects from "@/components/HomeProjects";
import Problems from "@/components/Problems";
import Process from "@/components/Process";
import Scenarios from "@/components/Scenarios";
import Services from "@/components/Services";
import StickyCta from "@/components/StickyCta";
import StructuredData from "@/components/StructuredData";
import { projectsPublished, site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: site.title, description: site.description, path: "/" });

// The projects block appears between Diagnostics and About once content/projects.ts
// has confirmed entries (config/site.ts → projectsPublished).
export default function Page() {
  return (
    <>
      <main id="main">
        <Hero />
        <Problems />
        <Services />
        <Scenarios />
        <Diagnostics />
        {projectsPublished && <HomeProjects />}
        <About index={projectsPublished ? "06" : "05"} />
        <Process index={projectsPublished ? "07" : "06"} />
        <Faq index={projectsPublished ? "08" : "07"} />
        <ContactSection index={projectsPublished ? "09" : "08"} />
      </main>
      <StickyCta />
      <StructuredData />
    </>
  );
}
