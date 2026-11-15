import CtaLink from "./CtaLink";
import { ctoOffer } from "@/config/commercial";
import { rub } from "@/config/solutions";

export default function CtoOffer() {
  return (
    <section id="cto" className="bg-graphite px-[22px] py-14 min-[560px]:py-20">
      <div className="mx-auto grid max-w-[1080px] gap-8 min-[860px]:grid-cols-[1.2fr_1fr] min-[860px]:gap-16">
        <div>
          <p className="m-0 mb-5 text-[11px] uppercase tracking-[0.18em] text-stone">
            Отдельный формат · техническое управление
          </p>
          <h2 className="m-0 font-display text-[clamp(32px,5vw,54px)] font-extrabold uppercase leading-[1.03] text-cream">
            Внешний технологический директор
          </h2>
          <p className="mb-0 mt-5 max-w-[50ch] text-[16px] leading-relaxed text-cream/80">
            Определяю, что стоит разрабатывать, оцениваю сметы и подрядчиков,
            координирую работу и контролирую приёмку. Разработка конкретной
            системы — отдельный проект.
          </p>
        </div>
        <div className="flex flex-col justify-center border-t border-cream/20 pt-7 min-[860px]:border-l min-[860px]:border-t-0 min-[860px]:pl-8 min-[860px]:pt-0">
          <p className="m-0 font-display text-[clamp(32px,4vw,44px)] font-extrabold text-cream">
            {rub(ctoOffer.monthlyPrice)}
            <span className="ml-2 font-sans text-[15px] font-normal text-stone">
              в месяц
            </span>
          </p>
          <p className="mb-5 mt-2 text-cream/80">
            До {ctoOffer.hours} часов в месяц. Без 24/7 и неограниченной
            разработки. Лицензии и подрядчики отдельно.
          </p>
          <CtaLink
            href="/services/cto"
            location="cto_offer"
            className="inline-flex min-h-[48px] items-center text-cream underline decoration-signal underline-offset-4"
          >
            Состав работы, границы и первый месяц →
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
