import CtaLink from "./CtaLink";

export default function SecondaryCta() {
  return (
    <section className="mx-auto max-w-[720px] px-[22px] pb-16 pt-11 text-center">
      <p className="m-0 mb-2 text-balance text-[clamp(20px,5vw,27px)] leading-[1.2] tracking-[-0.025em]">
        Не уверены, какое решение вам нужно?
      </p>
      <p className="m-0 mb-5 text-[15px] leading-[1.55] text-neutral-500">
        Это нормально. Можно начать просто с описания проблемы.
      </p>
      <CtaLink
        href="#contact"
        location="secondary"
        className="inline-flex min-h-[52px] items-center justify-center rounded-md border border-accent-700 px-[30px] text-base text-accent-300 transition-colors hover:border-accent hover:bg-accent-900 hover:text-accent-100"
      >
        Рассказать о задаче
      </CtaLink>
    </section>
  );
}
