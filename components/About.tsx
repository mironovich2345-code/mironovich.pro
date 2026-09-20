import Image from "next/image";
import Reveal from "./Reveal";

export default function About() {
  return (
    <section id="about" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] py-10 min-[560px]:py-14">
      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">03 — Обо мне</p>

      <div className="grid items-start gap-x-11 gap-y-[30px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <div>
          <h2 className="m-0 mb-[22px] max-w-[18ch] text-balance text-[clamp(25px,5.8vw,40px)] font-medium leading-[1.12] tracking-[-0.03em]">
            Сначала разбираюсь в бизнесе. Потом — в технологии.
          </h2>
          <p className="m-0 mb-4 max-w-[54ch] text-pretty text-[clamp(15px,4vw,17px)] leading-[1.7] text-neutral-300">
            Меня зовут Данил Миронович. Я пришёл в разработку из операционного управления, поэтому смотрю на цифровые продукты не только со стороны кода.
            Мне знакомы реальные процессы бизнеса: сотрудники, обучение, продажи, контроль
            и ежедневная операционная работа.
          </p>
          <p className="m-0 mb-[26px] max-w-[54ch] text-pretty text-[clamp(15px,4vw,17px)] leading-[1.7] text-neutral-300">
            Сегодня я соединяю этот опыт с разработкой, автоматизацией и AI — чтобы создавать решения, которые работают
            внутри компании, а не только красиво выглядят в презентации.
          </p>
          <p className="m-0 mb-[26px] max-w-[54ch] text-pretty text-[clamp(15px,4vw,17px)] leading-[1.7] text-neutral-300">
            Поэтому начинаю не с вопроса «Что будем программировать?», а с «Какую проблему бизнеса нужно решить?»
          </p>
          <p
            className="m-0 pt-[18px] text-[13px] uppercase tracking-[0.12em] text-neutral-400"
            style={{
              backgroundImage: "linear-gradient(90deg, #5d5294, transparent)",
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 1px",
            }}
          >
            Операционное управление <span className="text-accent-400">→</span> продукт{" "}
            <span className="text-accent-400">→</span> разработка <span className="text-accent-400">→</span> AI
          </p>
        </div>

        <Reveal>
          <div className="flex flex-wrap items-end gap-3.5">
            <figure className="m-0 flex-[2_1_250px]">
              <Image
                src="/images/danil-mironovich-main.webp"
                alt="Данил Миронович — цифровые продукты и автоматизация бизнеса"
                loading="lazy"
                width={1024} height={1536}
                sizes="(max-width: 700px) 62vw, 340px"
                className="block aspect-[4/5.4] w-full rounded-md object-cover object-[50%_20%] shadow-[0_0_0_1px_#3f424d]"
              />
            </figure>
            <figure className="relative m-0 max-w-[58%] flex-[1_1_178px] min-[560px]:max-w-none">
              <Image
                src="/images/danil-mironovich-work.webp"
                alt="Презентация решения для автоматизации бизнес-процессов"
                loading="lazy"
                width={1009} height={806}
                sizes="(max-width: 700px) 40vw, 200px"
                className="block aspect-[4/3] w-full rounded-md object-cover object-[18%_50%] shadow-[0_0_0_1px_#3f424d]"
              />
              <figcaption className="absolute left-[15%] top-[56%] flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-ink [text-shadow:0_1px_6px_rgba(10,11,18,0.9)]">
                <span aria-hidden className="relative inline-block h-px w-[28px] bg-accent">
                  <span className="absolute left-0 top-[-3px] h-[7px] w-[7px] rotate-45 border-b border-l border-accent" />
                </span>
                в работе
              </figcaption>
            </figure>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
