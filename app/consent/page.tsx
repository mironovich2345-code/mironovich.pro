import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных",
  robots: { index: false, follow: true },
  alternates: { canonical: "/consent" },
};

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

export default function Page() {
  return (
    <main className="mx-auto max-w-[720px] px-[22px] py-16">
      <h1 className="m-0 mb-6 text-[clamp(26px,6vw,40px)] font-medium leading-[1.12] tracking-[-0.03em]">
        Согласие на обработку персональных данных
      </h1>
      <p className="m-0 mb-10 text-[15px] leading-[1.7] text-neutral-400">Текст согласия, которое вы подтверждаете галочкой при отправке формы на сайте.</p>

      <div className="flex flex-col gap-8">
        {blocks.map((b) => (
          <section key={b.heading}>
            <h2 className="m-0 mb-3 text-[19px] font-medium tracking-[-0.02em]">{b.heading}</h2>
            <div className="flex flex-col gap-3 text-[15px] leading-[1.7] text-neutral-400">
              {b.items.map((t) => <p key={t} className="m-0">{t}</p>)}
            </div>
          </section>
        ))}
      </div>

      <p className="m-0 mt-10 text-[13px] text-neutral-500">
        Вопросы по обработке данных — в Telegram:{" "}
        <a href={site.telegram} target="_blank" rel="noopener noreferrer" className="text-accent-300 underline underline-offset-[3px]">
          {site.telegram.replace("https://", "")}
        </a>
      </p>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
        <Link href="/" className="text-accent-300 underline underline-offset-[3px]">← На главную</Link>
        <Link href="/privacy" className="text-accent-300 underline underline-offset-[3px]">Политика обработки данных →</Link>
      </div>
    </main>
  );
}
