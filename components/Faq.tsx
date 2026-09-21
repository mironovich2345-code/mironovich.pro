const items: [string, string][] = [
  [
    "Подойдёт ли такая система небольшой компании?",
    "Да. Не обязательно начинать с большой корпоративной платформы. Сначала можно систематизировать один процесс, должность или этап адаптации.",
  ],
  [
    "Что делать, если у нас ещё нет готовой программы обучения?",
    "Это нормально. Можно начать с существующих регламентов, инструкций и того, как обучение фактически проходит сейчас.",
  ],
  [
    "Можно ли использовать уже существующие PDF, инструкции и видео?",
    "Да. Существующие материалы можно собрать, структурировать и встроить в новую систему вместо создания всего контента с нуля.",
  ],
  [
    "Можно ли сделать разные программы для разных должностей?",
    "Да. Сотрудники могут получать разные маршруты обучения в зависимости от роли, должности или этапа развития.",
  ],
  [
    "Как руководитель будет понимать, что сотрудник обучился?",
    "Через прогресс, тестирование, аттестации и результаты прохождения программы.",
  ],
  [
    "Обязательно ли создавать отдельное приложение?",
    "Нет. Формат выбирается после разбора процесса. Иногда достаточно более простого решения.",
  ],
  [
    "Можно ли внедрять систему постепенно?",
    "Да. Обычно лучше начать с одного понятного этапа, проверить его в реальной работе и затем расширять систему.",
  ],
  [
    "Можно ли начать только с консультации?",
    "Да. Первый шаг может быть только разбором текущего процесса и возможных вариантов решения.",
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
