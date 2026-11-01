import data from "./legal.json";

/**
 * Switch for the new privacy policy and consent texts (content/legal/*.md).
 * The values live in config/legal.json so the build-time release guard
 * (lib/release-guard.mjs, run from next.config.mjs) reads the same switch.
 *
 * Keep `published: false` until the owner and the lawyer approve the texts and
 * every [УТОЧНИТЬ] is filled. While false, /privacy and /consent keep the
 * current wording and the form keeps the current consent label. Flipping it is
 * guarded at build time by lib/legal.ts; a production build with `false` is
 * refused by the release guard.
 *
 * Client-safe: no file system access here (LeadForm reads it).
 */
export const legal: { readonly published: boolean; readonly edition: string } = {
  published: data.published,
  /** Edition date of both documents — must match `edition` in their frontmatter. */
  edition: data.edition,
};

/** Edition recorded with every lead, so it is clear which consent text was accepted. */
export const consentVersion = legal.published ? legal.edition : "прежняя (до " + legal.edition + ")";

/** Checkbox wording per the approved consent; the old one stays until publication. */
export const consentLabel = legal.published
  ? "Даю согласие на обработку персональных данных для ответа на мою заявку"
  : "Я соглашаюсь на обработку персональных данных";
