const items: [string, string][] = [
  [
    "Сколько стоит работа",
    "Зависит от объёма. После первого разбора я называю вилку по первому этапу, а не по всему проекту целиком — так понятнее, за что вы платите.",
  ],
  [
    "Сколько занимает первый этап",
    "Обычно от двух до шести недель. Первый этап специально держу коротким — чтобы вы увидели работающий результат, а не отчёт о планах.",
  ],
  [
    "Работаете ли по договору",
    "Да. Договор, фиксированный объём этапа, сроки и порядок оплаты. Для компаний — с закрывающими документами.",
  ],
  [
    "Нужно ли готовое ТЗ",
    "Нет. Достаточно рассказать, как процесс работает сейчас и что в нём мешает. Постановку задачи мы сформулируем вместе на первом разборе.",
  ],
  [
    "Что если задача окажется проще, чем кажется",
    "Тогда я так и скажу. Иногда вопрос закрывается настройкой существующих инструментов или изменением самого процесса — разработка в этом случае не нужна.",
  ],
  [
    "Кому принадлежит код и доступы",
    "Вам. Репозиторий, хостинг и все сервисы оформляются на вашу сторону, я работаю внутри ваших аккаунтов. Продукт не остаётся привязанным ко мне.",
  ],
  [
    "Можно ли начать с маленького объёма",
    "Так и надо начинать. Один процесс, один сценарий, минимальный работающий объём — дальше расширяем по факту, а не по догадкам.",
  ],
  [
    "Можно ли начать только с консультации, без разработки",
    "Да, это частый вариант. Разбираем задачу, я даю оценку и план этапов — а решение, делать ли и с кем, остаётся за вами.",
  ],
];

export default function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] pb-5 pt-10 min-[560px]:pt-14">
      <div className="mb-9 grid items-end gap-x-14 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <h2 className="m-0 text-[clamp(27px,6.6vw,46px)] font-medium leading-[1.1] tracking-[-0.03em]">FAQ</h2>
        <p className="m-0 mb-1.5 max-w-[42ch] text-pretty text-[15px] leading-[1.6] text-neutral-500">
          Если вопроса здесь нет — напишите его прямо в форме выше.
        </p>
      </div>

      <div className="flex flex-col">
        {items.map(([q, a], i) => (
          <details
            key={q}
            className="group"
            style={{
              backgroundImage: `linear-gradient(90deg, ${i === 0 ? "#5d5294" : "#3f424d"}, ${i === items.length - 1 ? "transparent" : "#292b31"})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 1px",
              backgroundPosition: "0 0",
            }}
          >
            <summary className="flex cursor-pointer list-none items-baseline justify-between gap-5 py-[22px] text-[clamp(16px,3.2vw,19px)] leading-[1.4] tracking-[-0.02em] text-ink [&::-webkit-details-marker]:hidden">
              <span className="max-w-[44ch]">{q}</span>
              <span className="flex-none text-lg leading-none text-accent transition-transform duration-200 group-open:rotate-45">+</span>
            </summary>
            <p className="m-0 mb-6 max-w-[60ch] text-pretty text-[15px] leading-[1.6] text-neutral-500">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
