import Link from "next/link";
import ProjectCard from "./ProjectCard";
import SectionLabel from "./SectionLabel";
import { projects } from "@/content/projects";

/**
 * Homepage teaser of the portfolio — rendered only when projectsPublished is true.
 * Homepage numbering follows projectsPublished in app/page.tsx.
 */
export default function HomeProjects() {
  return (
    <section id="projects" className="bg-cream px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel index="05" label="Продукты и проекты" note="Реализовано · В разработке · Демонстрация" tone="light" />
        <div className={"grid gap-8 " + (projects.length > 2 ? "min-[760px]:grid-cols-3" : "min-[760px]:grid-cols-2")}>{projects.slice(0, 3).map(p=><ProjectCard key={p.slug} project={p} compact/>)}</div>
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
