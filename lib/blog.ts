import fs from "node:fs";
import path from "node:path";
import { readImage, type ImageInfo } from "./image-size";
import { blogCategories, categoryBySlug, isCategorySlug, type CategorySlug } from "@/config/blog";
import { isServiceSlug, type ServiceSlug } from "@/config/services";
import { parseMarkdown, plainWordCount, type Block } from "./markdown";

/**
 * Blog storage: one Markdown file per article in content/blog/. Read at build time
 * only — pages are prerendered, so nothing here runs per request in production.
 * Format and workflow: content/blog/README.md.
 */

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const WORDS_PER_MINUTE = 200;

export type PostStatus = "draft" | "published";

export type Post = {
  slug: string;
  /** H1 of the article page */
  title: string;
  /** <title> without the site suffix, when it should differ from the H1; defaults to title */
  seoTitle?: string;
  /** <meta description> and JSON-LD description */
  description: string;
  /** Short text for the /blog list; falls back to description */
  excerpt: string;
  /** One of config/blog.ts */
  category: CategorySlug;
  /** Service the article links to: frontmatter `service`, otherwise the category's */
  service: ServiceSlug | null;
  /** Slugs from frontmatter `related` — shown first in «Читать по теме» */
  related: string[];
  /** YYYY-MM-DD */
  publishDate: string;
  /** YYYY-MM-DD, only when the article was actually revised */
  updatedDate?: string;
  /** Minutes — from frontmatter, otherwise estimated from the text */
  readingTime: number;
  status: PostStatus;
  /** Preview on /blog and the Open Graph image; falls back to the site image when absent */
  cover?: ImageInfo & { alt: string };
  /** Tie-break among articles with the same publishDate: lower comes first */
  order?: number;
  /** Raw Markdown body */
  content: string;
  blocks: Block[];
};

const KEYS = [
  "title", "description", "slug", "publishDate", "updatedDate",
  "category", "readingTime", "excerpt", "status", "coverImage", "coverImageAlt", "order", "seoTitle",
  "service", "related",
] as const;
type Key = (typeof KEYS)[number];

const REQUIRED: Key[] = ["title", "description", "slug", "publishDate", "category", "status"];

function isRealDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function unquote(v: string): string {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v) as string;
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

function readPost(file: string): Post {
  const fail = (msg: string) => new Error("[blog] content/blog/" + file + ": " + msg);

  const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) throw fail("в начале файла нужен блок frontmatter между строками ---");

  const meta: Partial<Record<Key, string>> = {};
  for (const line of match[1].split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const at = line.indexOf(":");
    if (at === -1) throw fail("строка frontmatter без «:» — «" + line + "»");
    const key = line.slice(0, at).trim();
    if (!(KEYS as readonly string[]).includes(key)) {
      throw fail("неизвестное поле «" + key + "». Допустимые: " + KEYS.join(", "));
    }
    meta[key as Key] = unquote(line.slice(at + 1).trim());
  }

  for (const key of REQUIRED) {
    if (!meta[key]) throw fail("не заполнено обязательное поле «" + key + "»");
  }

  const slug = meta.slug!;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw fail("slug «" + slug + "» — только латиница в нижнем регистре, цифры и дефисы");
  }
  // /blog/category/... is a section of its own
  if (slug === "category") throw fail("slug «category» зарезервирован");

  const category = meta.category!;
  if (!isCategorySlug(category)) {
    throw fail("category «" + category + "» — нужен один из: " + blogCategories.map((c) => c.slug).join(", "));
  }
  let service: ServiceSlug | null = categoryBySlug(category).service;
  if (meta.service) {
    if (meta.service !== "none" && !isServiceSlug(meta.service)) throw fail("service — slug опубликованной услуги или none");
    service = meta.service === "none" ? null : (meta.service as ServiceSlug);
  }
  const related = (meta.related ?? "").split(",").map((r) => r.trim()).filter(Boolean);

  const status = meta.status!;
  if (status !== "draft" && status !== "published") throw fail("status — draft или published, сейчас «" + status + "»");

  const publishDate = meta.publishDate!;
  if (!isRealDate(publishDate)) throw fail("publishDate «" + publishDate + "» — нужен формат ГГГГ-ММ-ДД");
  const updatedDate = meta.updatedDate || undefined;
  if (updatedDate) {
    if (!isRealDate(updatedDate)) throw fail("updatedDate «" + updatedDate + "» — нужен формат ГГГГ-ММ-ДД");
    if (updatedDate < publishDate) throw fail("updatedDate раньше publishDate");
  }

  const content = match[2].trim();
  if (!content) throw fail("у статьи пустой текст");

  let readingTime = Math.max(1, Math.round(plainWordCount(content) / WORDS_PER_MINUTE));
  if (meta.readingTime) {
    const n = Number(meta.readingTime);
    if (!Number.isInteger(n) || n < 1) throw fail("readingTime — целое число минут, сейчас «" + meta.readingTime + "»");
    readingTime = n;
  }

  let cover: Post["cover"];
  if (meta.coverImage) {
    if (!meta.coverImageAlt) throw fail("для coverImage нужен coverImageAlt");
    try {
      cover = { ...readImage(meta.coverImage), alt: meta.coverImageAlt };
    } catch (e) {
      throw fail("coverImage: " + (e as Error).message);
    }
  } else if (meta.coverImageAlt) {
    throw fail("coverImageAlt указан без coverImage");
  }

  let order: number | undefined;
  if (meta.order) {
    order = Number(meta.order);
    if (!Number.isInteger(order)) throw fail("order — целое число, сейчас «" + meta.order + "»");
  }

  let blocks: Block[];
  try {
    blocks = parseMarkdown(content, readImage);
  } catch (e) {
    throw fail((e as Error).message);
  }

  return {
    slug,
    title: meta.title!,
    seoTitle: meta.seoTitle || undefined,
    description: meta.description!,
    excerpt: meta.excerpt || meta.description!,
    category,
    service,
    related,
    publishDate,
    updatedDate,
    readingTime,
    status,
    cover,
    order,
    content,
    blocks,
  };
}

