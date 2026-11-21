/**
 * AI Career 3.0 sign-in on the main domain. The learning app is a separate service behind the public site's proxy
 * (middleware.ts): /career is its address on mironovich.pro. The sign-in entry is shown only when the proxy is
 * configured (CAREER_APP_UPSTREAM on the site service, read at build/render time on the server), so the public site
 * never links to a dead page and never to the closed demo's address.
 */
export const careerLoginHref = "/career?login=1";
export const careerAppEnabled = () => {
  const u = process.env.CAREER_APP_UPSTREAM ?? "";
  return /^https?:\/\//.test(u) && (process.env.CAREER_PROXY_SECRET ?? "").length >= 32;
};
