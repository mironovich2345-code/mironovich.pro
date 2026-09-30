import CtaLink from "./CtaLink";

export default function SecondaryCta() {
  return (
    <section className="bg-signal px-[22px] py-20 text-center min-[560px]:py-28">
      <div className="mx-auto max-w-[760px]">
        <p className="m-0 mb-6 text-[11px] uppercase tracking-[0.22em] text-white/70">10 / Итог</p>
        <h2 className="m-0 mb-7 text-balance font-display text-[clamp(34px,8vw,84px)] font-extrabold uppercase leading-[0.98] tracking-[-0.02em] text-white">
          Обучение до сих пор держится на людях?
        </h2>
        <p className="m-0 mb-9 text-pretty text-[16px] leading-[1.6] text-white/80">
          Можно начать с разбора текущего процесса — без готового ТЗ и без обязательства сразу создавать большую систему.
        </p>
        <CtaLink
          href="#contact"
          location="secondary"
          className="inline-flex min-h-[56px] items-center justify-center bg-graphite px-9 text-base font-medium uppercase tracking-[0.04em] text-cream transition-colors hover:bg-[#1a1a1f]"
        >
          Рассказать, как всё устроено
        </CtaLink>
      </div>
    </section>
  );
}
