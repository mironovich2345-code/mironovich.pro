/**
 * Switch for the new privacy policy and consent texts (content/legal/*.md).
 *
 * Keep `published: false` until the owner and the lawyer approve the texts and
 * every [УТОЧНИТЬ] is filled. While false, /privacy and /consent keep the
 * current wording and the form keeps the current consent label. Flipping it is
 * guarded at build time by lib/legal.ts.
 *
 * Client-safe: no file system access here (LeadForm reads it).
 */
export const legal = {
  published: false,
  /** Edition date of both documents — must match `edition` in their frontmatter. */
  edition: "2026-11-01",
} as const;

/** Edition recorded with every lead, so it is clear which consent text was accepted. */
export const consentVersion = legal.published ? legal.edition : "прежняя (до " + legal.edition + ")";

/** Checkbox wording per the approved consent; the old one stays until publication. */
export const consentLabel = legal.published
  ? "Даю согласие на обработку персональных данных для ответа на мою заявку"
  : "Я соглашаюсь на обработку персональных данных";
