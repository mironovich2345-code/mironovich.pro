// Read-only figures for the admin cabinet. Counts and statuses only: no diagnostic answers, no exercise content, no
// free text. Emails are masked unless the administrator explicitly asks to show them. Sales count CONFIRMED payments only.
import type { PoolClient } from "pg";
import { loadRegistry } from "../career-v3/content.ts";
import { maskEmail } from "../career-demo/otp.ts";
import { quote, priceHistory, expireStale } from "../commerce/shop.ts";

type Q = Pick<PoolClient, "query">;
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
const professionTitle = (() => {
  let map: Map<string, string> | null = null;
  return (id: string | null) => {
    if (!id) return null;
    map ??= new Map(loadRegistry().professions.map((p) => [p.id, p.title]));
    return map.get(id) ?? id;
  };
})();

/** Per-account learning state on the ACTIVE plan (a rebuilt plan's old progress is history, not counted). */
const ACTIVE_PROGRESS = `
  SELECT pv.account_id, pv.id AS plan_id, pv.profession_id,
         count(sp.*) FILTER (WHERE sp.state='done')::int AS done,
         count(sp.*) FILTER (WHERE sp.state<>'not_started')::int AS touched,
         max(sp.updated_at) AS last_step_at
    FROM career_v3_plan_versions pv LEFT JOIN career_v3_step_progress sp ON sp.plan_version_id=pv.id
   WHERE pv.status='active' GROUP BY pv.account_id, pv.id, pv.profession_id`;

export async function overview(db: Q) {
  await expireStale(db);
  const u = (await db.query(`
    SELECT count(*)::int AS users,
           count(*) FILTER (WHERE (u.tester AND u.access_until>now())
             OR EXISTS (SELECT 1 FROM career_access_grants g WHERE g.account_id=u.account_id AND g.revoked_at IS NULL AND g.expires_at>now()))::int AS with_access
      FROM career_demo_users u`)).rows[0];
  const s = (await db.query(`
    SELECT count(*) FILTER (WHERE status IN ('paid','refunded','refund_required'))::int AS confirmed,
           count(*) FILTER (WHERE status='paid')::int AS paid,
           coalesce(sum(price_kopeks) FILTER (WHERE status IN ('paid','refunded','refund_required')),0)::bigint AS gross,
           count(*) FILTER (WHERE status='refunded')::int AS refunds,
           coalesce(sum(refund_kopeks) FILTER (WHERE status='refunded'),0)::bigint AS refunded,
           count(*) FILTER (WHERE status='refund_required')::int AS refund_required
      FROM career_shop_orders`)).rows[0];
  const p = (await db.query(`SELECT coalesce(round(avg(done)*100.0/30, 1), 0)::float AS avg_pct, count(*)::int AS plans FROM (${ACTIVE_PROGRESS}) a`)).rows[0];
  const gross = Number(s.gross) / 100, refunded = Number(s.refunded) / 100;
  return {
    users: u.users, withAccess: u.with_access, confirmedPayments: s.confirmed, paidNow: s.paid,
    grossRub: gross, refundsCount: s.refunds, refundedRub: refunded, netRub: gross - refunded, refundRequired: s.refund_required,
    avgCompletionPct: p.avg_pct, activePlans: p.plans,
  };
}

