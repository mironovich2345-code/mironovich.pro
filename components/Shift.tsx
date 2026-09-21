import Reveal from "./Reveal";

const rows: [string, string][] = [
  [
    "Руководитель по несколько часов объясняет одно и то же каждому новичку.",
    "Новичок самостоятельно проходит единый маршрут, а руководитель подключается только там, где действительно нужен.",
  ],
  [
    "Знания находятся в чатах, документах и головах сотрудников.",
    "Есть единая актуальная база знаний.",
  ],
  [
    "«Мы его обучили» — но никто не знает, что сотрудник реально запомнил.",
    "Есть тестирование, аттестации и история результатов.",
  ],
  [
    "Новый филиал фактически создаёт обучение заново.",
    "Один стандарт можно масштабировать на новые точки и сотрудников.",
  ],
];

export default function Shift() {
  return (
    <section id="shift" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] py-10 min-[560px]:py-14">
      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">03 — Что меняется</p>
      <h2 className="m-0 mb-[34px] max-w-[20ch] text-balance text-[clamp(27px,6.6vw,46px)] font-medium leading-[1.1] tracking-[-0.03em]">
        Обучение перестаёт быть задачей конкретного руководителя
      </h2>

      <div className="flex flex-col">
        {rows.map(([now, sys], i) => (
          <Reveal key={i} delay={(i % 2) * 0.06}>
            <div
              className="grid grid-cols-1 items-start gap-2.5 pb-7 pt-[26px] min-[700px]:gap-5 min-[700px]:[grid-template-columns:1fr_44px_1fr]"
              style={{
                backgroundImage: `linear-gradient(90deg, ${i === 0 ? "#5d5294" : "#3f424d"}, ${i === rows.length - 1 ? "transparent" : "#292b31"})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% 1px",
                backgroundPosition: "0 0",
              }}
            >
              <div>
                <p className="m-0 mb-2.5 text-[11px] uppercase tracking-[0.18em] text-neutral-600">Сейчас</p>
                <p className="m-0 max-w-[42ch] text-pretty text-[15px] leading-[1.6] text-neutral-500">{now}</p>
              </div>
              <div aria-hidden className="hidden justify-center pt-[22px] text-lg text-accent-600 min-[700px]:flex">→</div>
              <div>
                <p className="m-0 mb-2.5 text-[11px] uppercase tracking-[0.18em] text-accent-400">Система</p>
                <p className="m-0 max-w-[42ch] text-pretty text-[15.5px] leading-[1.6] text-neutral-300">{sys}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
