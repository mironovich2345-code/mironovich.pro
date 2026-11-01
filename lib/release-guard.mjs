// Production release guard — runs at the start of `next build` (next.config.mjs)
// and as `npm run release:check`.
//
// It refuses a PRODUCTION build that would ship outdated or unfinished legal
// texts, or analytics that do not match the privacy policy. Staging, preview and
// local builds are never blocked: they only get the same report as warnings.
//
// Passing this check is a TECHNICAL precondition only. It does not mean the texts
// are legally approved — that decision is recorded in docs/release/go-no-go.md.
//
// Plain JavaScript on purpose: next.config.mjs cannot import TypeScript.

import fs from "node:fs";
import path from "node:path";

/** Origins that mean "this build is the public site". */
export const PRODUCTION_ORIGINS = ["https://mironovich.pro", "https://www.mironovich.pro"];

/** Any bracketed note written in capitals — [УТОЧНИТЬ …], [ОПИСАТЬ …] — or ⟦…⟧. Shared with lib/legal.ts. */
export const PLACEHOLDER_SOURCE = String.raw`\[[А-ЯЁA-Z][А-ЯЁA-Z ]{3,}[^\]]*\]|⟦[^⟧]*⟧`;

/** Every placeholder occurrence, in order (the same note may appear twice). */
export function allPlaceholders(text) {
  return text.match(new RegExp(PLACEHOLDER_SOURCE, "g")) ?? [];
}

/** Distinct placeholders. */
export function findPlaceholders(text) {
  return [...new Set(allPlaceholders(text))];
}

/** Same validation as lib/analytics.ts / next.config.mjs. */
export const METRICA_ID = /^\d{5,12}$/;

const norm = (v) => (v ?? "").trim();
const origin = (url) => norm(url).replace(/\/+$/, "").toLowerCase();

/** Same default as config/site.ts: a build without NEXT_PUBLIC_SITE_URL IS a build of the public site. */
export const DEFAULT_SITE_URL = "https://mironovich.pro";

/**
 * Fail-closed: every build is a production release unless it explicitly says
 * otherwise. A build counts as non-production only when BOTH hold:
 * - NEXT_PUBLIC_SITE_URL is set to an address other than the public domain
 *   (staging: *.up.railway.app, local: http://localhost:3000);
 * - Railway, if it passed its environment name into the build, does not call
 *   it production (RAILWAY_ENVIRONMENT_NAME, or the older RAILWAY_ENVIRONMENT).
 * So variables missing at build time cannot turn a production build into an
 * unchecked one: without a site URL the build bakes in the public domain and is
 * checked like production.
 */
export function releaseTarget(env) {
  const railway = norm(env.RAILWAY_ENVIRONMENT_NAME) || norm(env.RAILWAY_ENVIRONMENT);
  const explicit = norm(env.NEXT_PUBLIC_SITE_URL);
  const site = origin(explicit || DEFAULT_SITE_URL);
  const railwayNote = "RAILWAY_ENVIRONMENT_NAME=" + (railway || "не передана в сборку");
  if (railway.toLowerCase() === "production") return { production: true, reason: railwayNote };
  if (PRODUCTION_ORIGINS.includes(site)) {
    return { production: true, reason: (explicit ? "NEXT_PUBLIC_SITE_URL=" + site : "NEXT_PUBLIC_SITE_URL не задан → " + site) + "; " + railwayNote };
  }
  return { production: false, reason: "NEXT_PUBLIC_SITE_URL=" + site + "; " + railwayNote };
}

function frontmatter(raw) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw.replace(/\r\n/g, "\n"));
  if (!m) return { meta: {}, body: raw };
  const meta = Object.fromEntries(
    m[1].split("\n").filter((l) => l.includes(":")).map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]),
  );
  return { meta, body: m[2] };
}

/**
 * Pure check. `legal` is config/legal.json, `docs` maps slug → raw markdown.
 * Returns problems; the caller decides whether they block (production) or not.
 */
