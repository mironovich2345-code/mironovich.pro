import { services } from "./services";

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
 * /projects is linked from the hero, navigation and footer only once it has
 * confirmed material. Until then nothing points at an empty page.
 */
export const projectsPublished = false;

export type NavLink = { href: string; label: string };

/** Service submenu — from the shared service list. */
export const serviceLinks: NavLink[] = services.map((s) => ({ href: s.href, label: s.label }));

/** Top-level links after the «Услуги» group. */
export const navLinks: NavLink[] = [
  ...(projectsPublished ? [{ href: "/projects", label: "Проекты" }] : []),
  { href: "/about", label: "Обо мне" },
  { href: "/blog", label: "Блог" },
];

/** Where every «Обсудить задачу» CTA leads. Becomes /contact when that page ships. */
export const contactHref = "/#contact";

/** Configured profiles only — used for structured data. */
export const socialProfiles = [envInstagram, envTelegram].filter(Boolean);

/** Telegram deep link used as a fallback when the form cannot be delivered. */
export const telegramFallback = site.telegram;