let cache: Post[] | null = null;

/** Every article on disk, drafts included, newest first. Validates all files. */
function loadAll(): Post[] {
  if (cache) return cache;

  const files = fs.existsSync(BLOG_DIR)
    ? fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md") && f !== "README.md" && !f.startsWith("_"))
    : [];

  const posts = files.map(readPost);

  const seen = new Set<string>();
  for (const p of posts) {
    if (seen.has(p.slug)) throw new Error("[blog] повторяется slug «" + p.slug + "»");
    seen.add(p.slug);
  }

  posts.sort((a, b) => {
    if (a.publishDate !== b.publishDate) return a.publishDate < b.publishDate ? 1 : -1;
    const byOrder = (a.order ?? Infinity) === (b.order ?? Infinity) ? 0 : (a.order ?? Infinity) < (b.order ?? Infinity) ? -1 : 1;
    return byOrder || a.slug.localeCompare(b.slug);
  });

  // in development files are edited live, so never serve a stale list
  if (process.env.NODE_ENV === "production") cache = posts;
  return posts;
}

/** Published articles only — the blog index, sitemap and structured data use this. */
export function getPublishedPosts(): Post[] {
  return loadAll().filter((p) => p.status === "published");
}

/**
 * Articles that get their own page. Drafts are previewable at their URL in
 * `next dev` only; a production build never generates them, so they 404 and
 * cannot be indexed.
 */
export function getRoutablePosts(): Post[] {
  const drafts = process.env.NODE_ENV === "development";
  return loadAll().filter((p) => p.status === "published" || drafts);
}

export function getPostBySlug(slug: string): Post | undefined {
  return getRoutablePosts().find((p) => p.slug === slug);
}

/** Published articles of one category, newest first. */
export function getPostsByCategory(slug: CategorySlug): Post[] {
  return getPublishedPosts().filter((p) => p.category === slug);
}

/** Categories that have at least one published article, in the order of config/blog.ts. */
export function categoriesWithPosts() {
  const posts = getPublishedPosts();
  return blogCategories
    .map((c) => ({ ...c, count: posts.filter((p) => p.category === c.slug).length }))
    .filter((c) => c.count > 0);
}

/**
 * «Читать по теме»: explicit `related` first, then the same category, then the
 * same target service; newer first within each group. Only published articles.
 */
export function relatedPosts(post: Post, limit = 3): Post[] {
  const others = getPublishedPosts().filter((p) => p.slug !== post.slug);
  const score = (p: Post) =>
    (post.related.includes(p.slug) ? 100 : 0) +
    (p.category === post.category ? 10 : 0) +
    (post.service && p.service === post.service ? 1 : 0);
  return others
    .map((p, i) => ({ p, s: score(p), i }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Latest change across published articles, YYYY-MM-DD. */
export function lastBlogUpdate(): string | undefined {
  return getPublishedPosts()
    .map((p) => p.updatedDate ?? p.publishDate)
    .sort()
    .pop();
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso + "T00:00:00Z")).replace(/\s*г\.$/, "");
}

export function readingTimeLabel(minutes: number): string {
  return minutes + " мин чтения";
}