export async function users(db: Q, opts: { showEmails: boolean; limit?: number }) {
  const r = await db.query(`
    WITH ap AS (${ACTIVE_PROGRESS}),
         dx AS (SELECT DISTINCT ON (account_id) account_id, profession_id, updated_at FROM career_v3_diagnostics ORDER BY account_id, updated_at DESC),
         gr AS (SELECT account_id, max(expires_at) AS paid_until FROM career_access_grants WHERE revoked_at IS NULL GROUP BY account_id)
    SELECT u.email, u.created_at, u.tester, u.access_until, u.last_login_at, u.last_seen_at, u.email_verified,
           gr.paid_until, dx.profession_id AS dx_profession, dx.account_id IS NOT NULL AS diagnostic_done,
           ap.done, ap.profession_id AS plan_profession, ap.last_step_at,
           EXISTS (SELECT 1 FROM career_staff st WHERE st.email=u.email AND st.revoked_at IS NULL) AS admin
      FROM career_demo_users u
      LEFT JOIN dx ON dx.account_id=u.account_id LEFT JOIN ap ON ap.account_id=u.account_id LEFT JOIN gr ON gr.account_id=u.account_id
     ORDER BY u.created_at DESC LIMIT $1`, [opts.limit ?? 200]);
  return r.rows.map((x) => {
    const paid = x.paid_until && new Date(x.paid_until) > new Date();
    const invite = x.tester && x.access_until && new Date(x.access_until) > new Date();
    const lastActivity = [x.last_seen_at, x.last_login_at, x.last_step_at].filter(Boolean).map((d) => new Date(d).getTime());
    return {
      email: opts.showEmails ? (x.email as string) : maskEmail(x.email),
      registeredAt: iso(x.created_at)!,
      profession: professionTitle(x.plan_profession ?? x.dx_profession ?? null),
      access: paid ? { kind: "paid" as const, until: iso(x.paid_until) } : invite ? { kind: "invite" as const, until: iso(x.access_until) } : { kind: "none" as const, until: null },
      stepsDone: x.done ?? null,
      diagnosticDone: !!x.diagnostic_done,
      lastActivityAt: lastActivity.length ? new Date(Math.max(...lastActivity)).toISOString() : null,
      admin: !!x.admin, emailVerified: !!x.email_verified,
    };
  });
}

export async function sales(db: Q, opts: { showEmails: boolean; limit?: number }) {
  await expireStale(db);
  const orders = (await db.query(`
    SELECT o.*, u.email FROM career_shop_orders o LEFT JOIN career_demo_users u ON u.account_id=o.account_id
     ORDER BY o.created_at DESC LIMIT $1`, [opts.limit ?? 200])).rows.map((o) => ({
    id: o.id as string, invId: Number(o.inv_id), buyer: o.email ? (opts.showEmails ? o.email : maskEmail(o.email)) : "аккаунт удалён",
    createdAt: iso(o.created_at)!, priceRub: o.price_kopeks / 100, priceMode: o.price_mode as string, salePosition: o.sale_position as number | null,
    status: o.status as string, provider: `Robokassa · ${o.provider_mode === "emulator" ? "эмулятор" : "тест"}`, paidAt: iso(o.paid_at),
    refundedAt: iso(o.refunded_at), refundRub: o.refund_kopeks ? o.refund_kopeks / 100 : null, refundReason: o.refund_reason as string | null,
  }));
  const byTier = (await db.query(`
    SELECT price_kopeks, count(*) FILTER (WHERE status IN ('paid','refunded','refund_required'))::int AS confirmed,
           count(*) FILTER (WHERE status='refunded')::int AS refunded,
           coalesce(sum(price_kopeks) FILTER (WHERE status IN ('paid','refunded','refund_required')),0)::bigint AS gross,
           coalesce(sum(refund_kopeks) FILTER (WHERE status='refunded'),0)::bigint AS refunds
      FROM career_shop_orders GROUP BY price_kopeks ORDER BY price_kopeks`)).rows.map((t) => ({
    priceRub: t.price_kopeks / 100, confirmed: t.confirmed, refunded: t.refunded, grossRub: Number(t.gross) / 100, netRub: (Number(t.gross) - Number(t.refunds)) / 100,
  }));
  const notifications = (await db.query("SELECT received_at, inv_id, outcome, out_sum FROM career_shop_notifications ORDER BY id DESC LIMIT 20")).rows.map((n) => ({
    at: iso(n.received_at)!, invId: n.inv_id ? Number(n.inv_id) : null, outcome: n.outcome as string, outSum: n.out_sum as string | null,
  }));
  return { orders, byTier, notifications };
}

