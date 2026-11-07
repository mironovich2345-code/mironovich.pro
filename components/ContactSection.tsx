import LeadForm from "./LeadForm";
import SectionLabel from "./SectionLabel";

export default function ContactSection({
  index = "08",
  title = "Обсудим вашу техническую задачу",
  lead = "Нужно выбрать решение, проверить предложение или наладить сопровождение продукта? Опишите ситуацию: я изучу обращение и свяжусь, чтобы уточнить детали. Первичное обсуждение бесплатно.",
}: {
  index?: string;
  title?: string;
  lead?: string;
}) {
  return (
    <section id="contact" className="bg-graphite px-[22px] py-16 min-[560px]:py-24">
      <div className="mx-auto max-w-[1080px]">
        <SectionLabel index={index} label="Обсудить задачу" note="Первичное обсуждение — бесплатно" />

        <div className="grid gap-12 min-[900px]:grid-cols-[1fr_1.1fr] min-[900px]:gap-20">
          <div>
            <h2 className="m-0 mb-5 max-w-[14ch] text-balance font-display text-[clamp(32px,6vw,62px)] font-extrabold uppercase leading-[0.98] tracking-[-0.02em] text-cream">
              {title}<span className="text-signal">.</span>
            </h2>
            <p className="m-0 max-w-[42ch] text-pretty text-[16px] leading-[1.65] text-cream/80">{lead}</p>
          </div>

          <div className="relative">
            <LeadForm />
          </div>
        </div>
      </div>
    </section>
  );
}
