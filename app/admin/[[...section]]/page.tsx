// Admin cabinet of AI Career 3.0 (stage-1 preview). Server-rendered; the role is checked here on the server
// (email-code session + active career_staff row). Everyone else gets the ordinary 404.
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { careerPool } from "@/lib/server/career/db";
import { demoConfig } from "@/lib/server/career-demo/config";
import { demoSessionUser } from "@/lib/server/career-demo/auth";
import { learning, overview, prices, sales, users } from "@/lib/server/career-admin/stats";
import { rubles } from "@/config/ai-career-pricing";
import { PriceForm, RefundButton } from "@/components/career-admin/AdminForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Админ-кабинет · AI Career 3.0", robots: { index: false, follow: false } };

const TABS = [["overview", "Обзор"], ["users", "Пользователи"], ["sales", "Продажи"], ["learning", "Обучение"], ["prices", "Цены"]] as const;
type Tab = (typeof TABS)[number][0];
const msk = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" }) : "—");
const STATUS: Record<string, string> = { pending: "ожидает оплаты", paid: "оплачен", expired: "резерв истёк", canceled: "отменён", refunded: "возврат", refund_required: "нужен возврат" };
const OUTCOME: Record<string, string> = { paid: "оплата подтверждена", duplicate: "повтор", bad_signature: "неверная подпись", amount_mismatch: "сумма не совпала", unknown_order: "заказ не найден", refund_required: "оплата отменённого заказа", not_payable: "заказ не к оплате", malformed: "неполные данные" };

const th = "whitespace-nowrap border-b border-graphite/15 bg-graphite/[0.04] px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-graphite/70";
const td = "border-b border-graphite/10 px-3 py-2 align-top text-[14px]";
function Table({ head, children, label }: { head: string[]; children: React.ReactNode; label: string }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-graphite/15 bg-white" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[640px] border-collapse"><thead><tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>
    </div>
  );
}
function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border border-graphite/15 bg-white p-4">
      <p className="text-[13px] font-semibold text-graphite/70">{label}</p>
      <p className="mt-1 font-display text-[30px] font-bold leading-none tabular-nums">{value}</p>
      {note && <p className="mt-1.5 text-[13px] text-graphite/60">{note}</p>}
    </div>
  );
}

