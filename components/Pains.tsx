import Reveal from "./Reveal";

const items = [
  "Сотрудники обучаются в Telegram, Google Docs, PDF и десятке разных чатов.",
  "Руководитель не понимает, что реально делают сотрудники и где возникают ошибки.",
  "Большая часть процессов компании до сих пор выполняется вручную.",
  "Компания собирает много данных, но почти никак их не использует.",
  "Есть идея внутреннего сервиса или приложения, но непонятно, как правильно его спроектировать.",
  "Хотите использовать AI, но пока непонятно, где он действительно принесет пользу бизнесу.",
];

export default function Pains() {
  return (
    <section id="problems" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] py-10 min-[560px]:py-14">
      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">01 — Когда я могу быть полезен</p>
      <h2 className="m-0 mb-8 max-w-[20ch] text-balance text-[clamp(27px,6.6vw,46px)] font-medium leading-[1.1] tracking-[-0.03em]">
        Возможно, вам знакома одна из этих ситуаций
      </h2>

      <div className="grid gap-px border-y border-neutral-900 bg-neutral-900 [grid-template-columns:repeat(auto-fit,minmax(min(100%,268px),1fr))]">
        {items.map((text, i) => (
          <Reveal key={i} delay={(i % 3) * 0.06} className="bg-bg transition-colors hover:bg-[#1c1f30]">
            <div className="px-5 pb-[26px] pt-[22px]">
              <p className="mb-3.5 text-xs tracking-[0.08em] text-accent-600">{String(i + 1).padStart(2, "0")}</p>
              <p className="m-0 text-pretty text-[15px] leading-[1.55] text-neutral-300">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <p className="m-0 mt-6 max-w-[50ch] text-pretty text-[clamp(16px,4.2vw,19px)] leading-[1.5] text-neutral-300">
        Такие задачи обычно не требуют еще одного сервиса. Сначала нужно разобраться в самом процессе.
      </p>
    </section>
  );
}
