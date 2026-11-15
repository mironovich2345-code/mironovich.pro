import CtaLink from "./CtaLink";

export default function Hero() {
  return (
    <section
      id="hero"
      className="bg-graphite px-[22px] pb-12 pt-7 min-[560px]:pb-16 min-[560px]:pt-12"
    >
      <div className="mx-auto max-w-[1080px]">
        <p className="m-0 mb-6 text-[11px] uppercase tracking-[0.2em] text-stone">
          Данил Миронович <span className="text-signal">/</span> Разработка и
          внедрение
        </p>
        <h1 className="m-0 max-w-[22ch] font-display text-[clamp(36px,6.2vw,78px)] font-extrabold uppercase leading-[0.99] tracking-[-0.02em] text-cream">
          Цифровые системы для управления сотрудниками, продажами и{" "}
          <span className="text-signal">филиалами</span>
        </h1>
        <div className="mt-7 grid gap-7 min-[860px]:grid-cols-[1.6fr_1fr] min-[860px]:gap-16">
          <p className="m-0 max-w-[64ch] text-[16px] leading-[1.6] text-cream/80 min-[560px]:text-[18px]">
            Разрабатываю корпоративные приложения, объединяю данные существующих
            систем и внедряю ИИ там, где он решает конкретную задачу. От
            обучения сотрудников и KPI до управленческой аналитики.
          </p>
          <div className="flex flex-col justify-end gap-3 min-[480px]:flex-row min-[860px]:flex-col">
            <CtaLink
              href="#solutions"
              location="hero_solutions"
              className="inline-flex min-h-[52px] items-center justify-center bg-signal px-6 text-[14px] font-medium text-white hover:bg-[#b82323]"
            >
              Посмотреть решения{" "}
              <span aria-hidden className="ml-3">
                ↓
              </span>
            </CtaLink>
            <CtaLink
              href="#contact"
              location="hero"
              className="inline-flex min-h-[52px] items-center justify-center border border-cream/35 px-6 text-[14px] text-cream hover:border-cream"
            >
              Обсудить проект
            </CtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}
