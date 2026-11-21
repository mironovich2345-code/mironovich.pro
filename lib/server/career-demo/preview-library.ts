// Isolated review-preview library for the CLOSED CLOUD DEMO only. Builds an in-memory copy of the written
// lessons that are still in review, marked usable for route building INSIDE THIS COPY, so testers can walk
// the full 30-step path on the real texts. Nothing is written: content files keep status=review,
// canBePublished=false and factualClaimsChecked=false; curriculum slots stay unpublished.
// Only content.ts calls this, and only when demoConfig() (fail-closed, hard-coded allow-list) is valid.
import type { Curriculum } from "../../career-v3/types.ts";
import { demoConfig } from "./config.ts";

export const DEMO_REVIEWER = "DEMO PREVIEW ONLY — not an editorial or legal approval";

export function demoPreviewSources<L extends { path: string; document: unknown }>(curriculum: Curriculum, lessons: L[], today: string) {
  if (!demoConfig()) throw new Error("demo preview library outside the closed demo");
  const copies = lessons.map((l) => ({ ...l, document: structuredClone(l.document) as Record<string, unknown> }));
  const ids = new Set<string>();
  for (const l of copies) {
    const d = l.document;
    // Only written lessons in editorial review; drafts, prototypes and deliverables are never promoted.
    if (d.status !== "review" || typeof d.id !== "string" || l.path.endsWith(".prototype.json")) continue;
    ids.add(d.id);
    d.status = "approved";
    d.quality = { ...(d.quality as object), reviewedOn: today, canBePublished: true, reviewer: DEMO_REVIEWER };
    d.sourcePolicy = { ...(d.sourcePolicy as object), factualClaimsChecked: true };
  }
  const c = structuredClone(curriculum) as Curriculum;
  for (const s of c.slots as { id: string; status: string; publishedLessonId?: string | null }[])
    if (ids.has(s.id)) { s.status = "published"; s.publishedLessonId = s.id; }
  return { curriculum: c, lessons: copies.filter((l) => ids.has(l.document.id as string)), previewIds: ids };
}
