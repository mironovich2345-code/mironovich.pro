import Link from "next/link";
import Image from "next/image";
import { serviceBySlug } from "@/config/services";
import { PROJECT_STATUSES, type Project } from "@/content/projects";

const statusClass: Record<Project["status"], string> = {
  done: "bg-signal text-white",
  in_progress: "border border-graphite text-graphite",
  demo: "border border-dashed border-graphite text-graphite",
};

/** One portfolio entry. Rows without confirmed data (tech, result, stage) are simply not rendered. */
export default function ProjectCard({ project, compact = false }: { project: Project; compact?: boolean }) {
  const status = PROJECT_STATUSES.find((s) => s.value === project.status)!;
  const service = serviceBySlug(project.direction);
  const rows: [string, string | undefined][] = [
    ["Задача", project.task],
    ["Что разработано", project.built],
    ["Текущий этап", project.stage],
    ["Технологии", project.tech?.join(", ")],
    ["Результат", project.result],
  ];

  return (
    <article className="flex flex-col gap-5 border-t-2 border-graphite py-8">
      {project.image?.approved && project.image.src && <Image src={project.image.src} alt={project.image.alt} width={960} height={600} className={compact ? "h-[240px] w-full bg-white object-contain" : "max-h-[680px] w-full object-contain"}/>}
      {!compact && project.image?.approved && project.image.caption && <p className="m-0 text-sm leading-relaxed text-graphite/70">{project.image.caption}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <span className={"inline-flex px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.12em] " + statusClass[project.status]}>
          {status.label}
        </span>
        <Link href={service.href} className="text-[12px] uppercase tracking-[0.14em] text-graphite/65 hover:text-maroon">
          {service.label}
        </Link>
      </div>
      <div>
        {project.context && <p className="m-0 mb-2 text-[13px] uppercase tracking-[0.12em] text-graphite/65">{project.context}</p>}
        <h3 className="m-0 text-balance font-display text-[clamp(22px,3vw,30px)] font-extrabold uppercase leading-[1.08] tracking-[-0.01em] text-graphite">
          {project.title}
        </h3>
      </div>
      <dl className="m-0 grid gap-4">
        {rows
          .filter((r): r is [string, string] => Boolean(r[1]) && (!compact || r[0] === "Задача"))
          .map(([k, v]) => (
            <div key={k}>
              <dt className="mb-1 text-[11px] uppercase tracking-[0.16em] text-maroon">{k}</dt>
              <dd className="m-0 max-w-[60ch] text-pretty text-[15px] leading-[1.6] text-graphite/80">{v}</dd>
            </div>
          ))}
      </dl>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {project.caseStudy && (
          <Link href={"/projects/" + project.slug} className="inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.1em] text-maroon underline underline-offset-4 hover:text-signal">
            Подробный разбор →
          </Link>
        )}
        {project.demoUrl && (
          <a href={project.demoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.1em] text-maroon underline underline-offset-4 hover:text-signal">
            Открыть демо →
          </a>
        )}
      </div>
    </article>
  );
}
