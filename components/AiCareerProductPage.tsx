import Image from "next/image";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { careerLoginHref } from "@/config/career-access";
import { commerceCopy } from "@/config/ai-career-commerce";
import { rubles } from "@/config/ai-career-pricing";
import AiCareerPrice from "@/components/AiCareerPrice";
import { readCurrentPrice } from "@/lib/server/commerce/price-current";
import type { DigitalProduct } from "@/content/products";

const features = [
  { number: "01", metric: "18 вопросов", title: "Разобраться в своих задачах", body: "Опишете свою работу, повторяющиеся действия и ограничения. Получите карту до пяти рабочих задач." },
  { number: "02", metric: "1 анализ", title: "Понять, где поможет ИИ", body: "Получите персональный разбор возможностей и ограничений. Это не прогноз увольнения." },
  { number: "03", metric: "30 шагов", title: "Перейти от идей к действиям", body: "Последовательно проверите одну задачу, оцените качество результата и соберёте пример своей работы." },
  { number: "04", metric: "PDF-отчёт", title: "Сохранить результат", body: "Карта задач, направления развития и план действий в одном документе для скачивания." },
];

const stages = [
  { steps: "01–06", title: "Разберите задачу", body: "Выберите рабочую задачу, опишите процесс и зафиксируйте исходный результат." },
  { steps: "07–14", title: "Попробуйте ИИ", body: "Подготовьте разрешённые или учебные данные и сравните несколько подходов." },
  { steps: "15–23", title: "Проверьте качество", body: "Повторите эксперимент, оцените ошибки и сравните показатели до и после." },
  { steps: "24–30", title: "Оформите результат", body: "Подготовьте пример своего вклада и определите следующие действия." },
];

const legalLinks = [
  { href: "/offer/ai-career", label: "Условия использования и оферта" },
  { href: "/delivery", label: "Получение доступа" },
  { href: "/refund", label: "Порядок разрешения разногласий" },
  { href: "/requisites", label: "Реквизиты и контакты" },
  { href: "/privacy", label: "Персональные данные" },
  { href: "/consent", label: "Согласие для обращения" },
];

