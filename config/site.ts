import { contactList, contacts, sameAs } from "./contacts.ts";
import { services } from "./services.ts";
import { directions } from "./directions.ts";
import { toolsNavigation } from "./tools.ts";
import { projects } from "../content/projects.ts";
import type { NavLink } from "./routes.ts";
export { contactHref } from "./routes.ts";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mironovich.pro").replace(/\/$/, "");

export const site = {
  name: "MIRONOVICH",
  url: siteUrl,
  tagline: "ИИ для бизнеса · Цифровые решения · Практика для сотрудников",
  person: "Данил Миронович",
  jobTitle: "разработчик цифровых систем и технический партнёр бизнеса",
  title: "ИИ и цифровые решения для бизнеса и сотрудников — MIRONOVICH.PRO",
  description:
    "Помогаю компаниям выбирать и внедрять цифровые решения и ИИ, а сотрудникам — применять ИИ в работе и развивать навыки. Консультации, разработка и внедрение. Данил Миронович.",
  // owner-confirmed, see config/contacts.ts
  instagram: contacts.instagram.href,
  telegram: contacts.telegram.href,
} as const;

/**
 * /projects is linked from navigation, footer and the homepage, listed in the
 * sitemap and indexable only once content/projects.ts has confirmed entries.
 */
export const projectsPublished = projects.length > 0;

export type { NavLink } from "./routes.ts";

/** Service submenu — from the shared service list. */
export const serviceLinks: NavLink[] = services.map((s) => ({ href: s.href, label: s.label }));
export const solutionLinks: NavLink[] = directions.filter(d => d.solution).map(d => ({ href: d.href, label: d.title }));

/**
 * Primary navigation is an audience choice, not a catalog.
 * Portfolio, tools, blog and detailed services remain accessible on their
 * existing pages and through the global footer.
 */
export const navLinks: NavLink[] = [
  { href: "/solutions", label: "Бизнесу" },
  { href: "/products/ai-career", label: "Сотрудникам" },
  { href: "/about", label: "Кто я" },
];

/** Discovery links moved out of the header, retained in the footer. */
export const secondaryLinks: NavLink[] = [
  ...(projectsPublished ? [{ href: "/projects", label: "Кейсы" }] : []),
  ...(toolsNavigation.enabled ? [{ href: toolsNavigation.href, label: toolsNavigation.label }] : []),
  { href: "/services/cto", label: "Внешний CTO" },
  { href: "/blog", label: "Блог" },
];

/** Where «Обсудить задачу» leads from pages without their own form section. */

/**
 * Version appended to favicon URLs (app/layout.tsx → metadata.icons). Browsers keep
 * favicons in their own cache keyed by URL; bump this after changing the icon.
 * "2" = the «M.» mark (graphite, white M, red dot) replacing the old blue M.
 */
export const ICON_VERSION = "2";

/** Public profiles for JSON-LD sameAs — config/contacts.ts. */
export const socialProfiles = sameAs;

/** Direct contacts shown on /contact and in the footer — config/contacts.ts. */
export const confirmedContacts = contactList;
