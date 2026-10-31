/**
 * The only source of public contact links. Every component (footer, contact
 * page, form fallback, legal pages, JSON-LD sameAs) reads from here.
 *
 * Defaults are the owner-confirmed addresses. NEXT_PUBLIC_TELEGRAM_URL /
 * NEXT_PUBLIC_INSTAGRAM_URL may override them, but only with a well-formed
 * https link on the right host; anything else — including the retired handles
 * — is ignored with a build-time warning and the confirmed default is used.
 */

export type ContactChannel = "telegram" | "instagram";

export type Contact = {
  channel: ContactChannel;
  label: string;
  href: string;
  /** Short form for display, without the scheme */
  text: string;
};

const CONFIRMED: Record<ContactChannel, string> = {
  telegram: "https://t.me/mironovich_pro",
  instagram: "https://www.instagram.com/mironovich.pro/",
};

const RULES: Record<ContactChannel, { hosts: string[]; handle: RegExp }> = {
  telegram: { hosts: ["t.me"], handle: /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/ },
  instagram: { hosts: ["instagram.com", "www.instagram.com"], handle: /^[a-zA-Z0-9._]{1,30}$/ },
};

/** Handles that must never be shown again, whatever the environment says. */
const RETIRED: Record<ContactChannel, string[]> = {
  telegram: ["mironovich"],
  instagram: ["mironovich"],
};

function resolve(channel: ContactChannel, raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return CONFIRMED[channel];
  try {
    const url = new URL(value);
    const handle = url.pathname.replace(/^\/+|\/+$/g, "");
    const rule = RULES[channel];
    const ok =
      url.protocol === "https:" &&
      rule.hosts.includes(url.hostname.toLowerCase()) &&
      rule.handle.test(handle) &&
      !url.search &&
      !url.hash &&
      !RETIRED[channel].includes(handle.toLowerCase());
    if (ok) return value;
  } catch {
    /* fall through */
  }
  console.warn("[contacts] ignoring invalid or retired " + channel + " URL from the environment; using the confirmed default");
  return CONFIRMED[channel];
}

const make = (channel: ContactChannel, label: string, raw: string | undefined): Contact => {
  const href = resolve(channel, raw);
  return { channel, label, href, text: href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") };
};

export const contacts = {
  telegram: make("telegram", "Telegram", process.env.NEXT_PUBLIC_TELEGRAM_URL),
  instagram: make("instagram", "Instagram", process.env.NEXT_PUBLIC_INSTAGRAM_URL),
} as const;

/** In display order. */
export const contactList: Contact[] = [contacts.telegram, contacts.instagram];

/** schema.org sameAs — the owner-confirmed public profiles. */
export const sameAs: string[] = contactList.map((c) => c.href);
