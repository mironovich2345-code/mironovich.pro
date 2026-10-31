import { contactList, contacts, sameAs } from "./contacts";
import { services } from "./services";
import { projects } from "@/content/projects";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mironovich.pro").replace(/\/$/, "");

export const site = {
  name: "MIRONOVICH",
  url: siteUrl,
  tagline: "Автоматизация · Приложения · Обучение",
  person: "Данил Миронович",
  jobTitle: "специалист по автоматизации бизнес-процессов и разработке цифровых решений",
  title: "Автоматизация процессов и приложения для бизнеса — MIRONOVICH",
  description:
    "Автоматизирую отчётность, интеграции CRM и ручные операции, разрабатываю внутренние приложения и системы обучения сотрудников. Данил Миронович.",
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
  ...(projectsPublished ? [{ href: "/projects", label: "Проекты" }] : []),
  { href: "/about", label: "Обо мне" },
  { href: "/blog", label: "Блог" },
];

/** Where «Обсудить задачу» leads from pages without their own form section. */
export const contactHref = "/contact";

/** Public profiles for JSON-LD sameAs — config/contacts.ts. */
export const socialProfiles = sameAs;

/** Direct contacts shown on /contact and in the footer — config/contacts.ts. */
export const confirmedContacts = contactList;
