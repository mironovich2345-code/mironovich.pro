/** Client-safe navigation primitives. Do not import the server's portfolio registry here. */
export const contactHref = "/contact";
export type NavLink = { href: string; label: string };

/** Shared desktop and mobile audience groups; routes remain stable. */
export type HeaderNavGroup = { id: "business" | "employees" | "about"; label: string; links: readonly NavLink[] };
