import type { ServiceSlug } from "@/config/services";

export type Item = { title: string; body: string };

/** The block only this page has — keeps the service pages from reading as clones. */
export type UniqueBlock =
  | { kind: "limits"; label: string; title: string; intro: string; items: Item[] }
  | {
      kind: "compare";
      label: string;
      title: string;
      intro: string;
      rows: { criterion: string; ready: string; custom: string }[];
      conclusion: string;
    }
  | { kind: "shift"; label: string; title: string; rows: [string, string][] };

/** Order of the body sections; hero first and the form last are fixed. */
export type SectionKey = "definition" | "outcomes" | "tasks" | "scenarios" | "unique" | "process" | "start" | "faq" | "related";

export type ServicePageContent = {
  slug: ServiceSlug;
  seo: { title: string; description: string };
  h1: string;
  offer: string;
  /** Oversized background word in the hero */
  ghost: string;
  heroTone: "dark" | "maroon";
  definition: { term: string; text: string };
  audience: string[];
  outcomes: { label: string; title: string; items: Item[] };
  tasks: { label: string; title: string; layout: "list" | "grid" | "route"; items: Item[]; note?: string };
  scenarios: { title: string; intro: string; items: { steps: string[]; change: string }[] };
  unique: UniqueBlock;
  process: { title: string; items: Item[] };
  costFactors: string[];
  engagement?: { title: string; body: string; note: string };
  specialisations?: ServiceSlug[];
  faq: [string, string][];
  /** Article slugs; only published ones are rendered */
  relatedArticles?: string[];
  form: { title: string; lead: string };
  sections: SectionKey[];
};