export default async function AiCareerProductPage({ product }: { product: DigitalProduct }) {
  // Read on the server at request time (see app/products/[slug]/page.tsx revalidate); never from the browser.
  const price = await readCurrentPrice();
  return (
    <main id="main" className="bg-graphite px-[22px] pb-20 pt-8 text-cream">
      <div className="mx-auto max-w-[1080px]">
        <Breadcrumbs items={[
          { name: "Главная", href: "/" },
          { name: "Продукты", href: "/products" },
          { name: product.title, href: "/products/ai-career" },
        ]} />
        <section className="mt-10 grid items-center gap-10 min-[860px]:grid-cols-2">
          <div>
            <p className="mb-4 text-sm uppercase tracking-wider text-stone">Сотрудникам и специалистам · 18+</p>
            <h1 className="font-display text-[clamp(34px,5vw,62px)] font-extrabold uppercase leading-[1.04]">{product.title}</h1>
            <p className="mt-6 text-[18px] leading-relaxed text-cream/85">
              Разберите свои рабочие задачи, выясните, где ИИ действительно поможет, и получите персональный план из 30 последовательных шагов.
            </p>
            <p role="status" className="my-6 border-l-2 border-signal bg-cream/5 p-4 text-sm leading-relaxed">
              Платформа разрабатывается. Заказы и оплата пока недоступны. Эта страница описывает запланированный состав продукта, а не уже открытый доступ.
            </p>
            <a href="mailto:damironovich@mail.ru?subject=Вопрос%20о%20продукте%20для%20сотрудников" className="inline-flex min-h-[48px] items-center border border-cream/40 px-5 text-sm font-medium hover:border-signal">
              Задать вопрос о продукте
            </a>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <a href={careerLoginHref} className="inline-flex min-h-[48px] items-center border border-cream/55 px-5 text-sm font-semibold text-cream hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                Войти в обучение
              </a>
              <p className="m-0 max-w-[320px] text-[13px] leading-relaxed text-stone">Для участников закрытого тестирования. Регистрация пока по приглашению, продажи не открыты.</p>
            </div>
          </div>
          <Image
            src={product.cover} width={960} height={640}
            alt={"Обложка продукта: " + product.title}
            className="h-auto w-full" priority
          />
        </section>
        <section className="mt-20" aria-labelledby="product-contents-title">
          <div className="max-w-[690px]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-signal">Одна покупка — четыре результата</p>
            <h2 id="product-contents-title" className="font-display text-[clamp(28px,4vw,38px)] font-extrabold uppercase leading-tight">Что входит</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-stone">От разбора своей работы до конкретных действий. Каждый результат помогает перейти к следующему.</p>
          </div>
          <div className="mt-8 grid gap-4 min-[700px]:grid-cols-2">
            {features.map(({ number, metric, title, body }) => (
              <article key={number} className="flex h-full flex-col border border-cream/20 bg-cream/[0.035] p-5 min-[700px]:min-h-[220px] min-[700px]:p-7">
                <div className="flex items-center justify-between gap-4 border-b border-cream/15 pb-4">
                  <span className="font-display text-[31px] font-extrabold leading-none text-signal" aria-hidden="true">{number}</span>
                  <span className="text-[13px] font-medium text-cream/85">{metric}</span>
                </div>
                <h3 className="mt-5 text-[19px] font-semibold leading-snug text-cream">{title}</h3>
                <p className="mt-3 text-[15px] leading-[1.7] text-stone">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mt-16 border-t border-cream/20 pt-10" aria-labelledby="product-steps-title">
          <div className="max-w-[740px]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-signal">Пошаговая практика</p>
            <h2 id="product-steps-title" className="font-display text-[clamp(28px,4vw,38px)] font-extrabold uppercase leading-tight">30 шагов — от задачи до результата</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-stone">Не календарь на 30 дней: проходите шаги в собственном темпе в течение оплаченного доступа.</p>
          </div>
          <ol className="mt-8 grid gap-4 min-[700px]:grid-cols-2">
            {stages.map(({ steps, title, body }) => (
              <li key={steps} className="list-none border-l-2 border-signal bg-cream/[0.035] px-5 py-5">
                <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-signal">Шаги {steps}</p>
                <h3 className="mt-2 text-[18px] font-semibold text-cream">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-stone">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm leading-relaxed text-stone">Рекомендации не гарантируют сохранение работы, повышение зарплаты или конкретную экономию времени.</p>
        </section>
        <section className="mt-16 border-t border-cream/25 pt-10" aria-labelledby="ai-career-price-heading">
          <h2 id="ai-career-price-heading" className="font-display text-[clamp(25px,4vw,35px)] font-extrabold uppercase leading-[1.1]">Стоимость программы</h2>
          <div className="mt-6 grid gap-6 border-l-2 border-signal bg-cream/[0.035] p-6 min-[700px]:grid-cols-[minmax(0,1fr)_auto] min-[700px]:items-center min-[700px]:p-8">
            <div>
              <AiCareerPrice price={price} />
              <p className="mt-5 max-w-[65ch] text-[15px] leading-relaxed text-cream/85">{commerceCopy.initialPurchase}</p>
              <p className="mt-3 max-w-[65ch] text-[13px] leading-relaxed text-stone">
                Цена может меняться в разные периоды. Сумма фиксируется в заказе при его оформлении, показывается до подтверждения оплаты и после этого не меняется. Без обязательных дополнений и подписки.
              </p>
            </div>
            <div className="min-w-[200px]">
              <button
                type="button"
                disabled
                aria-describedby="ai-career-payment-status"
                className="inline-flex min-h-[52px] w-full cursor-not-allowed items-center justify-center bg-signal/65 px-5 text-center text-[14px] font-bold uppercase tracking-[0.03em] text-white/90"
              >
                {price.known ? <>Купить за {rubles(price.priceRub)}</> : "Купить"}
              </button>
              <p id="ai-career-payment-status" role="status" className="mt-3 max-w-[270px] text-[13px] leading-relaxed text-cream/75">
                Приём онлайн-платежей через ЮKassa ещё подключается. Пока оплатить и получить доступ нельзя.
              </p>
            </div>
          </div>
        </section>
        <section className="mt-10 border-t border-cream/20 pt-8" aria-labelledby="ai-career-checkout-title">
          <h2 id="ai-career-checkout-title" className="text-[23px] font-semibold">Как будет проходить покупка</h2>
          <ol className="mt-5 grid gap-4 min-[700px]:grid-cols-3">
            <li className="list-none border border-cream/20 p-5">
              <span className="text-xs font-bold text-signal">01 / Оформление</span>
              <p className="mb-0 mt-3 text-[14px] leading-relaxed text-cream/80">После подключения оплаты вы укажете email, подтвердите возраст 18+ и согласитесь с условиями покупки.</p>
            </li>
            <li className="list-none border border-cream/20 p-5">
              <span className="text-xs font-bold text-signal">02 / Оплата</span>
              <p className="mb-0 mt-3 text-[14px] leading-relaxed text-cream/80">Оплатите сумму, зафиксированную в вашем заказе, через ЮKassa. Доступные способы оплаты отобразятся при оформлении.</p>
            </li>
            <li className="list-none border border-cream/20 p-5">
              <span className="text-xs font-bold text-signal">03 / Доступ</span>
              <p className="mb-0 mt-3 text-[14px] leading-relaxed text-cream/80">После подтверждения успешной оплаты получите доступ к кабинету по email и сможете пройти диагностику, 30 шагов и скачать PDF.</p>
            </li>
          </ol>
          <p className="mt-4 max-w-[80ch] text-[13px] leading-relaxed text-stone">Это порядок, предусмотренный к запуску. Сейчас оформление и списание денег выключены. Физическая доставка не требуется.</p>
        </section>
        <section className="mt-16 grid gap-6 border-t border-cream/25 pt-8 min-[700px]:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Получение и срок доступа</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-stone">
              После запуска продаж доступ предоставляется сразу после подтверждения оплаты через учётную запись по email. Доступ действует 90 дней. Результаты планируется сохранять ещё 30 дней после окончания срока.
            </p>
            <Link href="/delivery" className="mt-2 inline-flex min-h-[44px] items-center text-sm underline underline-offset-4">Подробнее о получении доступа</Link>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Дополнительный доступ</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-stone">
              По отдельной покупке — 1 490 ₽ за 12 месяцев с момента оплаты. Повторный анализ не включён, срок не складывается с оставшимися днями. Без автопродления.
            </p>
            <p className="mt-2 text-xs text-stone">Приобрести дополнительный доступ пока нельзя.</p>
          </div>
        </section>
        <section className="mt-12 border-t border-cream/25 pt-9" aria-labelledby="product-documents-title">
          <h2 id="product-documents-title" className="text-[24px] font-semibold">Документы</h2>
          <p className="mt-3 max-w-[72ch] text-[15px] leading-relaxed text-stone">
            Условия будущей покупки, доступ к продукту, порядок разрешения разногласий, реквизиты и обработка персональных данных — в отдельных документах. Условия возврата денежных средств сохраняются.
          </p>
          <ul className="mt-6 grid gap-3 min-[600px]:grid-cols-2">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex min-h-[56px] items-center justify-between gap-4 border border-cream/20 px-4 py-3 text-[14px] leading-snug text-cream transition-colors hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
                  <span>{item.label}</span>
                  <span className="text-signal" aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
