import CtaLink from "./CtaLink";

export default function Hero() {
  return (
    <section id="hero"
      className="relative mx-auto max-w-[1080px] px-[22px] pb-10 pt-[52px] min-[560px]:pb-[72px] min-[560px]:pt-[84px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(64%_58%_at_22%_26%,#000,transparent_76%)]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(233,233,237,0.07) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-32 h-[420px] w-[520px]"
        style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(145,132,217,0.14), transparent 72%)" }}
      />

      <div className="relative flex flex-col items-start gap-7">
        <p className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.2em] text-neutral-500">
          <span className="h-[5px] w-[5px] animate-pulseDot rounded-full bg-accent" />
          Digital products × AI × Business
        </p>

        <h1 className="m-0 max-w-[17ch] text-balance text-[clamp(38px,9.6vw,78px)] font-medium leading-[1.02] tracking-[-0.035em]">
          Разбираю бизнес-процессы и превращаю их в цифровые продукты
        </h1>

        <p className="m-0 max-w-[44ch] text-pretty text-[clamp(16px,4.2vw,20px)] leading-[1.55] text-neutral-400">
          Внутренние приложения, обучение сотрудников, автоматизация и AI-инструменты для бизнеса.
        </p>

        <div className="flex w-full flex-wrap gap-3">
          <CtaLink
            href="#contact"
            location="hero"
            className="inline-flex min-h-[54px] flex-[1_1_210px] items-center justify-center rounded-md border border-accent bg-accent-900 px-[30px] text-base font-medium tracking-[-0.01em] text-accent-200 transition-colors hover:border-accent-400 hover:bg-accent-800 hover:text-accent-100"
          >
            Обсудить задачу
          </CtaLink>
          <a
            href="#problems"
            className="inline-flex min-h-[54px] flex-[1_1_210px] items-center justify-center rounded-md px-[22px] text-[15px] text-neutral-500 transition-colors hover:text-ink"
          >
            Посмотреть, с чем могу помочь ↓
          </a>
        </div>

        <div
          aria-hidden
          className="relative mt-4 h-px w-full"
          style={{ background: "linear-gradient(90deg, transparent, #3f424d 48px, #3f424d calc(100% - 48px), transparent)" }}
        >
          <span className="absolute -top-0.5 left-0 h-[5px] w-[5px] animate-drift rounded-full bg-accent" />
        </div>

        <ul className="m-0 flex list-none flex-wrap gap-x-[26px] gap-y-1.5 p-0 text-[13px] text-neutral-400">
          <li>Внутренние приложения</li>
          <li>Обучение</li>
          <li>Автоматизация</li>
          <li>AI</li>
          <li>Telegram Mini Apps</li>
        </ul>
      </div>
    </section>
  );
}
