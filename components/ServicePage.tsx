import Link from "next/link";
import Breadcrumbs, { type Crumb } from "./Breadcrumbs";
import ContactSection from "./ContactSection";
import CtaLink from "./CtaLink";
import Faq from "./Faq";
import Scenarios from "./Scenarios";
import SectionLabel from "./SectionLabel";
import StickyCta from "./StickyCta";
import TrackServiceView from "./TrackServiceView";
import { serviceBySlug, services } from "@/config/services";
import type { ServicePageContent } from "@/content/services";
import type { Item, SectionKey, UniqueBlock } from "@/content/services/types";
import type { Post } from "@/lib/blog";

type Tone = "dark" | "light";

const bg: Record<Tone, string> = { dark: "bg-graphite", light: "bg-cream" };
const heading: Record<Tone, string> = { dark: "text-cream", light: "text-graphite" };
const body: Record<Tone, string> = { dark: "text-cream/80", light: "text-graphite/75" };
const muted: Record<Tone, string> = { dark: "text-stone", light: "text-graphite/65" };
const rule: Record<Tone, string> = { dark: "border-cream/15", light: "border-graphite/15" };
const numberTone: Record<Tone, string> = { dark: "text-cream/40", light: "text-graphite/50" };

const h2Class = "m-0 max-w-[20ch] text-balance font-display text-[clamp(30px,5.4vw,52px)] font-extrabold uppercase leading-[1.03] tracking-[-0.02em]";
const ctaClass =
  "inline-flex min-h-[56px] items-center justify-center whitespace-nowrap bg-signal px-5 text-center text-[14px] font-medium uppercase tracking-[0.04em] text-white transition-colors hover:bg-[#b82323] min-[400px]:px-8 min-[400px]:text-[15px] min-[400px]:tracking-[0.06em]";

const pad = (n: number) => String(n).padStart(2, "0");

function Section({ id, tone, children }: { id?: string; tone: Tone; children: React.ReactNode }) {
  return (
    <section id={id} className={bg[tone] + " px-[22px] py-16 min-[560px]:py-24"}>
      <div className="mx-auto max-w-[1080px]">{children}</div>
    </section>
  );
}

