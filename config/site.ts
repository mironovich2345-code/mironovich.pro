import { contactList, contacts, sameAs } from "./contacts";
import { services } from "./services";
import { directions } from "./directions";
import { toolsNavigation } from "./tools";
import { projects } from "@/content/projects";
import type { NavLink } from "./routes";
export { contactHref } from "./routes";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mironovich.pro").replace(/\/$/, "");

export const site = {
  name: "MIRONOVICH",
  url: siteUrl,
  tagline: "Цифровые системы · Разработка · Внедрение",
  person: "Данил Миронович",
  jobTitle: "разработчик цифровых систем и технический партнёр бизнеса",
  title: "Цифровые системы для сотрудников, продаж и филиалов — MIRONOVICH.PRO",
  description:
    "Корпоративная академия, KPI и мотивация, управленческая аналитика, стандарты филиалов и ИИ для работы с клиентами. Разработка и внедрение. Данил Миронович.",
  // owner-confirmed, see config/contacts.ts
  instagram: contacts.instagram.href,
  telegram: contacts.telegram.href,
} as const;

/**
 * /projects is linked from navigation, footer and the homepage, listed in the
 * sitemap and indexable only once content/projects.ts has confirmed entries.
 */
export const projectsPublished = projects.length > 0;

export type { NavLink } from "./routes";

/** Service submenu — from the shared service list. */
export const serviceLinks: NavLink[] = services.map((s) => ({ href: s.href, label: s.label }));
export const solutionLinks: NavLink[] = directions.filter(d => d.solution).map(d => ({ href: d.href, label: d.title }));

/** Top-level links after the «Услуги» group. */
export const navLinks: NavLink[] = [
  ...(projectsPublished ? [{ href: "/projects", label: "Кейсы" }] : []),
  ...(toolsNavigation.enabled ? [{ href: toolsNavigation.href, label: toolsNavigation.label }] : []),
  { href: "/services/cto", label: "Внешний CTO" },
  { href: "/blog", label: "Блог" },
  { href: "/about", label: "Обо мне" },
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
