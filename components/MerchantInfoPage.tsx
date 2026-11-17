import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

export type MerchantSection = { heading: string; paragraphs?: string[]; items?: string[] };
export const merchantLinks = [
  { href: "/service-prices", label: "Услуги и цены" },
  { href: "/service-delivery", label: "Как заказать и получить услугу" },
  { href: "/service-terms", label: "Условия оказания услуг" },
  { href: "/service-refunds", label: "Отказ и возврат" },
  { href: "/requisites", label: "Реквизиты и контакты" },
];
export default function MerchantInfoPage({ title, lead, path, sections, children }: {
  title: string; lead: string; path: string; sections: MerchantSection[]; children?: React.ReactNode;
}) {
  return <main id="main" className="bg-graphite px-[22px] pb-20 pt-8 text-cream">
    <div className="mx-auto max-w-[940px]">
      <Breadcrumbs items={[{ name: "Главная", href: "/" }, { name: "Услуги", href: "/services" }, { name: title, href: path }]} />
      <h1 className="mt-10 max-w-[21ch] font-display text-[clamp(32px,5.5vw,64px)] font-extrabold uppercase leading-[1.04]">{title}<span className="text-signal">.</span></h1>
      <p className="mt-7 max-w-[76ch] text-[17px] leading-relaxed text-cream/85">{lead}</p>
      <div className="mt-12 space-y-9">
        {sections.map((section) => <section key={section.heading} className="border-t border-cream/20 pt-6">
          <h2 className="mb-4 text-[22px] font-semibold">{section.heading}</h2>
          <div className="space-y-3">
            {section.paragraphs?.map((text) => <p key={text} className="m-0 max-w-[82ch] text-[15px] leading-[1.75] text-cream/85">{text}</p>)}
          </div>
          {section.items && <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-[1.7] text-cream/85">{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
        </section>)}
      </div>
      {children}
      <nav aria-label="Документы и информация для заказчиков" className="mt-14 border-t border-cream/25 pt-7">
        <h2 className="mb-4 text-lg font-semibold">Для заказчиков</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">{merchantLinks.map(l=><li key={l.href}><Link href={l.href} className="underline underline-offset-4 hover:text-signal">{l.label}</Link></li>)}</ul>
        <p className="mt-6 text-sm text-stone">Обработка персональных данных: <Link href="/privacy" className="underline underline-offset-4">политика</Link> и <Link href="/consent" className="underline underline-offset-4">согласие</Link>.</p>
      </nav>
    </div>
  </main>;
}
