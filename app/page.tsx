import Hero from "@/components/Hero";
import Pains from "@/components/Pains";
import Services from "@/components/Services";
import Shift from "@/components/Shift";
import About from "@/components/About";
import CaseStudy from "@/components/CaseStudy";
import Process from "@/components/Process";
import FirstReview from "@/components/FirstReview";
import LeadForm from "@/components/LeadForm";
import SecondaryCta from "@/components/SecondaryCta";
import Faq from "@/components/Faq";
import StickyCta from "@/components/StickyCta";
import StructuredData from "@/components/StructuredData";

export default function Page() {
  return (
    <>
      <main>
        <Hero />
        <Pains />
        <Services />
        <Shift />
        <CaseStudy />
        <About />
        <Process />
        <FirstReview />
        <LeadForm />
        <Faq />
        <SecondaryCta />
      </main>
      <StickyCta />
      <StructuredData />
    </>
  );
}
