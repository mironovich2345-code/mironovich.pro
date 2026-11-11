import Image from "next/image";
import Link from "next/link";
import SectionLabel from "./SectionLabel";

export default function About({ index = "05" }: { index?: string }) {
  return (
    <section id="about" className="bg-graphite px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel index={index} label="Обо мне" note="Данил Миронович" />

        <div className="grid gap-12 min-[900px]:grid-cols-[1.15fr_0.85fr] min-[900px]:gap-16">
          <div className="flex flex-col gap-7">
            <h2 className="m-0 max-w-[14ch] font-display text-[clamp(38px,7.4vw,84px)] font-extrabold uppercase leading-[0.94] tracking-[-0.025em] text-cream">
              Понимаю процессы <span className="text-signal">изнутри.</span>
            </h2>

            <div className="flex flex-col gap-4 border-t border-cream/15 pt-6">
              <p className="m-0 max-w-[56ch] text-pretty text-[16px] leading-[1.7] text-cream/80">
                Прошёл путь от ночного администратора до регионального директора сети фитнес-клубов. Отвечал за
                команды, продажи, обучение новых сотрудников и ежедневные процессы. Знаю, как выглядит ручное
                управление со стороны руководителя.
              </p>
              <p className="m-0 max-w-[56ch] text-pretty text-[16px] leading-[1.7] text-cream/80">
                Сегодня соединяю этот опыт с разработкой: помогаю выбрать решение, оценить исполнителей и вести продукт после запуска. Могу реализовать задачу сам или организовать работу специалистов.
              </p>
            </div>

            <p className="m-0 max-w-[34ch] text-balance border-l-2 border-signal pl-5 text-[clamp(19px,3vw,24px)] leading-[1.35] tracking-[-0.015em] text-cream">
              Сначала задача бизнеса. Потом технология.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-cream/15 pt-6">
              <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-stone">
                Операционное управление <span className="text-signal">→</span> процессы{" "}
                <span className="text-signal">→</span> разработка <span className="text-signal">→</span> ИИ
              </p>
              <Link
                href="/about"
                className="inline-flex min-h-[44px] items-center whitespace-nowrap text-[13px] uppercase tracking-[0.1em] text-cream underline decoration-cream/30 underline-offset-4 transition-colors hover:text-signal"
              >
                Подробнее обо мне →
              </Link>
            </div>
          </div>

          {/* Editorial portrait — same file and crop at every width: no card, frame, caption or colour treatment. */}
          <figure className="relative m-0 aspect-[2/3] w-full overflow-hidden">
            <Image
              src="/images/danil-mironovich-editorial.webp"
              alt="Данил Миронович"
              width={853}
              height={1280}
              sizes="(max-width: 900px) 100vw, 40vw"
              className="block h-full w-full object-cover"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
