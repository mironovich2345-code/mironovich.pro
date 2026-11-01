// Production release guard — runs at the start of `next build` (next.config.mjs)
// and as `npm run release:check`.
//
// It refuses a PRODUCTION build that would ship outdated or unfinished legal
// texts, or analytics that do not match the consent banner. Staging, preview and
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
export const GA_ID = /^G-[A-Z0-9]{4,20}$/;

const norm = (v) => (v ?? "").trim();
const origin = (url) => norm(url).replace(/\/+$/, "").toLowerCase();

/**
 * A build is a production release when Railway says so (RAILWAY_ENVIRONMENT_NAME,
 * available to builds with Railway's default builder) or when the site URL baked
 * into the build is the public domain. Either signal is enough: a missing Railway
 * variable must not let a production build through.
 */
export function releaseTarget(env) {
  const railway = norm(env.RAILWAY_ENVIRONMENT_NAME);
  if (railway === "production") return { production: true, reason: "RAILWAY_ENVIRONMENT_NAME=production" };
  const site = origin(env.NEXT_PUBLIC_SITE_URL);
  if (PRODUCTION_ORIGINS.includes(site)) return { production: true, reason: "NEXT_PUBLIC_SITE_URL=" + site };
  return {
    production: false,
    reason: railway ? "Railway environment «" + railway + "»" : site ? "site URL " + site : "local build (no site URL)",
  };
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

  // 2. Analytics ↔ cookie consent ↔ privacy policy
  const consent = norm(env.NEXT_PUBLIC_ANALYTICS_CONSENT);
  if (consent !== "" && consent !== "required") {
    errors.push(`NEXT_PUBLIC_ANALYTICS_CONSENT="${consent}" — допустимо только пусто или required`);
  }
  const rawYm = norm(env.NEXT_PUBLIC_YANDEX_METRICA_ID);
  const rawGa = norm(env.NEXT_PUBLIC_GA_ID);
  if (rawYm && !METRICA_ID.test(rawYm)) errors.push("NEXT_PUBLIC_YANDEX_METRICA_ID задан в неверном формате — Метрика молча не загрузится");
  if (rawGa && !GA_ID.test(rawGa)) errors.push("NEXT_PUBLIC_GA_ID задан в неверном формате (нужно G-…) — GA4 молча не загрузится");
  const ym = METRICA_ID.test(rawYm);
  const ga = GA_ID.test(rawGa);
  if ((ym || ga) && consent !== "required") {
    errors.push("Счётчики аналитики заданы, а NEXT_PUBLIC_ANALYTICS_CONSENT≠required — аналитика загрузится без согласия, вопреки политике");
  }
  if (consent === "required" && !ym && !ga) {
    warnings.push("NEXT_PUBLIC_ANALYTICS_CONSENT=required, но ни одного счётчика нет — баннер не появится (нечего разрешать)");
  }
  const policy = docs.privacy ? frontmatter(docs.privacy).body : "";
  const mentionsYm = /Яндекс[ .]?Метрик/i.test(policy);
  const mentionsGa = /Google Analytics/i.test(policy);
  if (ym && !mentionsYm) errors.push("Метрика включена, но политика её не называет");
  if (ga && !mentionsGa) errors.push("GA4 включён, но политика его не называет");
  if (!ym && mentionsYm) warnings.push("Политика называет Яндекс Метрику, а счётчик не задан — проверьте текст");
  if (!ga && mentionsGa) warnings.push("Политика называет Google Analytics, а GA4 не задан — проверьте текст (решение по GA4 — у юриста)");

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
