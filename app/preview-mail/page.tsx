// Stage-1 preview without SMTP: the latest sign-in emails (kept one hour), behind the preview mailbox key.
// Exists only while config.ts selected the preview-outbox transport for the stage-1 preview.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { demoConfig } from "@/lib/server/career-demo/config";
import { previewMessages } from "@/lib/server/career-demo/mail";
import { PREVIEW_MAIL_COOKIE, previewMailToken } from "@/lib/server/career-demo/preview-mail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Почта превью", robots: { index: false, follow: false } };

export default async function PreviewMail({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  const c = demoConfig();
  if (!c || c.mail?.mode !== "preview-outbox") notFound();
  const unlocked = (await cookies()).get(PREVIEW_MAIL_COOKIE)?.value === previewMailToken(c.sessionSecret, c.mail.key);
  const wrong = (await searchParams).wrong === "1";
  const messages = unlocked ? await previewMessages() : [];
  return (
    <main className="min-h-screen bg-[#F2EFE8] px-4 py-8 text-[#0E0E11]">
      <div className="mx-auto max-w-xl">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[#B3261E]">Закрытое превью · вместо отправки на почту</p>
        <h1 className="mt-1 text-2xl font-bold">Письма с кодами входа</h1>
        <p className="mt-2 text-[15px] text-[#444]">Пока SMTP для info@mironovich.pro не подключён, письма превью попадают сюда и хранятся один час. В рабочей версии этот раздел не существует.</p>
        {!unlocked ? (
          <form method="post" action="/api/career/preview-mail" className="mt-5 grid gap-3 rounded-lg border border-[#0E0E11]/15 bg-white p-5">
            <label className="grid gap-1.5 text-[15px] font-semibold">Ключ почты превью
              <input name="key" type="password" autoComplete="off" required className="min-h-12 rounded-md border border-[#0E0E11]/30 px-3 font-normal" />
            </label>
            {wrong && <p role="alert" className="text-[14px] text-[#B3261E]">Ключ не подошёл.</p>}
            <button className="min-h-12 rounded-md bg-[#0E0E11] font-semibold text-white">Открыть</button>
            <p className="text-[13px] text-[#555]">Ключ хранится в переменной Railway CAREER_V3_PREVIEW_OUTBOX_KEY.</p>
          </form>
        ) : (
          <ul className="mt-5 grid gap-3">
            {messages.length === 0 && <li className="rounded-lg border border-[#0E0E11]/15 bg-white p-4">Писем за последний час нет.</li>}
            {messages.map((m, i) => (
              <li key={i} className="rounded-lg border border-[#0E0E11]/15 bg-white p-4">
                <p className="text-[13px] text-[#555]">{new Date(m.at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК · кому: {m.to}</p>
                <p className="mt-1 font-semibold">{m.subject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-[15px]">{m.body}</pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
