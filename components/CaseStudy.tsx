import DashboardMockup from "./DashboardMockup";
import Reveal from "./Reveal";

const steps = [
  {
    label: "Проблема",
    body: "Обучение, планы, результаты и документы жили в разных сервисах. Руководитель собирал картину вручную и всегда с опозданием.",
  },
  {
    label: "Решение",
    body: "Разобрали процесс сотрудника от первого дня до карьерного роста и собрали одну среду: обучение и адаптация, база знаний, планы на день, результаты, документы.",
  },
  {
    label: "Система",
    body: "Сверху — управленческая аналитика и контроль процессов, дальше поверх накопленных данных подключаются AI-инструменты.",
  },
];

export default function CaseStudy() {
  return (
    <section id="case" className="mx-auto max-w-[1080px] scroll-mt-4 px-[22px] py-10 min-[560px]:py-14">
      <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-accent-400">04 — Пример проекта</p>
      <h2 className="m-0 mb-7 max-w-[24ch] text-balance text-[clamp(25px,5.8vw,40px)] font-medium leading-[1.12] tracking-[-0.03em]">
        Например, сейчас я развиваю внутреннюю платформу для сети фитнес-клубов
      </h2>

      <div className="grid items-start gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <div className="flex flex-col gap-[22px]">
          {steps.map((s, i) => (
            <div key={s.label} className="flex flex-col gap-[22px]">
              <Reveal delay={i * 0.06}>
                <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-neutral-600">{s.label}</p>
                <p className="m-0 text-pretty text-[15px] leading-[1.6] text-neutral-300">{s.body}</p>
              </Reveal>
              {i < steps.length - 1 && (
                <div aria-hidden className="h-px" style={{ background: "linear-gradient(90deg, #292b31, transparent)" }} />
              )}
            </div>
          ))}
          <p className="m-0 mt-1.5 text-balance text-[clamp(19px,4.6vw,27px)] leading-[1.26] tracking-[-0.025em]">
            Из набора разрозненных процессов <span className="text-accent-400">→</span> в единую систему управления.
          </p>
        </div>

        <Reveal delay={0.1}>
          <DashboardMockup />
        </Reveal>
      </div>
    </section>
  );
}
