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

// Mobile shows the 4 most common questions first; the rest sit behind a native
// <details> disclosure ("Показать все вопросы") — no JS needed. Original
// numbers are kept so a question means the same thing on every breakpoint.
const primaryIdx = [0, 1, 5, 7];
const secondaryIdx = [2, 3, 4, 6];

const questionClass =
  "flex-1 text-balance text-[clamp(17px,3.2vw,21px)] leading-[1.35] tracking-[-0.015em] text-graphite";
const numberClass = "flex-none pt-1 font-display text-[13px] text-maroon";
const plusClass =
  "flex-none pt-0.5 font-display text-xl leading-none text-maroon transition-transform duration-200 group-open:rotate-45";
const answerClass = "m-0 mb-7 max-w-[60ch] text-pretty text-[15px] leading-[1.6] text-graphite/60 min-[560px]:pl-[52px]";

function FaqItem({ i }: { i: number }) {
  const [q, a] = items[i];
  return (
    <details className="group border-b border-graphite/15">
      <summary className="flex cursor-pointer list-none items-start gap-5 py-7 [&::-webkit-details-marker]:hidden">
        <span className={numberClass}>{String(i + 1).padStart(2, "0")} /</span>
        <span className={questionClass}>{q}</span>
        <span className={plusClass}>+</span>
      </summary>
      <p className={answerClass}>{a}</p>
    </details>
  );
}

export default function Faq() {
  return (
    <section id="faq" className="bg-cream px-[22px] pb-16 pt-16 min-[560px]:pt-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-10 flex items-end justify-between gap-6 min-[560px]:mb-14">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-maroon">09 / FAQ</p>
          <p className="m-0 hidden max-w-[42ch] text-[13px] leading-[1.6] text-graphite/50 min-[560px]:block">
            Если вопроса здесь нет — напишите его прямо в форме выше.
          </p>
        </div>

        <h2 className="m-0 mb-12 font-display text-[clamp(28px,5.6vw,48px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-graphite min-[560px]:mb-16">
          Вопросы
        </h2>

        {/* Mobile: 4 questions, then a disclosure for the rest. */}
        <div className="flex flex-col border-t border-graphite/15 min-[640px]:hidden">
          {primaryIdx.map((i) => <FaqItem key={i} i={i} />)}
          <details className="group border-b border-graphite/15">
            <summary className="flex cursor-pointer list-none items-center gap-5 py-6 text-[14px] uppercase tracking-[0.08em] text-maroon [&::-webkit-details-marker]:hidden">
              <span>Показать все вопросы</span>
              <span className="font-display text-base leading-none transition-transform duration-200 group-open:rotate-45">+</span>
            </summary>
            <div className="flex flex-col">
              {secondaryIdx.map((i) => <FaqItem key={i} i={i} />)}
            </div>
          </details>
        </div>

        {/* Desktop: all 8, flat. */}
        <div className="hidden flex-col border-t border-graphite/15 min-[640px]:flex">
          {items.map((_, i) => <FaqItem key={i} i={i} />)}
        </div>
      </div>
    </section>
  );
}
