import Link from "next/link";
import ProjectsByStatus from "./ProjectsByStatus";
import SectionLabel from "./SectionLabel";
import { projects } from "@/content/projects";

/**
 * Homepage teaser of the portfolio — rendered only when projectsPublished is true.
 * When it goes live, renumber the section labels that follow it on the homepage.
 */
export default function HomeProjects() {
  return (
    <section id="projects" className="bg-cream px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel index="05" label="Проекты" note="Реализовано · В разработке · Демонстрация" tone="light" />
        <ProjectsByStatus projects={projects} limit={2} />
        <Link
          href="/projects"
          className="mt-12 inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.1em] text-maroon underline underline-offset-4 hover:text-signal"
        >
          Все проекты →
        </Link>
      </div>
    </section>
  );
}
