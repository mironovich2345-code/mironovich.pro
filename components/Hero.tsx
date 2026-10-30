import CtaLink from "./CtaLink";
import { contactHref, projectsPublished } from "@/config/site";

const tasks = ["Отчёты", "CRM и API", "Заявки и уведомления", "Внутренние приложения", "Дашборды", "Обучение сотрудников"];

const secondaryClass =
  "inline-flex min-h-[48px] items-center justify-center border border-cream/30 px-6 text-[14px] uppercase tracking-[0.06em] text-cream transition-colors hover:border-cream";

/**
 * Sized so H1, subtitle and the primary CTA fit the first screen at 1440×900,
 * 390×844 and 375×667. The ghost wordmark is desktop-only texture.
 */
export default function Hero() {
  return (
    <section id="hero" className="relative overflow-hidden bg-graphite px-[22px] pb-14 pt-6 min-[560px]:pb-16 min-[560px]:pt-12">
      <p
        aria-hidden
        className="pointer-events-none absolute -right-6 top-2 hidden select-none whitespace-nowrap font-display text-[clamp(140px,22vw,320px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream/[0.04] min-[860px]:block"
      >
        Mironovich
      </p>

      <div className="relative mx-auto flex max-w-[1080px] flex-col gap-6 min-[560px]:gap-9">
        <p className="m-0 text-[11px] uppercase leading-[1.6] tracking-[0.2em] text-stone">
          Данил Миронович <span className="text-signal">/</span> Автоматизация · Приложения · Обучение
        </p>

        <h1 className="m-0 font-display text-[clamp(38px,6.4vw,88px)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-cream">
          <span className="block">Меньше ручной работы.</span>{" "}
          <span className="block">
            Больше управляемости<span className="text-signal">.</span>
          </span>
        </h1>

        <div className="grid gap-6 min-[860px]:grid-cols-[1fr_auto] min-[860px]:items-end min-[860px]:gap-12 min-[860px]:border-t min-[860px]:border-cream/15 min-[860px]:pt-8">
          <p className="m-0 max-w-[54ch] text-pretty text-[16px] leading-[1.55] text-cream/80 min-[560px]:text-[18px]">
            Автоматизирую бизнес-процессы, разрабатываю внутренние приложения и внедряю ИИ-инструменты. От разбора
            задачи до работающего решения.
          </p>

          <div className="flex flex-col gap-3 min-[480px]:flex-row min-[860px]:flex-col min-[860px]:items-stretch">
            <CtaLink
              href={contactHref}
              location="hero"
              className="inline-flex min-h-[56px] items-center justify-center whitespace-nowrap bg-signal px-5 text-center text-[14px] font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] min-[400px]:px-8 min-[400px]:text-[15px] min-[400px]:tracking-[0.06em]"
            >
              Обсудить задачу бесплатно
            </CtaLink>
            {projectsPublished ? (
              <a href="/projects" className={secondaryClass}>Посмотреть проекты</a>
            ) : (
              <a href="#services" className={secondaryClass}>Направления работы ↓</a>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-cream/15 pt-6">
          <p className="m-0 max-w-[60ch] text-pretty text-[14px] leading-[1.6] text-stone">
            Начинаем с бесплатного обсуждения задачи: разберёмся, что действительно стоит менять.{" "}
            <span className="text-cream/80">Пришёл в разработку из операционного управления бизнесом.</span>
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-[11px] uppercase tracking-[0.16em] text-stone">
            {tasks.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
