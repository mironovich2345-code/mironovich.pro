import Link from "next/link";
import Breadcrumbs from "./Breadcrumbs";
import Markdown from "./Markdown";
import { formatEdition, type LegalDoc, type LegalMode } from "@/lib/legal";

/** New-format legal page: header on graphite, text on cream; a visible notice in preview mode. */
export default function LegalDocument({ doc, mode, other }: { doc: LegalDoc; mode: Exclude<LegalMode, "legacy">; other: { href: string; label: string } }) {
  return (
    <main id="main">
      <section className="bg-graphite px-[22px] pb-12 pt-6 min-[560px]:pb-16 min-[560px]:pt-10">
        <div className="mx-auto flex max-w-[780px] flex-col gap-5">
          <Breadcrumbs items={[{ name: "Главная", href: "/" }, { name: doc.title, href: "/" + doc.slug }]} />
          {mode === "preview" && (
            <p role="note" className="m-0 border border-signal px-4 py-3 text-[14px] leading-[1.5] text-cream">
              Проект документа — не опубликован. Поля в квадратных скобках будут заполнены до публикации.
            </p>
          )}
          <h1 className="m-0 text-balance font-display text-[clamp(30px,6vw,52px)] font-extrabold uppercase leading-[1.04] tracking-[-0.02em] text-cream">
            {doc.title}
          </h1>
          <p className="m-0 text-[14px] text-stone">
            Редакция от <time dateTime={doc.edition}>{formatEdition(doc.edition)}</time>
          </p>
        </div>
      </section>
      <section className="bg-cream px-[22px] pb-16 pt-6 min-[560px]:pb-24">
        <article className="mx-auto max-w-[780px]">
          <Markdown blocks={doc.blocks} />
          <p className="m-0 mt-12 border-t border-graphite/15 pt-6 text-[15px]">
            <Link href={other.href} className="text-maroon underline underline-offset-4 hover:text-signal">
              {other.label} →
            </Link>
          </p>
        </article>
      </section>
    </main>
  );
}
