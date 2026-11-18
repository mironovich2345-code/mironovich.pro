import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { aiCareerCommerce, commerceCopy } from "@/config/ai-career-commerce";

type Section = { title: string; paragraphs: string[] };
type Props = { title: string; lead: string; sections: Section[] };

const related = [
  { href: "/offer/ai-career", label: "Условия использования и оферта" },
  { href: "/delivery", label: "Получение доступа" },
  { href: "/refund", label: "Возврат денежных средств" },
  { href: "/requisites", label: "Реквизиты и контакты" },
  { href: "/privacy", label: "Обработка персональных данных" },
  { href: "/consent", label: "Согласие для обращения" },
];

export default function CommerceDocument({ title, lead, sections }: Props) {
  return (
    <main id="main" className="bg-graphite px-[22px] pb-20 pt-8 text-cream">
      <div className="mx-auto max-w-[900px]">
        <Breadcrumbs items={[
          { name: "Главная", href: "/" },
          { name: "Продукт для сотрудников", href: "/products/ai-career" },
          { name: title, href: "#" },
        ]} />
        <h1 className="mb-6 mt-10 font-display text-[clamp(32px,5.5vw,58px)] font-extrabold uppercase leading-tight">{title}</h1>
        <p className="max-w-[72ch] text-[17px] leading-[1.65] text-cream/85">{lead}</p>
        <p className="mt-4 text-sm leading-relaxed text-stone">{commerceCopy.edition}</p>
        <p className="mt-2 text-sm leading-relaxed text-cream">{commerceCopy.age}</p>
        {!aiCareerCommerce.legalApproved && (
          <p role="status" className="mt-7 border-l-2 border-signal bg-cream/5 p-4 text-sm leading-relaxed text-cream">
            Предварительные условия будущих продаж. Продукт ещё разрабатывается, оплата не подключена.
            Окончательная редакция документов будет утверждена перед началом продаж.
          </p>
        )}
        <div className="mt-12 space-y-10">
          {sections.map((section, index) => (
            <section key={section.title} className="border-t border-cream/20 pt-6">
              <h2 className="mb-4 text-[23px] font-bold">{index + 1}. {section.title}</h2>
              <div className="space-y-4">
                {section.paragraphs.map((paragraph, i) => (
                  <p key={i} className="m-0 max-w-[76ch] text-[15px] leading-[1.75] text-cream/85">{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <nav aria-label="Документы и условия покупки" className="mt-14 border-t border-cream/20 pt-7">
          <h2 className="mb-4 text-lg font-semibold">Связанные документы</h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {related.map((item) => (
              <li key={item.href}><Link href={item.href} className="underline underline-offset-4 hover:text-signal">{item.label}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
