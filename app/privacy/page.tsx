import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных",
  robots: { index: false, follow: true },
  alternates: { canonical: "/privacy" },
};

const blocks: { heading: string; items: string[] }[] = [
  {
    "heading": "Какие данные собираются",
    "items": [
      "Через форму на сайте: имя, номер телефона и текст обращения. Других полей в форме нет.",
      "Автоматически: базовая техническая статистика посещений (обезличенные данные о загрузке страниц). Рекламные трекеры на сайте не используются."
    ]
  },
  {
    "heading": "Зачем они нужны",
    "items": [
      "Данные используются исключительно для связи с вами и обсуждения вашей задачи.",
      "Данные не передаются третьим лицам, не продаются и не используются для рассылок."
    ]
  },
  {
    "heading": "Где они хранятся",
    "items": [
      "Заявка передается в закрытый Telegram-чат владельца сайта. Сайт не ведет собственную базу заявок.",
      "Срок хранения — до завершения обсуждения задачи, после чего переписка удаляется по запросу."
    ]
  },
  {
    "heading": "Ваши права",
    "items": [
      "Вы можете в любой момент отозвать согласие, запросить состав своих данных или их удаление — достаточно написать в Telegram.",
      "Запрос обрабатывается в течение 10 рабочих дней."
    ]
  }
];

export default function Page() {
  return (
    <main className="mx-auto max-w-[720px] px-[22px] py-16">
      <h1 className="m-0 mb-6 text-[clamp(26px,6vw,40px)] font-medium leading-[1.12] tracking-[-0.03em]">
        Политика обработки персональных данных
      </h1>
      <p className="m-0 mb-10 text-[15px] leading-[1.7] text-neutral-400">Документ описывает, какие данные собирает сайт, зачем они нужны и как с ними обращаются.</p>

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
        <Link href="/consent" className="text-accent-300 underline underline-offset-[3px]">Согласие на обработку данных →</Link>
      </div>
    </main>
  );
}
