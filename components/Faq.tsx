import SectionLabel from "./SectionLabel";

/** Also feeds the FAQPage structured data, so markup always matches the visible text. */
export const homeFaq: [string, string][] = [
  [
    "Что делает внешний технологический директор?",
    "Помогает руководителю выбирать технологии, оценивать бюджет и риски, организовывать разработку и сопровождение. Подключается в согласованном объёме, без найма CTO в штат."
  ],
  [
    "Можно ли обратиться с действующим продуктом?",
    "Да. Можем начать с изучения кода, документации и доступов, определить проблемы и обсудить условия регулярного сопровождения. Возможность приёма продукта зависит от его состояния."
  ],
  [
    "Что входит в бесплатное обсуждение?",
    "Вы описываете ситуацию, я задаю уточняющие вопросы. Определяем возможные варианты и следующий шаг. Подробный аудит, письменный отчёт и техническое задание — отдельная работа."
  ],
  [
    "Нужно ли разрабатывать собственное решение?",
    "Не всегда. Если готовый сервис или изменение процесса закрывают задачу, предложу этот вариант. ИИ также нужен не в каждом проекте."
  ],
  [
    "Вы работаете сами или с командой?",
    "Могу самостоятельно разрабатывать решения, привлекать специалистов или работать с вашей командой. Роли, ответственность и порядок контроля согласуем заранее."
  ],
  [
    "Сколько стоит работа и что входит в сопровождение?",
    "Стоимость зависит от продукта, объёма участия и условий работы. Регулярные задачи, часы доступности, порядок реакции и небольшие доработки определяются договором. Неограниченные изменения и поддержка 24/7 по умолчанию не обещаются."
  ],
  [
    "Можно ли заказать экспертизу без дальнейшей разработки?",
    "Да. Технический разбор — самостоятельная услуга. Если предлагаю собственную реализацию, открыто обозначаю заинтересованность; выбор исполнителя остаётся за вами."
  ]
];

export default function Faq({
  items = homeFaq,
  index = "07",
  title = "Частые вопросы",
  continued = true,
}: {
  items?: [string, string][];
  index?: string;
  title?: string;
  /** true when the previous section is also cream: a rule replaces the top padding */
  continued?: boolean;
}) {
  return (
    <section id="faq" className={"bg-cream px-[22px] pb-16 min-[560px]:pb-24 " + (continued ? "pt-4" : "pt-16 min-[560px]:pt-24")}>
      <div className={"mx-auto max-w-[1080px] " + (continued ? "border-t border-graphite/15 pt-12 min-[560px]:pt-16" : "")}>
        <SectionLabel index={index} label="Вопросы" note="Если вопроса нет — задайте его в форме" tone="light" />

        <h2 className="m-0 mb-10 font-display text-[clamp(30px,5.6vw,52px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-graphite min-[560px]:mb-14">
          {title}
        </h2>

        <div className="flex flex-col border-t border-graphite/15">
          {items.map(([q, a], i) => (
            <details key={q} className="group border-b border-graphite/15">
              <summary className="flex min-h-[64px] cursor-pointer list-none items-start gap-5 py-6 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="flex-none pt-1 font-display text-[13px] text-maroon">
                  {String(i + 1).padStart(2, "0")} /
                </span>
                <h3 className="m-0 flex-1 text-balance text-[clamp(17px,2.6vw,21px)] font-normal leading-[1.35] tracking-[-0.015em] text-graphite">
                  {q}
                </h3>
                <span
                  aria-hidden
                  className="flex-none pt-0.5 font-display text-xl leading-none text-maroon transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="m-0 mb-7 max-w-[64ch] text-pretty text-[15px] leading-[1.65] text-graphite/75 min-[560px]:pl-[52px]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
