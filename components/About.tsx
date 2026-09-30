import Image from "next/image";
import Link from "next/link";

export default function About() {
  return (
    <section id="about" className="scroll-mt-4 bg-cream px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-10 flex items-end justify-between gap-6 min-[560px]:mb-14">
          <p className="m-0 text-[11px] uppercase tracking-[0.22em] text-maroon">05 / Обо мне</p>
          <p className="m-0 hidden text-[11px] uppercase tracking-[0.22em] text-graphite/45 min-[560px]:block">
            Данил Миронович
          </p>
        </div>

        <div className="grid gap-12 min-[900px]:grid-cols-[1.15fr_0.85fr] min-[900px]:gap-16">
          <div className="flex flex-col gap-7">
            <h2 className="m-0 font-display text-[clamp(44px,10vw,116px)] font-extrabold uppercase leading-[0.92] tracking-[-0.025em] text-graphite">
              Не из <span className="text-signal">EdTech.</span>
            </h2>
            <p className="m-0 max-w-[36ch] text-balance text-[clamp(18px,3vw,23px)] leading-[1.4] tracking-[-0.01em] text-graphite/80">
              Я пришёл к системам обучения из операционного управления.
            </p>

            {/* Mobile: the long story lives on /about — keep only the pivot sentence here. */}
            <p className="m-0 max-w-[34ch] text-balance border-l-2 border-signal pl-5 text-[clamp(18px,3.2vw,23px)] leading-[1.4] tracking-[-0.015em] text-graphite min-[640px]:hidden">
              Сначала разбираю процесс. Потом выбираю технологии.
            </p>

            <div className="hidden flex-col gap-4 border-t border-graphite/15 pt-6 min-[640px]:flex">
              <p className="m-0 max-w-[56ch] text-pretty text-[15.5px] leading-[1.7] text-graphite/70">
                До разработки я работал с реальными операционными процессами бизнеса: сотрудниками, обучением, продажами,
                контролем и ежедневным управлением.
              </p>
              <p className="m-0 max-w-[56ch] text-pretty text-[15.5px] leading-[1.7] text-graphite/70">
                Мне приходилось самому сталкиваться с адаптацией новичков, передачей знаний и ситуациями, когда слишком
                многое в компании зависит от конкретного руководителя.
              </p>
            </div>

            <p className="m-0 hidden max-w-[34ch] text-balance border-l-2 border-signal pl-5 text-[clamp(18px,3.2vw,23px)] leading-[1.4] tracking-[-0.015em] text-graphite min-[640px]:block">
              Сначала разбираюсь, как работает обучение. Потом выбираю технологии.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-graphite/15 pt-6">
              <p className="m-0 hidden text-[11px] uppercase tracking-[0.14em] text-graphite/55 min-[640px]:block">
                Операционное управление <span className="text-signal">→</span> обучение{" "}
                <span className="text-signal">→</span> продукт <span className="text-signal">→</span> разработка{" "}
                <span className="text-signal">→</span> AI
              </p>
              <Link
                href="/about"
                className="ml-auto whitespace-nowrap text-[13px] uppercase tracking-[0.1em] text-maroon underline decoration-maroon/30 underline-offset-4 transition-colors hover:text-signal"
              >
                Обо мне →
              </Link>
            </div>
          </div>

          {/* Editorial portrait — same file and treatment on mobile and desktop: large vertical crop, no card, no frame, no caption, no color treatment. */}
          <figure className="relative m-0 w-full overflow-hidden aspect-[2/3]">
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
