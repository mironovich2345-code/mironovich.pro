import { contactList, contacts, sameAs } from "./contacts";
import { services } from "./services";
import { toolsNavigation } from "./tools";
import { projects } from "@/content/projects";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mironovich.pro").replace(/\/$/, "");

export const site = {
  name: "MIRONOVICH",
  url: siteUrl,
  tagline: "Внешний CTO · Разработка · Сопровождение",
  person: "Данил Миронович",
  jobTitle: "внешний технологический директор и технический партнёр бизнеса",
  title: "Внешний технологический директор для бизнеса — MIRONOVICH",
  description:
    "Помогаю бизнесу выбирать, внедрять и сопровождать технологии. Внешний CTO, разработка, техническое сопровождение и экспертиза. Данил Миронович.",
  // owner-confirmed, see config/contacts.ts
  instagram: contacts.instagram.href,
  telegram: contacts.telegram.href,
} as const;

/**
 * /projects is linked from navigation, footer and the homepage, listed in the
 * sitemap and indexable only once content/projects.ts has confirmed entries.
 */
export const projectsPublished = projects.length > 0;

export type NavLink = { href: string; label: string };

/** Service submenu — from the shared service list. */
export const serviceLinks: NavLink[] = services.map((s) => ({ href: s.href, label: s.label }));

/** Top-level links after the «Услуги» group. */
export const navLinks: NavLink[] = [
  { href: "/products", label: "Продукты" },
  ...(projectsPublished ? [{ href: "/projects", label: "Проекты" }] : []),
  ...(toolsNavigation.enabled ? [{ href: toolsNavigation.href, label: toolsNavigation.label }] : []),
  { href: "/blog", label: "Блог" },
  { href: "/about", label: "Обо мне" },
];

/** Where «Обсудить задачу» leads from pages without their own form section. */
export const contactHref = "/contact";

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
