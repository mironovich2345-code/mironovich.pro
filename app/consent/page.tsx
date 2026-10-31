import type { Metadata } from "next";
import Link from "next/link";
import { contacts } from "@/config/contacts";
import LegalDocument from "@/components/LegalDocument";
import { getLegalDoc, legalMode } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Согласие на обработку персональных данных",
  description: "Текст согласия на обработку персональных данных, которое подтверждается при отправке формы на сайте mironovich.pro.",
  path: "/consent",
  absoluteTitle: false,
  noindex: true,
});

const blocks: { heading: string; items: string[] }[] = [
  {
    "heading": "Предмет согласия",
    "items": [
      "Отправляя форму, вы даете согласие на обработку указанных вами персональных данных: имени, номера телефона и текста обращения.",
      "Обработка включает сбор, запись, хранение, уточнение, использование и удаление данных."
    ]
  },
  {
    "heading": "Цель",
    "items": [
      "Единственная цель — связаться с вами и обсудить описанную вами задачу."
    ]
  },
  {
    "heading": "Срок и отзыв",
    "items": [
      "Согласие действует до его отзыва. Отозвать согласие можно в любой момент, написав в Telegram — данные будут удалены.",
      "Подробности о составе и хранении данных — в политике обработки персональных данных."
    ]
  }
];

/**
 * New text from content/legal/consent.md once config/legal.ts says it is published
 * (or as a marked draft with LEGAL_PREVIEW=1 on staging); the current wording otherwise.
 */
export default function Page() {
  const doc = getLegalDoc("consent");
  const mode = legalMode(doc);
  if (mode !== "legacy") return <LegalDocument doc={doc} mode={mode} other={{ href: "/privacy", label: "Политика обработки персональных данных" }} />;
  return <LegacyPage />;
}

/** The wording currently live on mironovich.pro — unchanged. */
function LegacyPage() {
  return (
    <main id="main" className="mx-auto max-w-[720px] px-[22px] py-16">
      <h1 className="m-0 mb-6 font-display text-[clamp(28px,6vw,44px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-cream">
        Согласие на обработку персональных данных
      </h1>
      <p className="m-0 mb-10 text-[15px] leading-[1.7] text-stone">Текст согласия, которое вы подтверждаете галочкой при отправке формы на сайте.</p>

      <div className="flex flex-col gap-8">
        {blocks.map((b) => (
          <section key={b.heading}>
            <h2 className="m-0 mb-3 text-[19px] font-medium tracking-[-0.01em] text-cream">{b.heading}</h2>
            <div className="flex flex-col gap-3 text-[15px] leading-[1.7] text-stone">
              {b.items.map((t) => <p key={t} className="m-0">{t}</p>)}
            </div>
          </section>
        ))}
      </div>

      <p className="m-0 mt-10 text-[13px] text-stone">
        Вопросы по обработке данных — в Telegram:{" "}
        <a href={contacts.telegram.href} target="_blank" rel="noopener noreferrer" className="text-cream underline hover:text-signal underline-offset-[3px]">
          {contacts.telegram.text}
        </a>
      </p>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
        <Link href="/" className="text-cream underline hover:text-signal underline-offset-[3px]">← На главную</Link>
        <Link href="/privacy" className="text-cream underline hover:text-signal underline-offset-[3px]">Политика обработки данных →</Link>
      </div>
    </main>
  );
}
