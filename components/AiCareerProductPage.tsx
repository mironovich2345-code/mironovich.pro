import Image from "next/image";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { aiCareerCommerce, commerceCopy } from "@/config/ai-career-commerce";
import type { DigitalProduct } from "@/content/products";

const features = [
  { title: "Диагностика рабочих задач", body: "18 основных вопросов: профессия, задачи, повторяемость, ограничения, использование ИИ. До пяти карточек задач." },
  { title: "Персональный анализ", body: "Один анализ задач по критериям пригодности для безопасных экспериментов. Это не прогноз увольнения." },
  { title: "План из 30 шагов", body: "Практические упражнения, замеры времени и качества, проверка результатов, подготовка примера профессионального вклада." },
  { title: "PDF-отчёт", body: "Карта задач, три направления развития, план эксперимента и материалы для самостоятельного использования." },
];

const legalLinks = [
  { href: "/offer/ai-career", label: "Условия использования и оферта" },
  { href: "/delivery", label: "Получение доступа" },
  { href: "/refund", label: "Возврат средств" },
  { href: "/requisites", label: "Реквизиты и контакты" },
  { href: "/privacy", label: "Персональные данные" },
  { href: "/consent", label: "Согласие для обращения" },
];

export default function AiCareerProductPage({ product }: { product: DigitalProduct }) {
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
              Разберите свои рабочие задачи, выясните, где ИИ действительно может помочь, и получите личный план практики из 30 шагов.
            </p>
            <div className="mt-7 border-t border-cream/20 pt-5">
              <p className="m-0 text-4xl font-bold">{aiCareerCommerce.priceRub.toLocaleString("ru-RU")} ₽</p>
              <p className="mt-2 text-sm text-stone">Единоразовая цена при запуске · 90 дней доступа · один персональный анализ</p>
              <p className="mt-3 text-sm leading-relaxed text-stone">{commerceCopy.initialPurchase}</p>
            </div>
            <p role="status" className="my-6 border-l-2 border-signal bg-cream/5 p-4 text-sm leading-relaxed">
              Платформа разрабатывается. Заказы и оплата пока недоступны. Эта страница описывает запланированный состав продукта, а не уже открытый доступ.
            </p>
            <a href="mailto:damironovich@mail.ru?subject=Вопрос%20о%20продукте%20для%20сотрудников" className="inline-flex min-h-[48px] items-center border border-cream/40 px-5 text-sm font-medium hover:border-signal">
              Задать вопрос о продукте
            </a>
          </div>
          <Image
            src={product.cover} width={960} height={640}
            alt={"Обложка продукта: " + product.title}
            className="h-auto w-full" priority
          />
        </section>
        <section className="mt-20">
          <h2 className="font-display text-3xl font-extrabold uppercase">Что входит в доступ</h2>
          <div className="mt-8 grid gap-5 min-[650px]:grid-cols-2">
            {features.map(({ title, body }) => (
              <article key={title} className="border-t border-cream/25 pt-5">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-stone">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mt-16 max-w-[800px]">
          <h2 className="font-display text-3xl font-extrabold uppercase">30 шагов — один рабочий эксперимент</h2>
          <ol className="mt-6 list-decimal space-y-3 pl-6 text-[16px] leading-relaxed text-cream/85">
            <li>Неделя 1: выбрать задачу, описать её этапы и замерить текущий результат.</li>
            <li>Неделя 2: протестировать ИИ на разрешённых или учебных данных.</li>
            <li>Неделя 3: повторить тесты, проверить качество и учесть ошибки.</li>
            <li>Дни 22–30: подготовить проверяемый пример «до и после» и следующие шаги.</li>
          </ol>
          <p className="mt-4 text-sm text-stone">Рекомендации не гарантируют сохранение работы, повышение зарплаты или конкретную экономию времени.</p>
        </section>
        <section className="mt-16 grid gap-6 border-t border-cream/25 pt-8 min-[700px]:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold">Получение и срок доступа</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-stone">
              После запуска продаж доступ предоставляется сразу после подтверждения оплаты через учётную запись по email. Доступ действует 90 дней. Результаты планируется сохранять ещё 30 дней после окончания срока.
            </p>
            <Link href="/delivery" className="mt-2 inline-block text-sm underline underline-offset-4">Подробнее о получении доступа</Link>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Дополнительный доступ</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-stone">
              По отдельной покупке — 1 490 ₽ за 12 месяцев с момента оплаты. Повторный анализ не включён, срок не складывается с оставшимися днями. Без автопродления.
            </p>
            <p className="mt-2 text-xs text-stone">Приобрести дополнительный доступ пока нельзя.</p>
          </div>
        </section>
        <section className="mt-12 border-t border-cream/25 pt-7">
          <h2 className="text-xl font-semibold">Возврат и документы</h2>
          <p className="mt-3 max-w-[78ch] text-[15px] leading-relaxed text-cream/85">
            При покупке качественного цифрового продукта можно отказаться в течение семи дней, не считая дня оплаты, с полным возвратом цены без удержания расходов на ИИ. При недостатках действуют дополнительные права по закону.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="underline underline-offset-4 hover:text-signal">{item.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
