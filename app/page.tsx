import type { Metadata } from "next";
import About from "@/components/About";
import ContactSection from "@/components/ContactSection";
import Diagnostics from "@/components/Diagnostics";
import Faq from "@/components/Faq";
import Hero from "@/components/Hero";
import Problems from "@/components/Problems";
import Process from "@/components/Process";
import Scenarios from "@/components/Scenarios";
import Services from "@/components/Services";
import StickyCta from "@/components/StickyCta";
import StructuredData from "@/components/StructuredData";
import { site } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: site.title, description: site.description, path: "/" });

// The projects block joins between Diagnostics and About once there is
// confirmed material to show (config/site.ts → projectsPublished).
export default function Page() {
  return (
    <>
      <main id="main">
        <Hero />
        <Problems />
        <Services />
        <Scenarios />
        <Diagnostics />
        <About />
        <Process />
        <Faq />
        <ContactSection />
      </main>
      <StickyCta />
      <StructuredData />
    </>
  );
}
