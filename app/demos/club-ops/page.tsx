import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CtaLink from "@/components/CtaLink";
import ClubOpsSandbox from "@/components/demos/ClubOpsSandbox";
import { contactHref } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "CLUB OPS — интерактивный пример финансовой панели",
  description: "Три интерактивных учебных сценария: план/факт расходов, кассовый остаток и расходы на одну продажу. Только синтетические данные.",
  path: "/demos/club-ops",
  noindex: true,
});

export default function ClubOpsDemoPage() {
  return (
    <main id="main">
      <section className="bg-graphite px-[22px] pb-12 pt-6 min-[560px]:pb-16 min-[560px]:pt-10">
        <div className="mx-auto max-w-[1080px]">
          <Breadcrumbs items={[
            { name: "Главная", href: "/" },
            { name: "Проекты", href: "/projects" },
            { name: "CLUB OPS", href: "/projects/club-ops" },
            { name: "Демонстрация", href: "/demos/club-ops" },
          ]} />
          <p className="mb-3 mt-10 text-[12px] uppercase tracking-[0.18em] text-stone">Учебная демонстрация / без реальных данных</p>
          <h1 className="m-0 max-w-[20ch] text-balance font-display text-[clamp(34px,6vw,64px)] font-extrabold uppercase leading-[1.03] text-cream">
            Проверьте финансовую панель в действии<span className="text-signal">.</span>
          </h1>
          <p className="mb-0 mt-5 max-w-[65ch] text-[16px] leading-relaxed text-cream/80">
            Три простых сценария показывают, как руководитель может увидеть отклонения бюджета, риск кассового разрыва и стоимость продаж. Все цифры вымышлены — это самостоятельная модель интерфейса, а не доступ к CLUB OPS клиента.
          </p>
        </div>
      </section>
      <section className="bg-cream px-[22px] py-12 min-[560px]:py-20">
        <div className="mx-auto max-w-[1080px]">
          <ClubOpsSandbox />
        </div>
      </section>
      <section className="bg-graphite px-[22px] py-14 min-[560px]:py-20">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-6 min-[780px]:flex-row min-[780px]:items-center min-[780px]:justify-between">
          <div>
            <h2 className="m-0 font-display text-[clamp(28px,4vw,42px)] font-bold uppercase text-cream">
              Нужно видеть такие показатели в своём бизнесе?
            </h2>
            <p className="mb-0 mt-3 max-w-[60ch] text-[14px] leading-relaxed text-cream/75">
              Сначала разберём существующие источники данных и задачи управления. Разработка собственной системы нужна не всегда.
            </p>
            <Link href="/projects/club-ops" className="mt-4 inline-flex min-h-[44px] items-center text-[13px] text-cream underline underline-offset-4">
              Вернуться к разбору CLUB OPS →
            </Link>
          </div>
          <CtaLink href={contactHref} location="projects" className="inline-flex min-h-[52px] shrink-0 items-center justify-center bg-signal px-6 text-[13px] font-medium uppercase tracking-[0.05em] text-white hover:bg-[#b82323]">
            Запросить консультацию
          </CtaLink>
        </div>
      </section>
    </main>
  );
}