export function checkRelease({ env, legal, docs }) {
  const errors = [];
  const warnings = [];

  // 1. Legal texts: the new, filled-in edition must be switched on
  if (legal.published !== true) {
    errors.push(
      "Новые политика и согласие не опубликованы (config/legal.json: published=false). " +
        "Production-релиз со старыми текстами запрещён — docs/release/go-no-go.md, «Правило».",
    );
  }
  for (const [slug, raw] of Object.entries(docs)) {
    const { meta, body } = frontmatter(raw);
    const left = allPlaceholders(body);
    if (left.length) errors.push(`content/legal/${slug}.md: незаполненные поля (${left.length}): ${left.join(" · ")}`);
    if (meta.edition !== legal.edition) {
      errors.push(`content/legal/${slug}.md: edition ${meta.edition ?? "—"} не совпадает с config/legal.json (${legal.edition})`);
    }
  }
  if (norm(env.LEGAL_PREVIEW) === "1") errors.push("LEGAL_PREVIEW=1 — проекты документов с пометкой «Проект» не для production");
  if (norm(env.SITE_NOINDEX) === "1") errors.push("SITE_NOINDEX=1 — production закрыт от поисковиков");

  // 2. Rate limit: which header (if any) identifies a client — docs/release/rate-limit.md
  const ipSource = norm(env.RATE_LIMIT_CLIENT_IP).toLowerCase();
  if (ipSource && ipSource !== "x-real-ip" && ipSource !== "x-forwarded-for") {
    errors.push(`RATE_LIMIT_CLIENT_IP="${env.RATE_LIMIT_CLIENT_IP}" — допустимо только x-real-ip, x-forwarded-for или пусто`);
  }
  if (!ipSource) {
    warnings.push("RATE_LIMIT_CLIENT_IP не задан — лимит по IP выключен, действует только общий лимит 10 заявок/мин (безопасный режим до проверки на staging)");
  }

  // 3. Analytics ↔ privacy policy. Only Yandex Metrica exists; it always waits
  //    for consent in code (lib/consent.ts), so no variable can turn that off.
  const rawYm = norm(env.NEXT_PUBLIC_YANDEX_METRICA_ID);
  if (rawYm && !METRICA_ID.test(rawYm)) errors.push("NEXT_PUBLIC_YANDEX_METRICA_ID задан в неверном формате — Метрика молча не загрузится");
  const ym = METRICA_ID.test(rawYm);
  const policy = docs.privacy ? frontmatter(docs.privacy).body : "";
  const consentText = docs.consent ? frontmatter(docs.consent).body : "";
  const mentionsYm = /Яндекс[ .]?Метрик/i.test(policy);
  if (ym && !mentionsYm) errors.push("Метрика включена, но политика её не называет");
  if (!ym && mentionsYm) warnings.push("Политика называет Яндекс Метрику, а счётчик не задан — проверьте текст");
  // GA4 was removed for good: the published texts must not promise or describe it
  for (const [slug, body] of [["privacy", policy], ["consent", consentText]]) {
    if (/Google Analytics|\bGA4\b|googletagmanager|\b_ga\b|_ga\*/i.test(body)) {
      errors.push(`content/legal/${slug}.md упоминает Google Analytics / GA4, который на сайте отключён`);
    }
  }
  // leftovers in Railway: harmless (the code no longer reads them), reported so they can be cleaned up
  if (norm(env.NEXT_PUBLIC_GA_ID)) warnings.push("NEXT_PUBLIC_GA_ID задан, но больше не используется (GA4 отключён) — можно удалить из Railway");
  if (norm(env.NEXT_PUBLIC_ANALYTICS_CONSENT)) {
    warnings.push("NEXT_PUBLIC_ANALYTICS_CONSENT больше не используется — согласие на Метрику обязательно всегда; переменную можно удалить");
  }

  return { errors, warnings };
}

/** Reads the repository and the environment, prints a report, throws if a production build must stop. */
export function runReleaseGuard({ cwd = process.cwd(), env = process.env, forceProduction = false, log = console } = {}) {
  const target = forceProduction ? { production: true, reason: "--production" } : releaseTarget(env);
  const legal = JSON.parse(fs.readFileSync(path.join(cwd, "config", "legal.json"), "utf8"));
  const docs = Object.fromEntries(
    ["privacy", "consent"].map((slug) => [slug, fs.readFileSync(path.join(cwd, "content", "legal", slug + ".md"), "utf8")]),
  );
  const { errors, warnings } = checkRelease({ env, legal, docs });
  const tag = "[release-guard]";
  log.log(`${tag} цель сборки: ${target.production ? "PRODUCTION" : "не production"} (${target.reason})`);

  if (!target.production) {
    if (errors.length || warnings.length) {
      log.warn(`${tag} не production (${target.reason}) — сборка не блокируется. Для production-релиза осталось:`);
      for (const e of [...errors, ...warnings]) log.warn(`${tag}   · ${e}`);
    }
    return { ...target, errors, warnings, blocked: false };
  }

  for (const w of warnings) log.warn(`${tag} предупреждение: ${w}`);
  if (errors.length) {
    const message =
      `${tag} production-сборка остановлена (${target.reason}):\n` +
      errors.map((e) => "  · " + e).join("\n") +
      "\nИсправьте пункты выше. Обойти проверку нельзя — см. docs/release/release-guard.md.";
    return { ...target, errors, warnings, blocked: true, message };
  }
  log.log(`${tag} технические условия production-релиза выполнены (${target.reason}). Это не юридическое одобрение — см. docs/release/go-no-go.md.`);
  return { ...target, errors, warnings, blocked: false };
}
