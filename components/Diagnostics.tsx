import CtaLink from "./CtaLink";
import SectionLabel from "./SectionLabel";

/**
 * Entry point to working together. The free first conversation and the paid
 * process audit are deliberately separate columns so the audit never reads as
 * part of the free consultation. No prices are published.
 */
export default function Diagnostics() {
  return (
    <section id="diagnostics" className="bg-cream px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel index="04" label="С чего начать" note="Без готового ТЗ" tone="light" />

        <div className="mb-12 grid gap-6 min-[860px]:mb-16 min-[860px]:grid-cols-[1fr_1fr] min-[860px]:items-end min-[860px]:gap-16">
          <h2 className="m-0 max-w-[16ch] text-balance font-display text-[clamp(30px,5.8vw,54px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em] text-graphite">
            Начинаем с обсуждения задачи
          </h2>
          <p className="m-0 max-w-[48ch] text-pretty text-[16px] leading-[1.6] text-graphite/75">
            Не нужно заранее выбирать технологию. Расскажите о проблеме, идее или действующем продукте — определим, что стоит проверить первым.
          </p>
        </div>

        <div className="grid grid-cols-1 border-t border-graphite/15 min-[860px]:grid-cols-2">
          <div className="flex flex-col gap-5 border-b border-graphite/15 py-10 min-[860px]:border-b-0 min-[860px]:border-r min-[860px]:pr-10">
            <p className="m-0 inline-flex w-fit items-center bg-signal px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-white">
              Бесплатно
            </p>
            <h3 className="m-0 font-display text-[clamp(24px,3vw,32px)] font-extrabold uppercase leading-[1.08] tracking-[-0.015em] text-graphite">
              Первичное обсуждение задачи
            </h3>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {[
                ["Вы описываете ситуацию", "В переписке или на созвоне: что происходит и какое решение предстоит принять."],
                ["Я задаю уточняющие вопросы", "Что уже есть, что ограничивает работу и как вы оцениваете результат."],
                ["Определяем следующие шаги", "Возможные варианты решения и с чего разумно начать."],
              ].map(([title, body], i) => (
                <li key={title} className="grid grid-cols-[36px_1fr] gap-3">
                  <span className="font-display text-[20px] font-extrabold leading-none text-graphite/50">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="m-0 mb-1 text-[15px] font-medium text-graphite">{title}</p>
                    <p className="m-0 text-pretty text-[14.5px] leading-[1.55] text-graphite/75">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="m-0 border-t border-graphite/15 pt-4 text-pretty text-[13.5px] leading-[1.55] text-graphite/70">
              Детальное изучение процессов, письменный отчёт и техническое задание в бесплатное обсуждение не входят.
            </p>
          </div>

          <div className="flex flex-col gap-5 py-10 min-[860px]:pl-10">
            <p className="m-0 inline-flex w-fit items-center border border-graphite px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-graphite">
              Платная услуга
            </p>
            <h3 className="m-0 font-display text-[clamp(24px,3vw,32px)] font-extrabold uppercase leading-[1.08] tracking-[-0.015em] text-graphite">
              Технический разбор
            </h3>
            <p className="m-0 text-pretty text-[15px] leading-[1.6] text-graphite/75">
              Если нужен подробный анализ: проверка предложения, продукта или процесса с выводами и рекомендациями. Объект, глубина и стоимость согласуются заранее.
            </p>
            <p className="m-0 border-t border-graphite/15 pt-4 text-pretty text-[15px] leading-[1.6] text-graphite/75">
              Следующим шагом может стать реализация или регулярное техническое сопровождение. Состав работ и стоимость определяются отдельно.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-6 border-t border-graphite/15 pt-10 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
          <p className="m-0 max-w-[34ch] border-l-2 border-signal pl-5 text-balance text-[clamp(18px,2.6vw,22px)] leading-[1.4] tracking-[-0.01em] text-graphite">
            Если для задачи не нужна разработка, я так и скажу.
          </p>
          <CtaLink
            href="#contact"
            location="diagnostics"
            className="inline-flex min-h-[56px] items-center justify-center bg-signal px-8 text-[15px] font-medium uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#b82323]"
          >
            Обсудить задачу бесплатно
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
