import ProjectCard from "./ProjectCard";
import { PROJECT_STATUSES, type Project } from "@/content/projects";

/** Projects grouped into Реализовано / В разработке / Демонстрация; empty groups are skipped. */
export default function ProjectsByStatus({ projects, limit }: { projects: Project[]; limit?: number }) {
  const groups = PROJECT_STATUSES.map((s) => ({ ...s, items: projects.filter((p) => p.status === s.value).slice(0, limit) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div className="flex flex-col gap-16">
      {groups.map((g) => (
        <div key={g.value} id={"status-" + g.value}>
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="m-0 font-display text-[clamp(26px,4vw,40px)] font-extrabold uppercase leading-[1.05] tracking-[-0.015em] text-graphite">
              {g.label}
            </h2>
            <p className="m-0 text-[13px] text-graphite/65">{g.hint}</p>
          </div>
          <div className="grid grid-cols-1 gap-x-12 min-[860px]:grid-cols-2">
            {g.items.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