function Hero({ page, crumbs }: { page: ServicePageContent; crumbs: Crumb[] }) {
  const surface = page.heroTone === "maroon" ? "bg-maroon" : "bg-graphite";
  return (
    <section id="hero" className={"relative overflow-hidden px-[22px] pb-12 pt-6 min-[560px]:pb-16 min-[560px]:pt-10 " + surface}>
      <p
        aria-hidden
        className="pointer-events-none absolute -right-6 bottom-[-0.12em] hidden select-none whitespace-nowrap font-display text-[clamp(140px,20vw,300px)] font-extrabold uppercase leading-none tracking-[-0.02em] text-cream/[0.04] min-[860px]:block"
      >
        {page.ghost}
      </p>

      <div className="relative mx-auto flex max-w-[1080px] flex-col gap-5 min-[560px]:gap-8">
        <Breadcrumbs items={crumbs} />

        <h1 className="m-0 max-w-[24ch] text-balance font-display text-[clamp(34px,5.6vw,76px)] font-extrabold uppercase leading-[0.97] tracking-[-0.02em] text-cream">
          {page.h1}
          <span className="text-signal">.</span>
        </h1>

        <div className="flex flex-col gap-6 min-[860px]:flex-row min-[860px]:items-end min-[860px]:justify-between min-[860px]:gap-12 min-[860px]:border-t min-[860px]:border-cream/15 min-[860px]:pt-8">
          <p className="m-0 max-w-[52ch] text-pretty text-[16px] leading-[1.55] text-cream/80 min-[560px]:text-[18px]">{page.offer}</p>
          <div className="flex flex-col gap-2.5">
            <CtaLink href="#contact" location="service_page" className={ctaClass}>
              Обсудить задачу бесплатно
            </CtaLink>
            <p className="m-0 text-[13px] text-stone min-[860px]:text-center">Первичное обсуждение — бесплатно</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Definition({ page, tone, index }: { page: ServicePageContent; tone: Tone; index: string }) {
  return (
    <Section tone={tone}>
      <SectionLabel index={index} label="Коротко" note="Определение и для кого" tone={tone} />
      <div className="grid gap-12 min-[900px]:grid-cols-[1.2fr_1fr] min-[900px]:gap-16">
        <div>
          <h2 className={"m-0 mb-6 text-balance font-display text-[clamp(26px,4vw,38px)] font-extrabold uppercase leading-[1.06] tracking-[-0.015em] " + heading[tone]}>
            {page.definition.term}
          </h2>
          <p className={"m-0 max-w-[52ch] border-l-2 border-signal pl-5 text-pretty text-[clamp(17px,2.2vw,20px)] leading-[1.55] " + heading[tone]}>
            {page.definition.text}
          </p>
        </div>
        <div>
          <h3 className={"m-0 mb-4 text-[12px] uppercase tracking-[0.18em] " + muted[tone]}>Кому подходит</h3>
          <ul className={"m-0 flex list-none flex-col border-t p-0 " + rule[tone]}>
            {page.audience.map((a) => (
              <li key={a} className={"flex gap-3 border-b py-4 text-pretty text-[15.5px] leading-[1.5] " + rule[tone] + " " + heading[tone]}>
                <span aria-hidden className="text-signal">—</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function Outcomes({ page, tone, index }: { page: ServicePageContent; tone: Tone; index: string }) {
  return (
    <Section tone={tone}>
      <SectionLabel index={index} label={page.outcomes.label} note="Без обещанных цифр" tone={tone} />
      <h2 className={h2Class + " mb-12 min-[560px]:mb-14 " + heading[tone]}>{page.outcomes.title}</h2>
      <div className="grid grid-cols-1 gap-x-12 min-[760px]:grid-cols-2">
        {page.outcomes.items.map((it) => (
          <div key={it.title} className="border-t-2 border-signal py-7">
            <h3 className={"m-0 mb-2 font-display text-[clamp(20px,2.4vw,26px)] font-extrabold uppercase leading-[1.1] tracking-[-0.01em] " + heading[tone]}>
              {it.title}
            </h3>
            <p className={"m-0 max-w-[44ch] text-pretty text-[15.5px] leading-[1.6] " + body[tone]}>{it.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TaskList({ items, tone }: { items: Item[]; tone: Tone }) {
  return (
    <ol className={"m-0 grid list-none grid-cols-1 border-t p-0 min-[860px]:grid-cols-2 min-[860px]:gap-x-12 " + rule[tone]}>
      {items.map((it, i) => (
        <li key={it.title} className={"grid grid-cols-[48px_1fr] gap-4 border-b py-7 " + rule[tone]}>
          <span className={"font-display text-[26px] font-extrabold leading-none " + numberTone[tone]}>{pad(i + 1)}</span>
          <div>
            <h3 className={"m-0 mb-1.5 text-[17px] font-medium " + heading[tone]}>{it.title}</h3>
            <p className={"m-0 text-pretty text-[15px] leading-[1.6] " + body[tone]}>{it.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TaskGrid({ items, tone }: { items: Item[]; tone: Tone }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[640px]:grid-cols-2 min-[960px]:grid-cols-3">
      {items.map((it, i) => (
        <li key={it.title} className={"flex flex-col gap-4 border p-6 " + rule[tone]}>
          <span className="font-display text-[15px] font-extrabold text-signal">{pad(i + 1)}</span>
          <h3 className={"m-0 text-balance font-display text-[clamp(21px,2.4vw,25px)] font-extrabold uppercase leading-[1.1] tracking-[-0.01em] " + heading[tone]}>
            {it.title}
          </h3>
          <p className={"m-0 text-pretty text-[15px] leading-[1.6] " + body[tone]}>{it.body}</p>
        </li>
      ))}
    </ul>
  );
}

function TaskRoute({ items, tone }: { items: Item[]; tone: Tone }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {items.map((it, i) => (
        <li key={it.title} className="relative grid grid-cols-[44px_1fr] gap-5 pb-8 last:pb-0">
          {/* the route line between stops */}
          {i < items.length - 1 && <span aria-hidden className="absolute bottom-0 left-[21px] top-11 w-px bg-signal/50" />}
          <span className="flex h-11 w-11 items-center justify-center border border-signal font-display text-[15px] font-extrabold text-signal">
            {pad(i + 1)}
          </span>
          <div className="pt-2">
            <h3 className={"m-0 mb-1.5 font-display text-[clamp(20px,2.4vw,24px)] font-extrabold uppercase leading-[1.1] " + heading[tone]}>{it.title}</h3>
            <p className={"m-0 max-w-[56ch] text-pretty text-[15px] leading-[1.6] " + body[tone]}>{it.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tasks({ page, tone, index }: { page: ServicePageContent; tone: Tone; index: string }) {
  const { tasks } = page;
  return (
    <Section tone={tone}>
      <SectionLabel index={index} label={tasks.label} tone={tone} />
      <h2 className={h2Class + " mb-12 min-[560px]:mb-14 " + heading[tone]}>{tasks.title}</h2>
      {tasks.layout === "list" && <TaskList items={tasks.items} tone={tone} />}
      {tasks.layout === "grid" && <TaskGrid items={tasks.items} tone={tone} />}
      {tasks.layout === "route" && <TaskRoute items={tasks.items} tone={tone} />}
      {tasks.note && (
        <p className={"m-0 mt-10 max-w-[60ch] text-pretty text-[14.5px] leading-[1.6] " + muted[tone]}>{tasks.note}</p>
      )}
    </Section>
  );
}

function Unique({ block, tone, index }: { block: UniqueBlock; tone: Tone; index: string }) {
  if (block.kind === "limits") {
    return (
      <Section tone={tone}>
        <SectionLabel index={index} label={block.label} tone={tone} />
        <div className="mb-12 grid gap-6 min-[860px]:mb-14 min-[860px]:grid-cols-2 min-[860px]:items-end min-[860px]:gap-16">
          <h2 className={h2Class + " " + heading[tone]}>{block.title}</h2>
          <p className={"m-0 max-w-[46ch] text-pretty text-[16px] leading-[1.6] " + body[tone]}>{block.intro}</p>
        </div>
        <ul className={"m-0 grid list-none grid-cols-1 border-t p-0 min-[760px]:grid-cols-2 min-[760px]:gap-x-12 " + rule[tone]}>
          {block.items.map((it) => (
            <li key={it.title} className={"border-b py-7 " + rule[tone]}>
              <h3 className={"m-0 mb-2 flex gap-3 text-[17px] font-medium " + heading[tone]}>
                <span aria-hidden className="text-signal">×</span>
                {it.title}
              </h3>
              <p className={"m-0 pl-[22px] text-pretty text-[15px] leading-[1.6] " + body[tone]}>{it.body}</p>
            </li>
          ))}
        </ul>
      </Section>
    );
  }

  if (block.kind === "compare") {
    // One table for every width; below 760px rows stack and each cell shows its column name.
    const cell = "block py-2 min-[760px]:table-cell min-[760px]:border-b min-[760px]:py-5 min-[760px]:pr-6 " + rule[tone];
    return (
      <Section tone={tone}>
        <SectionLabel index={index} label={block.label} tone={tone} />
        <div className="mb-12 grid gap-6 min-[860px]:mb-14 min-[860px]:grid-cols-2 min-[860px]:items-end min-[860px]:gap-16">
          <h2 className={h2Class + " " + heading[tone]}>{block.title}</h2>
          <p className={"m-0 max-w-[46ch] text-pretty text-[16px] leading-[1.6] " + body[tone]}>{block.intro}</p>
        </div>
        <table className={"block w-full border-collapse text-left min-[760px]:table " + heading[tone]}>
          <caption className="sr-only">{block.title}: сравнение по критериям</caption>
          <thead className="hidden min-[760px]:table-header-group">
            <tr className={"border-b-2 " + rule[tone]}>
              <th scope="col" className={"py-4 pr-6 text-[12px] font-normal uppercase tracking-[0.16em] " + muted[tone]}>Критерий</th>
              <th scope="col" className={"py-4 pr-6 text-[12px] font-normal uppercase tracking-[0.16em] " + muted[tone]}>Готовый сервис</th>
              <th scope="col" className="py-4 text-[12px] font-normal uppercase tracking-[0.16em] text-signal">Своя разработка</th>
            </tr>
          </thead>
          <tbody className="block min-[760px]:table-row-group">
            {block.rows.map((r) => (
              <tr key={r.criterion} className={"block border-t py-5 min-[760px]:table-row min-[760px]:border-t-0 min-[760px]:py-0 " + rule[tone]}>
                <th scope="row" className={cell + " pb-1 font-display text-[19px] font-extrabold uppercase leading-[1.15] min-[760px]:w-[26%] min-[760px]:text-[17px]"}>
                  {r.criterion}
                </th>
                <td data-label="Готовый сервис" className={cell + " text-[15px] leading-[1.55] before:mr-2 before:text-[12px] before:uppercase before:tracking-[0.12em] before:content-[attr(data-label)_':'] min-[760px]:before:hidden " + body[tone]}>
                  {r.ready}
                </td>
                <td data-label="Своя разработка" className={cell + " text-[15px] font-medium leading-[1.55] before:mr-2 before:text-[12px] before:uppercase before:tracking-[0.12em] before:text-signal before:content-[attr(data-label)_':'] min-[760px]:before:hidden"}>
                  {r.custom}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={"m-0 mt-10 max-w-[60ch] border-l-2 border-signal pl-5 text-pretty text-[clamp(17px,2.2vw,20px)] leading-[1.5] " + heading[tone]}>
          {block.conclusion}
        </p>
      </Section>
    );
  }

  return (
    <Section tone={tone}>
      <SectionLabel index={index} label={block.label} note="Сейчас → Система" tone={tone} />
      <h2 className={h2Class + " mb-12 min-[560px]:mb-14 " + heading[tone]}>{block.title}</h2>
      <div className={"flex flex-col border-t " + rule[tone]}>
        {block.rows.map(([now, after]) => (
          <div key={now} className={"grid grid-cols-1 items-start gap-3 border-b py-7 min-[760px]:grid-cols-[1fr_44px_1fr] min-[760px]:gap-6 " + rule[tone]}>
            <div>
              <p className={"m-0 mb-2 text-[11px] uppercase tracking-[0.18em] " + muted[tone]}>Сейчас</p>
              <p className={"m-0 max-w-[42ch] text-pretty text-[15px] leading-[1.6] " + body[tone]}>{now}</p>
            </div>
            <div aria-hidden className="hidden justify-center pt-6 text-lg text-signal min-[760px]:flex">→</div>
            <div>
              <p className="m-0 mb-2 text-[11px] uppercase tracking-[0.18em] text-signal">Система</p>
              <p className={"m-0 max-w-[42ch] text-pretty text-[16px] font-medium leading-[1.6] " + heading[tone]}>{after}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Process({ page, tone, index }: { page: ServicePageContent; tone: Tone; index: string }) {
  return (
    <Section tone={tone}>
      <SectionLabel index={index} label="Этапы" tone={tone} />
      <h2 className={h2Class + " mb-12 min-[560px]:mb-14 " + heading[tone]}>{page.process.title}</h2>
      <ol className={"m-0 grid list-none grid-cols-1 border-t p-0 min-[760px]:grid-cols-5 " + rule[tone]}>
        {page.process.items.map((s, i) => (
          <li
            key={s.title}
            className={"flex flex-col gap-2 border-b py-6 min-[760px]:border-b-0 min-[760px]:py-8 min-[760px]:pr-5 " + (i > 0 ? "min-[760px]:border-l min-[760px]:pl-5 " : "") + rule[tone]}
          >
            <span className="font-display text-[15px] font-extrabold text-signal">{pad(i + 1)}</span>
            <h3 className={"m-0 text-[15px] font-medium uppercase tracking-[0.04em] " + heading[tone]}>{s.title}</h3>
            <p className={"m-0 text-pretty text-[14.5px] leading-[1.55] " + body[tone]}>{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Start({ page, tone, index }: { page: ServicePageContent; tone: Tone; index: string }) {
  const service = serviceBySlug(page.slug);
  return (
    <Section id="start" tone={tone}>
      <SectionLabel index={index} label="Как начать" note="Цены не публикуются — оценка после обсуждения" tone={tone} />
      <h2 className={h2Class + " mb-12 min-[560px]:mb-14 " + heading[tone]}>С чего начать и от чего зависит стоимость</h2>

      <div className={"grid grid-cols-1 border-t min-[960px]:grid-cols-3 " + rule[tone]}>
        <div className={"flex flex-col gap-4 border-b py-8 min-[960px]:border-b-0 min-[960px]:pr-8 " + rule[tone]}>
          <p className="m-0 inline-flex w-fit bg-signal px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-white">Бесплатно</p>
          <h3 className={"m-0 font-display text-[24px] font-extrabold uppercase leading-[1.1] " + heading[tone]}>Первичное обсуждение</h3>
          <p className={"m-0 text-pretty text-[15px] leading-[1.6] " + body[tone]}>
            В переписке или на созвоне. Вы описываете задачу, я задаю уточняющие вопросы. Итог — возможные варианты
            решения и следующие шаги.
          </p>
          <p className={"m-0 text-pretty text-[13.5px] leading-[1.55] " + muted[tone]}>
            Детальное изучение процессов, письменный отчёт и техническое задание сюда не входят.
          </p>
        </div>
        <div className={"flex flex-col gap-4 border-b py-8 min-[960px]:border-b-0 min-[960px]:border-l min-[960px]:px-8 " + rule[tone]}>
          <p className={"m-0 inline-flex w-fit border px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.12em] " + (tone === "dark" ? "border-cream text-cream" : "border-graphite text-graphite")}>
            Платная услуга
          </p>
          <h3 className={"m-0 font-display text-[24px] font-extrabold uppercase leading-[1.1] " + heading[tone]}>Аудит бизнес-процессов</h3>
          <p className={"m-0 text-pretty text-[15px] leading-[1.6] " + body[tone]}>
            Когда нужна глубина: детальное изучение процессов, поиск узких мест и подготовка рекомендаций. Объём и
            стоимость согласуются заранее.
          </p>
          <p className={"m-0 text-pretty text-[13.5px] leading-[1.55] " + muted[tone]}>
            Разработка и внедрение оцениваются отдельно, когда понятны задача и объём.
          </p>
        </div>
        <div className={"flex flex-col gap-4 py-8 min-[960px]:border-l min-[960px]:pl-8 " + rule[tone]}>
          <h3 className={"m-0 text-[12px] uppercase tracking-[0.16em] " + muted[tone]}>Что влияет на стоимость</h3>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {page.costFactors.map((f) => (
              <li key={f} className={"flex gap-3 text-pretty text-[15px] leading-[1.5] " + heading[tone]}>
                <span aria-hidden className="text-signal">—</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={"mt-4 flex flex-col gap-5 border-t pt-10 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between " + rule[tone]}>
        <p className={"m-0 max-w-[40ch] text-pretty text-[clamp(17px,2.2vw,20px)] leading-[1.45] " + heading[tone]}>
          Не уверены, нужна ли {service.slug === "training" ? "отдельная система" : service.slug === "apps" ? "разработка" : "автоматизация"}? Это выясняется на первом обсуждении.
        </p>
        <CtaLink href="#contact" location="service_page" className={ctaClass}>
          Обсудить задачу бесплатно
        </CtaLink>
      </div>
    </Section>
  );
}

function Related({ page, articles }: { page: ServicePageContent; articles: Post[] }) {
  const others = services.filter((s) => s.slug !== page.slug);
  return (
    <section className="bg-cream px-[22px] pb-16 min-[560px]:pb-24">
      <div className="mx-auto grid max-w-[1080px] gap-12 border-t border-graphite/15 pt-12 min-[860px]:grid-cols-2 min-[860px]:gap-16">
        <div>
          <h2 className="m-0 mb-6 text-[12px] font-normal uppercase tracking-[0.18em] text-graphite/65">Другие направления</h2>
          <ul className="m-0 flex list-none flex-col border-t border-graphite/15 p-0">
            {others.map((s) => (
              <li key={s.slug}>
                <Link href={s.href} className="group flex flex-col gap-1 border-b border-graphite/15 py-5">
                  <span className="font-display text-[clamp(20px,2.4vw,24px)] font-extrabold uppercase leading-[1.1] text-graphite transition-colors group-hover:text-maroon">
                    {s.title} →
                  </span>
                  <span className="text-pretty text-[14.5px] leading-[1.55] text-graphite/70">{s.fit}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-6">
            <Link href="/services" className="inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.1em] text-maroon underline underline-offset-4 hover:text-signal">
              Все услуги →
            </Link>
            <Link href="/about" className="inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.1em] text-maroon underline underline-offset-4 hover:text-signal">
              Обо мне →
            </Link>
            <Link href="/contact" className="inline-flex min-h-[44px] items-center text-[13px] uppercase tracking-[0.1em] text-maroon underline underline-offset-4 hover:text-signal">
              Контакты →
            </Link>
          </div>
        </div>

        {articles.length > 0 && (
          <div>
            <h2 className="m-0 mb-6 text-[12px] font-normal uppercase tracking-[0.18em] text-graphite/65">Статьи по теме</h2>
            <ul className="m-0 flex list-none flex-col border-t border-graphite/15 p-0">
              {articles.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={"/blog/" + a.slug}
                    className="flex min-h-[56px] items-center border-b border-graphite/15 py-4 text-pretty text-[16px] leading-[1.4] text-graphite transition-colors hover:text-maroon"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Service page template. Hero first and the form last are fixed; the body order
 * comes from the content file. Surfaces alternate graphite/cream automatically,
 * scenarios are always maroon and the FAQ always cream.
 */
export default function ServicePage({
  page,
  crumbs,
  articles,
}: {
  page: ServicePageContent;
  crumbs: Crumb[];
  articles: Post[];
}) {
  let prev: Tone | "maroon" = page.heroTone === "maroon" ? "maroon" : "dark";
  let n = 0;

  const render = (key: SectionKey) => {
    if (key === "related") return <Related key={key} page={page} articles={articles} />;
    const index = pad(++n);
    if (key === "scenarios") {
      prev = "maroon";
      return <Scenarios key={key} items={page.scenarios.items} index={index} title={page.scenarios.title} intro={page.scenarios.intro} />;
    }
    if (key === "faq") {
      const continued = prev === "light";
      prev = "light";
      return <Faq key={key} items={page.faq} index={index} continued={continued} />;
    }
    const tone: Tone = prev === "light" ? "dark" : "light";
    prev = tone;
    switch (key) {
      case "definition":
        return <Definition key={key} page={page} tone={tone} index={index} />;
      case "outcomes":
        return <Outcomes key={key} page={page} tone={tone} index={index} />;
      case "tasks":
        return <Tasks key={key} page={page} tone={tone} index={index} />;
      case "unique":
        return <Unique key={key} block={page.unique} tone={tone} index={index} />;
      case "process":
        return <Process key={key} page={page} tone={tone} index={index} />;
      case "start":
        return <Start key={key} page={page} tone={tone} index={index} />;
    }
  };

  const body = page.sections.map(render);

  return (
    <>
      <main id="main">
        <Hero page={page} crumbs={crumbs} />
        {body}
        <ContactSection index={pad(n + 1)} title={page.form.title} lead={page.form.lead} />
      </main>
      <StickyCta />
      <TrackServiceView service={page.slug} />
    </>
  );
}