// Sections are path segments (/admin/users, /admin/users/emails): the site's URL-hygiene script strips query strings.
export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const c = demoConfig();
  if (!c?.commerce) notFound();
  const user = await demoSessionUser((await cookies()).get(c.cookieName)?.value).catch(() => null);
  if (!user?.isAdmin) notFound();
  const [section, flag, ...rest] = (await params).section ?? [];
  if (rest.length || (section && !TABS.some(([id]) => id === section)) || (flag && flag !== "emails")) notFound();
  const tab: Tab = (section ?? "overview") as Tab;
  const showEmails = flag === "emails";
  const db = careerPool();
  const link = (t: Tab) => (t === "overview" ? "/admin" : `/admin/${t}`);

  return (
    <div className="min-h-screen bg-cream text-graphite [color-scheme:light]">
      <div role="note" className="border-b border-signal/40 bg-[#FBF6EC] px-3 py-2 text-center text-[13px] font-semibold">{c.banner}</div>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <p className="font-display text-lg font-bold">AI Career 3.0 <span className="font-sans text-sm font-semibold text-graphite/60">· админ-кабинет</span></p>
        <p className="text-sm text-graphite/70">{user.email} · <Link className="underline" href="/">в кабинет</Link></p>
      </header>
      <nav aria-label="Разделы" className="mx-auto mt-4 max-w-6xl overflow-x-auto px-4 sm:px-6">
        <ul className="flex gap-1.5">
          {TABS.map(([id, label]) => (
            <li key={id}><Link href={link(id)} aria-current={id === tab ? "page" : undefined}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-md border px-3.5 text-[15px] font-semibold ${id === tab ? "border-graphite bg-graphite text-cream" : "border-graphite/20 bg-white hover:border-graphite/50"}`}>{label}</Link></li>
          ))}
        </ul>
      </nav>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        {tab === "overview" && <Overview data={await overview(db)} quote={(await prices(db)).quote} />}
        {tab === "users" && <Users rows={await users(db, { showEmails })} showEmails={showEmails} />}
        {tab === "sales" && <Sales data={await sales(db, { showEmails })} showEmails={showEmails} />}
        {tab === "learning" && <Learning data={await learning(db)} />}
        {tab === "prices" && <Prices data={await prices(db)} />}
      </main>
    </div>
  );
}

function H1({ children, intro }: { children: React.ReactNode; intro?: string }) {
  return <><h1 className="font-display text-[clamp(26px,5vw,36px)] font-bold leading-tight">{children}</h1>{intro && <p className="mt-1.5 max-w-3xl text-[15px] text-graphite/70">{intro}</p>}</>;
}

function Overview({ data: d, quote: q }: { data: Awaited<ReturnType<typeof overview>>; quote: Awaited<ReturnType<typeof prices>>["quote"] }) {
  return (
    <section>
      <H1 intro="Продажи считаются только по подтверждённым серверным уведомлениям об оплате. Тестовый режим: реальных списаний нет.">Обзор</H1>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <Stat label="Пользователи" value={d.users} />
        <Stat label="С доступом" value={d.withAccess} note="приглашение или оплата" />
        <Stat label="Подтверждённые оплаты" value={d.confirmedPayments} note={d.refundRequired ? `нужен возврат: ${d.refundRequired}` : undefined} />
        <Stat label="Выручка" value={rubles(d.grossRub)} note={`чистая ${rubles(d.netRub)}`} />
        <Stat label="Возвраты" value={d.refundsCount} note={rubles(d.refundedRub)} />
        <Stat label="Среднее прохождение" value={`${d.avgCompletionPct.toLocaleString("ru-RU")} %`} note={`активных маршрутов: ${d.activePlans}`} />
        <Stat label="Цена сейчас" value={rubles(q.priceRub)} note={q.mode === "auto" ? `AUTO · следующая продажа № ${q.nextSale}` : "MANUAL"} />
      </div>
    </section>
  );
}

function EmailToggle({ tab, showEmails }: { tab: Tab; showEmails: boolean }) {
  return (
    <p className="mt-3 text-[14px]">
      Email скрыты по умолчанию. <Link className="font-semibold underline" href={`/admin/${tab}${showEmails ? "" : "/emails"}`}>{showEmails ? "Скрыть email" : "Показать полные email"}</Link>
    </p>
  );
}

function Users({ rows, showEmails }: { rows: Awaited<ReturnType<typeof users>>; showEmails: boolean }) {
  return (
    <section>
      <H1 intro="Ответы диагностики и содержание упражнений здесь не показываются — только статусы.">Пользователи</H1>
      <EmailToggle tab="users" showEmails={showEmails} />
      <Table label="Пользователи" head={["Email", "Регистрация", "Профессия", "Доступ", "Прогресс", "Диагностика", "Последняя активность"]}>
        {rows.map((u, i) => (
          <tr key={i}>
            <td className={td}>{u.email}{u.admin && <span className="ml-1.5 rounded bg-graphite px-1.5 py-0.5 text-[11px] font-semibold text-cream">админ</span>}</td>
            <td className={td}>{day(u.registeredAt)}</td>
            <td className={td}>{u.profession ?? "—"}</td>
            <td className={td}>{u.access.kind === "paid" ? `оплачен до ${day(u.access.until)}` : u.access.kind === "invite" ? `приглашение до ${day(u.access.until)}` : "нет"}</td>
            <td className={td + " tabular-nums"}>{u.stepsDone === null ? "—" : `${u.stepsDone} из 30`}</td>
            <td className={td}>{u.diagnosticDone ? "пройдена" : "нет"}</td>
            <td className={td}>{msk(u.lastActivityAt)}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td className={td} colSpan={7}>Пока нет пользователей.</td></tr>}
      </Table>
    </section>
  );
}

function Sales({ data: d, showEmails }: { data: Awaited<ReturnType<typeof sales>>; showEmails: boolean }) {
  return (
    <section>
      <H1 intro="Сумма фиксируется в заказе при создании и не пересчитывается. Возврат здесь записывается в учёте; сами деньги возвращаются через Robokassa.">Продажи</H1>
      <h2 className="mt-6 text-[19px] font-bold">Выручка по ценовым уровням</h2>
      <Table label="Выручка по ценовым уровням" head={["Цена", "Подтверждённых оплат", "Возвратов", "Выручка", "Чистая"]}>
        {d.byTier.map((t) => <tr key={t.priceRub}><td className={td}>{rubles(t.priceRub)}</td><td className={td}>{t.confirmed}</td><td className={td}>{t.refunded}</td><td className={td}>{rubles(t.grossRub)}</td><td className={td}>{rubles(t.netRub)}</td></tr>)}
        {d.byTier.length === 0 && <tr><td className={td} colSpan={5}>Продаж пока нет.</td></tr>}
      </Table>
      <h2 className="mt-8 text-[19px] font-bold">Заказы</h2>
      <EmailToggle tab="sales" showEmails={showEmails} />
      <Table label="Заказы" head={["№", "Создан", "Покупатель", "Цена", "Режим цены", "Статус", "Оплата", "Возврат"]}>
        {d.orders.map((o) => (
          <tr key={o.id}>
            <td className={td + " tabular-nums"}>{o.invId}</td><td className={td}>{msk(o.createdAt)}</td><td className={td}>{o.buyer}</td>
            <td className={td + " whitespace-nowrap"}>{rubles(o.priceRub)}</td>
            <td className={td}>{o.priceMode === "auto" ? `AUTO · продажа № ${o.salePosition}` : "MANUAL"}</td>
            <td className={td}>{STATUS[o.status] ?? o.status}<span className="block text-[12px] text-graphite/60">{o.provider}</span></td>
            <td className={td}>{msk(o.paidAt)}</td>
            <td className={td}>{o.refundedAt ? `${rubles(o.refundRub ?? 0)} · ${day(o.refundedAt)}` : (o.status === "paid" || o.status === "refund_required") ? <RefundButton orderId={o.id} invId={o.invId} /> : "—"}</td>
          </tr>
        ))}
        {d.orders.length === 0 && <tr><td className={td} colSpan={8}>Заказов пока нет.</td></tr>}
      </Table>
      <h2 className="mt-8 text-[19px] font-bold">Уведомления Robokassa (последние 20)</h2>
      <Table label="Уведомления Robokassa" head={["Время", "Заказ", "Сумма", "Результат"]}>
        {d.notifications.map((n, i) => <tr key={i}><td className={td}>{msk(n.at)}</td><td className={td}>{n.invId ?? "—"}</td><td className={td}>{n.outSum ?? "—"}</td><td className={td}>{OUTCOME[n.outcome] ?? n.outcome}</td></tr>)}
        {d.notifications.length === 0 && <tr><td className={td} colSpan={4}>Уведомлений пока не было.</td></tr>}
      </Table>
    </section>
  );
}

function Learning({ data: d }: { data: Awaited<ReturnType<typeof learning>> }) {
  const f = d.funnel;
  return (
    <section>
      <H1 intro="Считается по активным маршрутам. Ответы и тексты упражнений не показываются.">Обучение</H1>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Начали диагностику" value={f.diagnosticStarted} />
        <Stat label="Завершили диагностику" value={f.diagnosticDone} />
        <Stat label="Начали обучение" value={f.learningStarted} />
        <Stat label="Завершили программу" value={f.programDone} note="30 из 30 шагов" />
      </div>
      <h2 className="mt-8 text-[19px] font-bold">Уроки и тесты</h2>
      <Table label="Уроки и тесты" head={["Урок", "Начали", "Завершили", "Сдавали тест", "Сдали", "С первой попытки", "Попыток в среднем"]}>
        {d.lessons.map((l) => <tr key={l.lessonId}><td className={td}>{l.lessonId}</td><td className={td}>{l.started}</td><td className={td}>{l.done}</td><td className={td}>{l.quizTakers}</td><td className={td}>{l.quizPassed}</td><td className={td}>{l.firstTry}</td><td className={td}>{l.avgAttempts ?? "—"}</td></tr>)}
        {d.lessons.length === 0 && <tr><td className={td} colSpan={7}>Пока никто не начал обучение.</td></tr>}
      </Table>
      <h2 className="mt-8 text-[19px] font-bold">Точки остановки</h2>
      <p className="mt-1 text-[14px] text-graphite/70">Первый незавершённый шаг у тех, кто начал, но не закончил.</p>
      <Table label="Точки остановки" head={["Шаг", "Урок", "Учеников", "Без активности 7+ дней"]}>
        {d.stops.map((s) => <tr key={s.position + s.lessonId}><td className={td}>{s.position}</td><td className={td}>{s.lessonId}</td><td className={td}>{s.learners}</td><td className={td}>{s.idle7d}</td></tr>)}
        {d.stops.length === 0 && <tr><td className={td} colSpan={4}>Данных пока нет.</td></tr>}
      </Table>
    </section>
  );
}

function Prices({ data: d }: { data: Awaited<ReturnType<typeof prices>> }) {
  const q = d.quote;
  return (
    <section>
      <H1 intro="Одна действующая цена для каталога, страницы продукта, новых заказов и запроса в Robokassa. Существующие заказы не пересчитываются.">Цены</H1>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Действующая цена" value={rubles(q.priceRub)} note={q.mode === "auto" ? "режим AUTO" : "режим MANUAL"} />
        <Stat label="Подтверждённые продажи" value={q.paidSales} note={`в резерве: ${q.reserved}`} />
        <Stat label="Следующая продажа" value={q.nextSale ? `№ ${q.nextSale}` : "—"} note={q.beyondPlan ? "после № 40: нужно решение" : "AUTO: № 1–10 · 11–20 · 21–40"} />
      </div>
      <PriceForm mode={d.mode} manualPriceRub={d.manualPriceRub} currentPriceRub={q.priceRub} nextSale={q.nextSale} paidSales={q.paidSales} reserved={q.reserved} />
      <h2 className="mt-8 text-[19px] font-bold">История изменений</h2>
      <Table label="История изменений цены" head={["Когда", "Кто", "Было", "Стало", "Продаж на момент", "Причина"]}>
        {d.history.map((h, i) => (
          <tr key={i}><td className={td}>{msk(h.at)}</td><td className={td}>{h.by}</td><td className={td + " whitespace-nowrap"}>{rubles(h.oldPriceRub)} · {h.oldMode.toUpperCase()}</td>
            <td className={td + " whitespace-nowrap"}>{rubles(h.newPriceRub)} · {h.newMode.toUpperCase()}</td><td className={td}>{h.paidSales}</td><td className={td}>{h.reason}</td></tr>
        ))}
        {d.history.length === 0 && <tr><td className={td} colSpan={6}>Изменений ещё не было: действует AUTO.</td></tr>}
      </Table>
    </section>
  );
}
