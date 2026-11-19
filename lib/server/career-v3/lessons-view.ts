// Lesson access for the v3 cabinet. Learners only receive lessons that the library delivers
// (approved + published, or the local synthetic fixture). Review preview is a separate, local-only,
// tester-only view that is labelled as a draft and never feeds selection or the plan.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { CareerError } from "../career/config.ts";
import { loadProfessionBundle } from "./content.ts";
import { reviewPreviewEnabled } from "./dev-modes.ts";
import type { LessonDocument } from "../../career-v3/types.ts";

const LESSON_ID = /^[A-Z]{2,5}-[0-9]{2,3}(?:-EX)?$/;
const DOWNLOAD_ID = /^[A-Z0-9-]{4,60}$/;
const PREVIEW_STATUSES = new Set(["review", "draft", "prototype"]);
const TYPES: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".pdf": "application/pdf",
};

export function cabinetState(professionId: string) {
  const b = loadProfessionBundle(professionId);
  return {
    professionId, professionTitle: b.config.title, libraryMode: b.libraryMode,
    previewEnabled: reviewPreviewEnabled(),
    publishedLessons: b.library.availability.status === "available" ? b.library.published.length : 0,
  };
}

export function learnerLesson(professionId: string, lessonId: string): { lesson: LessonDocument; mode: "published" | "synthetic_fixture" } {
  if (!LESSON_ID.test(lessonId)) throw new CareerError(404, "Урок не найден");
  const b = loadProfessionBundle(professionId);
  const doc = b.library.published.find((l) => l.id === lessonId)?.document;
  if (!doc) throw new CareerError(404, "Урок пока недоступен");
  return { lesson: doc, mode: b.libraryMode === "synthetic_fixture" ? "synthetic_fixture" : "published" };
}

export function previewList(professionId: string) {
  if (!reviewPreviewEnabled()) throw new CareerError(404, "Маршрут не найден");
  const b = loadProfessionBundle(professionId);
  return {
    lessons: b.contentLibrary.entries
      .filter((e) => !e.deliverable && PREVIEW_STATUSES.has(e.status) && b.lessonDocuments.get(e.id)?.source === "content")
      .map((e) => ({ id: e.id, title: b.lessonDocuments.get(e.id)!.document.title, moduleId: e.moduleId, draft: true })),
  };
}

export function previewLesson(professionId: string, lessonId: string): { lesson: LessonDocument; mode: "review_preview" } {
  if (!reviewPreviewEnabled() || !LESSON_ID.test(lessonId)) throw new CareerError(404, "Маршрут не найден");
  const b = loadProfessionBundle(professionId);
  const entry = b.contentLibrary.entries.find((e) => e.id === lessonId);
  const doc = b.lessonDocuments.get(lessonId);
  if (!entry || !doc || doc.source !== "content" || entry.deliverable || !PREVIEW_STATUSES.has(entry.status)) throw new CareerError(404, "Черновик не найден");
  return { lesson: doc.document, mode: "review_preview" };
}

export function lessonDownload(professionId: string, lessonId: string, downloadId: string, preview: boolean) {
  if (!DOWNLOAD_ID.test(downloadId)) throw new CareerError(404, "Файл не найден");
  const { lesson } = preview ? previewLesson(professionId, lessonId) : learnerLesson(professionId, lessonId);
  const d = lesson.downloads.find((x) => x.id === downloadId);
  if (!d || !d.repositoryPath.startsWith("content/career/v3/") || d.repositoryPath.includes("..")) throw new CareerError(404, "Файл не найден");
  const abs = path.join(process.cwd(), d.repositoryPath);
  if (!existsSync(abs)) throw new CareerError(404, "Файл не найден");
  const ext = path.extname(abs).toLowerCase();
  return { body: readFileSync(abs), type: TYPES[ext] ?? "application/octet-stream", filename: path.basename(abs) };
}
