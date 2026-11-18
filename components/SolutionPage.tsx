import Link from "next/link";
import Breadcrumbs from "./Breadcrumbs";
import ContactSection from "./ContactSection";
import CtaLink from "./CtaLink";
import ProjectCard from "./ProjectCard";
import StickyCta from "./StickyCta";
import SyntheticExample from "./SyntheticExample";
import TrackSolutionView from "./TrackSolutionView";
import {
  entryPrice,
  rub,
  solutionHref,
  solutions,
  type Solution,
} from "@/config/solutions";
import { projectBySlug, verifiedProjectDemo } from "@/content/projects";

const h2 =
  "m-0 font-display text-[clamp(28px,4.5vw,44px)] font-extrabold uppercase leading-[1.06] text-graphite";
export default function SolutionPage({ solution: s }: { solution: Solution }) {
  const project = projectBySlug(s.caseSlug),
    demo = project && verifiedProjectDemo(project);
  return (
    <>
      <main id="main">
        <section
          id="hero"
          className="bg-graphite px-[22px] pb-12 pt-6 min-[560px]:pb-16 min-[560px]:pt-10"
        >
          <div className="mx-auto max-w-[1080px]">
            <Breadcrumbs
              items={[
                { name: "Главная", href: "/" },
                { name: "Решения", href: "/solutions" },
                { name: s.title, href: solutionHref(s) },
              ]}
            />
            <p className="mb-4 mt-7 text-[12px] uppercase tracking-[0.18em] text-stone">
              Разработка и внедрение / {s.short}
            </p>
            <h1 className="m-0 max-w-[25ch] font-display text-[clamp(34px,6.5vw,76px)] font-extrabold uppercase leading-[0.99] text-cream">
              {s.title}
              <span className="text-signal">.</span>
            </h1>
            <p className="mb-0 mt-6 max-w-[64ch] text-[17px] leading-relaxed text-cream/80">
              {s.problem}
            </p>
            <div className="mt-8 flex flex-col justify-between gap-6 border-t border-cream/20 pt-6 min-[860px]:flex-row min-[860px]:items-center">
              <div>
                <p className="m-0 font-display text-[clamp(26px,3vw,36px)] font-bold text-cream">
                  {entryPrice(s)}
                </p>
                {s.full && (
                  <p className="mb-0 mt-2 text-[15px] text-stone">
                    Полный проект от {rub(s.full)}
                  </p>
                )}
              </div>
              <CtaLink
                href="#contact"
                location="solution_page"
                solution={s.slug}
                className="inline-flex min-h-[56px] items-center justify-center bg-signal px-6 text-[15px] text-white hover:bg-[#b82323]"
              >
                Обсудить проект
              </CtaLink>
            </div>
          </div>
        </section>
        <section className="bg-cream px-[22px] py-14 min-[560px]:py-20">
          <div className="mx-auto grid max-w-[1080px] gap-10 min-[860px]:grid-cols-[1.2fr_1fr] min-[860px]:gap-16">
            <div>
              <h2 className={h2}>Что разрабатываю</h2>
              <p className="mt-5 text-[17px] leading-relaxed text-graphite/80">
                {s.build}
              </p>
              <ul className="m-0 list-none border-t border-graphite/20 p-0">
                {s.scope.map((item) => (
                  <li
                    key={item}
                    className="border-b border-graphite/15 py-4 text-[15px] leading-relaxed text-graphite"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <aside>
              <h2 className={h2}>Кому подходит</h2>
              <p className="mt-5 text-[17px] leading-relaxed text-graphite/80">
                {s.audience}
              </p>
              <p className="mt-7 border-l-2 border-signal pl-4 text-[15px] leading-relaxed text-graphite/80">
                Сначала проверяю готовые инструменты и возможность настройки.
                Собственная разработка и ИИ нужны только при обоснованной
                задаче.
              </p>
            </aside>
          </div>
        </section>
        <section
          id="pilot"
          className="bg-graphite px-[22px] py-14 min-[560px]:py-20"
        >
          <div className="mx-auto grid max-w-[1080px] gap-10 min-[860px]:grid-cols-2 min-[860px]:gap-16">
            <div>
              <h2 className="m-0 font-display text-[clamp(28px,4.5vw,44px)] font-extrabold uppercase leading-tight text-cream">
                Первый ограниченный этап
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-cream/80">
                {s.pilotScope}
              </p>
              <p className="mt-5 text-[14px] leading-relaxed text-stone">
                Цены предварительные. Состав, доступы, этапы, критерии приёмки,
                стоимость и условия оплаты фиксируются до начала работ.
                Лицензии, инфраструктура и внешние сервисы согласуются отдельно.
              </p>
            </div>
            <div>
              <h3 className="m-0 text-[14px] font-semibold uppercase tracking-[0.08em] text-cream">
                Границы оценки
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-cream/80">
                {s.exclusions}
              </p>
              <h3 className="mb-3 mt-7 text-[14px] font-semibold uppercase tracking-[0.08em] text-cream">
                Как проверим результат
              </h3>
              <ul className="m-0 space-y-3 pl-5 text-[15px] leading-relaxed text-cream/80">
                {s.metrics.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section
          id="example"
          className="bg-cream px-[22px] py-14 min-[560px]:py-20"
        >
          <div className="mx-auto max-w-[1080px]">
            <h2 className={h2}>Что можно посмотреть</h2>
            <p className="mt-5 max-w-[70ch] text-[16px] leading-relaxed text-graphite/80">
              {s.readiness}
            </p>
            {project ? (
              <div className="mt-8 max-w-[760px]">
                <ProjectCard project={project} compact />
              </div>
            ) : (
              <p className="mt-5 max-w-[66ch] border-l-2 border-maroon pl-5 text-[15px] leading-relaxed text-graphite/80">
                Публичный кейс не опубликован: проверка доказательств и
                разрешений не завершена. Это предложение разработки;
                подтверждённые результаты клиента здесь не заявляются.
              </p>
            )}
            {demo && (
              <a
                href={demo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] items-center text-maroon underline underline-offset-4"
              >
                Открыть проверенное демо →
              </a>
            )}
            <SyntheticExample solution={s.slug} />
          </div>
        </section>
        <section className="bg-cream px-[22px] pb-14 min-[560px]:pb-20">
          <div className="mx-auto max-w-[1080px]">
            <h2 className={h2}>Как заказать внедрение</h2>
            <ol className="mt-7 grid list-none gap-6 p-0 min-[760px]:grid-cols-3">
              {[
                "Описываем задачу, пользователей и текущие системы.",
                "Согласуем границы пилота, доступы, цену и критерии приёмки.",
                "Разрабатываю, проверяем на согласованной выборке, принимаем решение о развитии.",
              ].map((step, i) => (
                <li
                  key={step}
                  className="border-t border-graphite/20 pt-5 text-[16px] leading-relaxed text-graphite"
                >
                  <span className="mb-3 block font-display text-[24px] font-bold text-maroon">
                    0{i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-8 max-w-[70ch] text-[15px] leading-relaxed text-graphite/75">
              Работаю лично, при необходимости привлекаю специалистов или
              взаимодействую с вашей командой. После пилота сопровождение и
              развитие согласуем отдельно.
            </p>
            <nav
              aria-label="Другие решения"
              className="mt-8 flex flex-wrap gap-x-7 gap-y-3 border-t border-graphite/15 pt-5"
            >
              {solutions
                .filter((x) => x.slug !== s.slug)
                .map((x) => (
                  <Link
                    key={x.slug}
                    href={solutionHref(x)}
                    className="inline-flex min-h-[44px] items-center text-[14px] text-maroon underline underline-offset-4"
                  >
                    {x.short} →
                  </Link>
                ))}
            </nav>
          </div>
        </section>
        <ContactSection
          index="05"
          title="Обсудим первый этап"
          lead="Опишите задачу и текущие системы. Первичное обсуждение бесплатно; состав пилота и цену согласуем до начала работ."
          defaultDirection={s.slug}
          defaultTask={`Хочу обсудить направление «${s.title}». Моя задача: `}
        />
      </main>
      <StickyCta />
      <TrackSolutionView solution={s.slug} />
    </>
  );
}
