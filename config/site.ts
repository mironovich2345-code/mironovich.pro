export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mironovich.pro").replace(/\/$/, "");

/** Raw env socials — only these end up in JSON-LD sameAs, so we never claim a profile that is not set up. */
const envInstagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || "";
const envTelegram = process.env.NEXT_PUBLIC_TELEGRAM_URL?.trim() || "";

export const site = {
  name: "MIRONOVICH",
  url: siteUrl,
  tagline: "Системы обучения сотрудников × автоматизация × AI",
  ogKicker: "TRAINING SYSTEMS · AUTOMATION · AI",
  ogHeadline: "Системы обучения сотрудников для бизнеса",
  person: "Данил Миронович",
  jobTitle: "специалист по системам обучения сотрудников",
  title: "MIRONOVICH — системы обучения сотрудников для бизнеса",
  description:
    "Системы обучения и адаптации сотрудников: корпоративная академия, база знаний, тестирование, аттестации, контроль прогресса, автоматизация и AI.",
  instagram: envInstagram || "https://instagram.com/mironovich",
  telegram: envTelegram || "https://t.me/mironovich",
} as const;

/** Configured profiles only — used for structured data. */
export const socialProfiles = [envInstagram, envTelegram].filter(Boolean);

/** Telegram deep link used as a fallback when the form cannot be delivered. */
export const telegramFallback = site.telegram;