export async function learning(db: Q) {
  const f = (await db.query(`
    WITH ap AS (${ACTIVE_PROGRESS})
    SELECT (SELECT count(DISTINCT account_id) FROM (SELECT account_id FROM career_events WHERE code='v3.diagnostic.opened'
                                                   UNION SELECT account_id FROM career_v3_diagnostics) s)::int AS dx_started,
           (SELECT count(DISTINCT account_id) FROM career_v3_diagnostics)::int AS dx_done,
           (SELECT count(*) FROM ap WHERE touched>0)::int AS learning_started,
           (SELECT count(*) FROM ap WHERE done=30)::int AS program_done`)).rows[0];
  const lessons = (await db.query(`
    WITH active AS (SELECT id FROM career_v3_plan_versions WHERE status='active')
    SELECT sp.lesson_id,
           count(*) FILTER (WHERE sp.state<>'not_started')::int AS started,
           count(*) FILTER (WHERE sp.state='done')::int AS done,
           (SELECT count(*) FROM career_v3_quiz_results q WHERE q.lesson_id=sp.lesson_id AND q.plan_version_id IN (SELECT id FROM active))::int AS quiz_takers,
           (SELECT count(*) FILTER (WHERE q.passed) FROM career_v3_quiz_results q WHERE q.lesson_id=sp.lesson_id AND q.plan_version_id IN (SELECT id FROM active))::int AS quiz_passed,
           (SELECT count(*) FILTER (WHERE q.passed AND q.attempts=1) FROM career_v3_quiz_results q WHERE q.lesson_id=sp.lesson_id AND q.plan_version_id IN (SELECT id FROM active))::int AS first_try,
           (SELECT round(avg(q.attempts),1) FROM career_v3_quiz_results q WHERE q.lesson_id=sp.lesson_id AND q.plan_version_id IN (SELECT id FROM active))::float AS avg_attempts
      FROM career_v3_step_progress sp WHERE sp.plan_version_id IN (SELECT id FROM active)
     GROUP BY sp.lesson_id ORDER BY sp.lesson_id`)).rows.map((l) => ({
    lessonId: l.lesson_id as string, started: l.started, done: l.done, quizTakers: l.quiz_takers, quizPassed: l.quiz_passed, firstTry: l.first_try, avgAttempts: l.avg_attempts,
  }));
  // Stop points: for learners who started but did not finish, the first step that is not done.
  const stops = (await db.query(`
    WITH active AS (SELECT pv.id, pv.account_id FROM career_v3_plan_versions pv WHERE pv.status='active'),
         first_open AS (
           SELECT DISTINCT ON (a.id) a.id, sp.position, sp.lesson_id, sp.state,
                  (SELECT max(updated_at) FROM career_v3_step_progress x WHERE x.plan_version_id=a.id) AS last_at
             FROM active a JOIN career_v3_step_progress sp ON sp.plan_version_id=a.id
            WHERE sp.state<>'done' AND EXISTS (SELECT 1 FROM career_v3_step_progress t WHERE t.plan_version_id=a.id AND t.state<>'not_started')
            ORDER BY a.id, sp.position)
    SELECT position, lesson_id, count(*)::int AS learners, count(*) FILTER (WHERE last_at < now()-interval '7 days')::int AS idle_7d
      FROM first_open GROUP BY position, lesson_id ORDER BY learners DESC, position LIMIT 15`)).rows.map((s) => ({
    position: s.position as number, lessonId: s.lesson_id as string, learners: s.learners, idle7d: s.idle_7d,
  }));
  return {
    funnel: { diagnosticStarted: f.dx_started, diagnosticDone: f.dx_done, learningStarted: f.learning_started, programDone: f.program_done },
    lessons, stops,
  };
}

export async function prices(db: Q) {
  await expireStale(db);
  const s = (await db.query("SELECT mode, manual_price_kopeks, updated_at, updated_by FROM commerce_price_settings WHERE id=1")).rows[0];
  return { quote: await quote(db), mode: s.mode as "auto" | "manual", manualPriceRub: s.manual_price_kopeks ? s.manual_price_kopeks / 100 : null, updatedAt: iso(s.updated_at), history: await priceHistory(db) };
}
