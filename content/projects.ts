import type { ServiceSlug } from "@/config/services";

/**
 * Portfolio. Add an entry only after the owner has confirmed it may be published:
 * no client names, screenshots or numbers without that confirmation.
 *
 * While this list is empty, /projects is noindex, stays out of the sitemap and
 * is not linked from navigation (see projectsPublished in config/site.ts).
 */

export type ProjectStatus = "done" | "in_progress" | "demo";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; hint: string }[] = [
  { value: "done", label: "Реализовано", hint: "Решение запущено и используется." },
  { value: "in_progress", label: "В разработке", hint: "Работа идёт сейчас — указан текущий этап, а не обещанный итог." },
  { value: "demo", label: "Демонстрация", hint: "Сделано для показа подхода, не для клиента." },
];

export type Project = {
  /** URL of the case page: /projects/<slug> — latin, lowercase, hyphens */
  slug: string;
  title: string;
  status: ProjectStatus;
  direction: ServiceSlug;
  /** Sphere of business without the client's name, e.g. «Сеть фитнес-клубов» */
  context?: string;
  task: string;
  built: string;
  /** Only when relevant and confirmed */
  tech?: string[];
  /** Current stage — for in_progress */
  stage?: string;
  /** Only a confirmed result; omit otherwise and nothing is shown */
  result?: string;
  /** Live demo link — for demos only */
  demoUrl?: string;
  /** Optional detailed case; when present, /projects/<slug> is generated */
  caseStudy?: { publishDate: string; sections: { heading: string; text: string }[] };
};

export const projects: Project[] = [];

export const projectsWithCase = () => projects.filter((p) => p.caseStudy);
export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug);
