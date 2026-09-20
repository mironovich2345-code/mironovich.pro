export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mironovich.pro").replace(/\/$/, "");

/** Raw env socials — only these end up in JSON-LD sameAs, so we never claim a profile that is not set up. */
const envInstagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || "";
const envTelegram = process.env.NEXT_PUBLIC_TELEGRAM_URL?.trim() || "";

export const site = {
  name: "MIRONOVICH",
  url: siteUrl,
  tagline: "Digital products × AI × Business",
  ogHeadline: "Разбираю бизнес-процессы и превращаю их в цифровые продукты",
  person: "Данил Миронович",
  jobTitle: "специалист по цифровым продуктам и автоматизации бизнеса",
  title: "MIRONOVICH — автоматизация, AI и цифровые продукты для бизнеса",
  description:
    "Разработка внутренних приложений, систем обучения сотрудников, автоматизации бизнес-процессов и AI-инструментов для компаний.",
  instagram: envInstagram || "https://instagram.com/mironovich",
  telegram: envTelegram || "https://t.me/mironovich",
} as const;

/** Configured profiles only — used for structured data. */
export const socialProfiles = [envInstagram, envTelegram].filter(Boolean);

/** Telegram deep link used as a fallback when the form cannot be delivered. */
export const telegramFallback = site.telegram;
