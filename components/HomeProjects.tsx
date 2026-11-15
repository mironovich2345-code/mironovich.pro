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
    <section
      id="projects"
      className="bg-cream px-[22px] py-16 min-[560px]:py-24"
    >
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel
          index="02"
          label="Кейсы и проекты"
          note="Разрешённые материалы · готовность указана"
          tone="light"
        />
        <h2 className="m-0 mb-5 font-display text-[clamp(30px,5vw,48px)] font-extrabold uppercase leading-[1.05] text-graphite">
          Примеры работы
        </h2>
        <p className="mb-8 max-w-[64ch] text-[15px] leading-relaxed text-graphite/80">
          В кейсах указано, что реализовано и что ещё готовится. Учебные примеры
          на страницах решений используют синтетические данные; это не
          результаты клиентов.
        </p>
        <div
          className={
            "grid gap-8 " +
            (projects.length > 2
              ? "min-[760px]:grid-cols-3"
              : "min-[760px]:grid-cols-2")
          }
        >
          {projects.slice(0, 3).map((p) => (
            <ProjectCard key={p.slug} project={p} compact />
          ))}
        </div>
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
