import Link from "next/link";
import SectionLabel from "./SectionLabel";

const steps = [
  [
    "Разбираем задачу",
    "Обсуждаем, что мешает работе и какой результат нужен. Сравниваем готовые решения с разработкой.",
  ],
  [
    "Проверяем на первом этапе",
    "Согласуем ограниченный объём, стоимость и критерии приёмки. Проверяем решение до большого проекта.",
  ],
  [
    "Запускаем и передаём",
    "Тестируем, готовим инструкции и передаём систему команде. Дальнейшее развитие — по отдельной договорённости.",
  ],
];
export default function WorkApproach() {
  return (
    <section
      id="process"
      className="bg-cream px-[22px] py-12 min-[560px]:py-16"
    >
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel
          index="05"
          label="Работа и опыт"
          note="Данил Миронович"
          tone="light"
        />
        <h2 className="m-0 mb-7 font-display text-[clamp(30px,5vw,48px)] font-extrabold uppercase leading-[1.05] text-graphite">
          От задачи до работающей системы
        </h2>
        <ol className="m-0 grid list-none gap-x-8 p-0 min-[760px]:grid-cols-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="border-t border-graphite/25 py-5">
              <p
                aria-hidden
                className="m-0 mb-3 font-display text-sm text-maroon"
              >
                0{i + 1}
              </p>
              <h3 className="m-0 text-[18px] font-medium leading-snug text-graphite">
                {title}
              </h3>
              <p className="mb-0 mt-3 text-[14px] leading-relaxed text-graphite/80">
                {body}
              </p>
            </li>
          ))}
        </ol>
        <div
          id="about"
          className="mt-5 grid gap-5 border-t border-graphite/20 pt-6 min-[760px]:grid-cols-[1fr_auto] min-[760px]:gap-12"
        >
          <p className="m-0 max-w-[76ch] text-[15px] leading-relaxed text-graphite/80">
            Прошёл путь от ночного администратора до регионального директора
            сети фитнес-клубов. Отвечал за команды, продажи и обучение. Сейчас
            соединяю опыт операционного управления с разработкой.
          </p>
          <Link
            href="/about"
            className="inline-flex min-h-[44px] items-center gap-4 self-start text-[14px] text-maroon underline underline-offset-4"
          >
            Подробнее обо мне <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
