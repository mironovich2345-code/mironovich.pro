/** Serialises structured data for an inline <script>; `<` is escaped so text can never close the tag. */
export const jsonLd = (data: unknown): string => JSON.stringify(data).replace(/</g, "\\u003c");
