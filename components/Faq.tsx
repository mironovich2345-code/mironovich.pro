import SectionLabel from "./SectionLabel";

/** Also feeds the FAQPage structured data, so markup always matches the visible text. */
export const homeFaq: [string, string][] = [
  [
    "Нужно ли готовое техническое задание?",
    "Нет. Достаточно описать задачу и то, как процесс устроен сейчас. Требования формируются на этапе описания процесса.",
  ],
  [
    "Что входит в бесплатное обсуждение?",
    "Разговор в переписке или на созвоне: вы описываете задачу, я задаю уточняющие вопросы. По итогам — возможные варианты решения и следующие шаги. Детальное изучение процессов, письменный отчёт и техническое задание в бесплатное обсуждение не входят.",
  ],
  [
    "Сколько стоит работа?",
    "Первичное обсуждение задачи бесплатно. Аудит бизнес-процессов, разработка, автоматизация и внедрение оцениваются отдельно, когда понятны задача и объём. На стоимость влияют количество систем и интеграций, сложность логики, требования к безопасности и сроки.",
  ],
  [
    "Можно ли начать с небольшого проекта?",
    "Да. Часто разумнее сначала автоматизировать один процесс, проверить его в реальной работе и потом расширять.",
  ],
  [
    "Когда достаточно готового сервиса?",
    "Когда он закрывает задачу без сложных обходных путей и дорогих доработок. Если это так, я скажу об этом прямо.",
  ],
  [
    "Можно ли интегрироваться с нашей CRM?",
    "Если у системы есть API или другой поддерживаемый способ обмена данными — как правило, да. Конкретные возможности проверяются при обсуждении задачи.",
  ],
  [
    "Кто получает права на код?",
    "Права на код и материалы, а также условия их передачи фиксируются в договоре до начала работ.",
  ],
  [
    "Как организована поддержка после запуска?",
    "Поддержка и её стоимость согласуются отдельно — в зависимости от решения и того, что нужно вашей команде.",
  ],
  [
    "Как обеспечивается безопасность данных?",
    "Доступы к системам, место хранения данных и требования к безопасности обсуждаются до начала работ и фиксируются в договоре. Если у компании есть требования службы безопасности, они учитываются при выборе решения.",
  ],
];

export default function Faq() {
  return (
    <section id="faq" className="bg-cream px-[22px] pb-16 pt-4 min-[560px]:pb-24">
      <div className="mx-auto max-w-[1080px] border-t border-graphite/15 pt-12 min-[560px]:pt-16">
        <SectionLabel index="07" label="Вопросы" note="Если вопроса нет — задайте его в форме" tone="light" />

        <h2 className="m-0 mb-10 font-display text-[clamp(30px,5.6vw,52px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-graphite min-[560px]:mb-14">
          Частые вопросы
        </h2>

        <div className="flex flex-col border-t border-graphite/15">
          {homeFaq.map(([q, a], i) => (
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
