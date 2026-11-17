import type { Metadata } from "next";
import CommerceDocument from "@/components/CommerceDocument";
import { aiCareerCommerce, commerceCopy, seller } from "@/config/ai-career-commerce";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Продавец, реквизиты и контакты — MIRONOVICH",
  description: "Контактные данные и ИНН продавца цифрового продукта.",
  path: "/requisites",
  noindex: !aiCareerCommerce.legalApproved,
});

export default function Requisites() {
  return <CommerceDocument title="Реквизиты и контакты" lead="Информация о продавце интерактивного цифрового продукта для сотрудников."
    sections={[
      { title: "Сведения о продавце", paragraphs: [
        "ФИО: " + seller.name + ".",
        "Заявленный налоговый статус: физическое лицо на НПД; актуальный статус и применимость режима к фактическому продукту проверяются перед запуском продаж. Продавец не представлен как ИП: ОГРНИП не заявлен.",
        "ИНН: " + seller.taxId + ".",
        "Адрес для письменных обращений: " + seller.postalAddress + ".",
        "Сайт: https://mironovich.pro.",
      ]},
      { title: "Связь и обращения", paragraphs: [
        "Электронная почта по заказам, предоставлению доступа, возвратам и персональным данным: " + seller.email + ".",
        "Контактный телефон: " + seller.phone + ".",
        "Дополнительный канал связи: Telegram — " + seller.telegram + ". Для юридически значимых обращений рекомендуется электронная почта.",
      ]},
      { title: "Стоимость предлагаемого продукта", paragraphs: [
        commerceCopy.initialPurchase,
        "Необязательный дополнительный доступ: 1 490 ₽ за 12 месяцев с момента оплаты. Новый анализ не включён; автоматических платежей нет.",
        "Оплата через ЮKassa планируется, но ещё не включена. Документ НПД («Мой налог») предоставляется по требованиям законодательства после фактической оплаты."
      ]},
    ]}
  />;
}
