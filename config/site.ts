import { services } from "./services";
import { projects } from "@/content/projects";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mironovich.pro").replace(/\/$/, "");

/** Raw env socials — only these end up in JSON-LD sameAs, so we never claim a profile that is not set up. */
const envInstagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || "";
const envTelegram = process.env.NEXT_PUBLIC_TELEGRAM_URL?.trim() || "";

export const site = {
  name: "MIRONOVICH",
  url: siteUrl,
  tagline: "Автоматизация · Приложения · Обучение",
  person: "Данил Миронович",
  jobTitle: "специалист по автоматизации бизнес-процессов и разработке цифровых решений",
  title: "Автоматизация процессов и приложения для бизнеса — MIRONOVICH",
  description:
    "Автоматизирую отчётность, интеграции CRM и ручные операции, разрабатываю внутренние приложения и системы обучения сотрудников. Данил Миронович.",
  instagram: envInstagram || "https://instagram.com/mironovich",
  telegram: envTelegram || "https://t.me/mironovich",
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

/** Configured profiles only — used for structured data. */
export const socialProfiles = [envInstagram, envTelegram].filter(Boolean);

/**
 * Direct contacts shown on /contact. Only values set explicitly in the environment
 * count as confirmed; the code defaults above are never listed there.
 */
export const confirmedContacts: { label: string; href: string; text: string }[] = [
  ...(envTelegram ? [{ label: "Telegram", href: envTelegram, text: envTelegram.replace(/^https?:\/\//, "") }] : []),
  ...(envInstagram ? [{ label: "Instagram", href: envInstagram, text: envInstagram.replace(/^https?:\/\//, "") }] : []),
];

/** Telegram deep link used as a fallback when the form cannot be delivered. */
export const telegramFallback = site.telegram;
