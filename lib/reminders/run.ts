import type { BillingCycle, Currency } from '../db-schema';
import type { Mail } from '../email/resend';
import { buildReminderEmail } from '../email/reminder-email';
import { amountIn } from '../fx/convert';
import { latestRate, type FxRate } from '../fx/rates';
import { daysBetween, todayJst } from '../format/date';
import { formatPaymentOptions, type PaymentOption } from '../format/payment-account';
import { computeBulkPeriodsReference } from '../format/subscription-reference';
import type { ServiceResult } from '../payments/service';
import { dueReminderKind } from './compute';

// Reminder sending, shared by the cron Worker (all due reminders) and the admin's
// "send now" button (one membership). Depends only on D1 and an injected `send`,
// so tests run it on real SQLite. Relative imports only: the Worker bundles this file.

export interface ReminderDeps {
  db: D1Database;
  send: (mail: Mail) => Promise<void>;
  /** Public base URL used for links in emails. */
  appUrl: string;
  now: Date;
}

export interface RunSummary {
  sent: number;
  /** Due but intentionally not emailed (a payment is pending, or the admin already nudged today). */
  skipped: number;
  failed: number;
}

interface Candidate {
  id: number;
  monthly_share: number;
  is_family: number;
  paid_through: string;
  archived: number;
  member_archived: number;
  member_name: string;
  member_email: string;
  subscription_id: number;
  subscription_name: string;
  billing_cycle: BillingCycle;
  currency: Currency;
  remind_days_before: number | null;
  has_pending: number;
  manual_today: number;
}

interface AccountRow {
  subscription_id: number;
  currency: Currency;
  bank_name: string;
  branch_name: string | null;
  account_number: string;
  account_holder_name: string;
  qr_image_path: string | null;
}

// The single bind parameter is the start of today (JST) in epoch ms, for `manual_today`.
const CANDIDATE_SQL = `
  SELECT ms.id, ms.monthly_share, ms.currency, ms.is_family, ms.paid_through, ms.archived, m.archived AS member_archived,
         m.name AS member_name, m.email AS member_email,
         s.id AS subscription_id, s.name AS subscription_name, s.billing_cycle, s.remind_days_before,
         EXISTS (SELECT 1 FROM payments p WHERE p.membership_id = ms.id AND p.status = 'pending') AS has_pending,
         EXISTS (SELECT 1 FROM reminder_log r WHERE r.membership_id = ms.id AND r.kind = 'manual' AND r.sent_at >= ?) AS manual_today
  FROM memberships ms
  JOIN members m ON m.id = ms.member_id
  JOIN subscriptions s ON s.id = ms.subscription_id`;

const startOfDayJstMs = (today: string) => Date.parse(`${today}T00:00:00+09:00`);

/** All payment accounts for a set of subscriptions, grouped by subscription id (a subscription
 * can have more than one, e.g. a JPY e-wallet and a VND bank account). */
async function loadAccountsBySubscription(db: D1Database, subscriptionIds: number[]): Promise<Map<number, AccountRow[]>> {
  const map = new Map<number, AccountRow[]>();
  if (subscriptionIds.length === 0) return map;
  const placeholders = subscriptionIds.map(() => '?').join(', ');
  const { results } = await db
    .prepare(
      `SELECT spa.subscription_id, pa.currency, pa.bank_name, pa.branch_name, pa.account_number, pa.account_holder_name, pa.qr_image_path
       FROM subscription_payment_accounts spa
       JOIN payment_accounts pa ON pa.id = spa.payment_account_id
       WHERE spa.subscription_id IN (${placeholders})
       ORDER BY pa.currency, pa.bank_name`,
    )
    .bind(...subscriptionIds)
    .all<AccountRow>();
  for (const r of results) map.set(r.subscription_id, [...(map.get(r.subscription_id) ?? []), r]);
  return map;
}

function reminderMail(c: Candidate, today: string, appUrl: string, accounts: AccountRow[], fx: FxRate | null): Mail {
  const options: PaymentOption[] = accounts.map((a) => ({
    currency: a.currency,
    amount: amountIn(c.monthly_share, c.currency, a.currency, fx),
    account: {
      bankName: a.bank_name,
      branchName: a.branch_name,
      accountNumber: a.account_number,
      accountHolderName: a.account_holder_name,
      qrImagePath: a.qr_image_path,
    },
  }));

  const { subject, html } = buildReminderEmail({
    memberName: c.member_name,
    subscriptionName: c.subscription_name,
    currency: c.currency,
    billingCycle: c.billing_cycle,
    monthlyShare: c.monthly_share,
    dueDate: c.paid_through,
    daysUntilDue: daysBetween(today, c.paid_through),
    accountDetails: formatPaymentOptions(options).join('\n'),
    appUrl,
    bulkReference: c.billing_cycle === 'monthly' ? computeBulkPeriodsReference(c.monthly_share) : null,
  });
  return { to: c.member_email, subject, html };
}

/**
 * Sends every reminder that is due today (JST). Safe to run repeatedly: each (membership, due date,
 * kind) is claimed in `reminder_log` before sending, so a rerun, overlap or retry never double-sends,
 * and a failed send releases its claim so the next run tries again.
 */
export async function runReminders({ db, send, appUrl, now }: ReminderDeps): Promise<RunSummary> {
  const today = todayJst(now);
  const summary: RunSummary = { sent: 0, skipped: 0, failed: 0 };

  const { results } = await db
    .prepare(`${CANDIDATE_SQL} WHERE ms.archived = 0 AND m.archived = 0 AND ms.is_family = 0`)
    .bind(startOfDayJstMs(today))
    .all<Candidate>();

  const [fx, accountsBySubscription] = await Promise.all([
    latestRate(db),
    loadAccountsBySubscription(db, [...new Set(results.map((c) => c.subscription_id))]),
  ]);

  for (const c of results) {
    const kind = dueReminderKind(
      { isFamily: Boolean(c.is_family), paidThrough: c.paid_through, remindDaysBefore: c.remind_days_before },
      today,
    );
    if (!kind) continue;

    // They already told us they paid; do not nag while the admin reviews it. Nothing is claimed,
    // so the reminder resumes if the payment is rejected.
    if (c.has_pending) {
      summary.skipped++;
      continue;
    }

    const claim = await db
      .prepare('INSERT OR IGNORE INTO reminder_log (membership_id, due_date, kind, sent_at) VALUES (?, ?, ?, ?)')
      .bind(c.id, c.paid_through, kind, now.getTime())
      .run();
    if (claim.meta.changes === 0) continue; // already sent for this due date

    // The admin nudged them today: count this milestone as done without a second email.
    if (c.manual_today) {
      summary.skipped++;
      continue;
    }

    try {
      await send(reminderMail(c, today, appUrl, accountsBySubscription.get(c.subscription_id) ?? [], fx));
      summary.sent++;
    } catch (err) {
      await db
        .prepare('DELETE FROM reminder_log WHERE membership_id = ? AND due_date = ? AND kind = ?')
        .bind(c.id, c.paid_through, kind)
        .run();
      summary.failed++;
      console.error(`[reminders] membership ${c.id} ${kind}:`, err instanceof Error ? err.message : err);
    }
  }
  return summary;
}

/** The admin's "send now": one reminder for one membership, logged as `manual` (may repeat). */
export async function sendManualReminder(deps: ReminderDeps, membershipId: number): Promise<ServiceResult> {
  const { db, send, appUrl, now } = deps;
  const today = todayJst(now);

  const c = await db
    .prepare(`${CANDIDATE_SQL} WHERE ms.id = ?`)
    .bind(startOfDayJstMs(today), membershipId)
    .first<Candidate>();
  if (!c || c.archived || c.member_archived) return { ok: false, error: 'Không tìm thấy thành viên trong subscription.' };
  if (c.is_family) return { ok: false, error: 'Người nhà không cần nhắc thanh toán.' };

  const [fx, accountsBySubscription] = await Promise.all([latestRate(db), loadAccountsBySubscription(db, [c.subscription_id])]);

  try {
    await send(reminderMail(c, today, appUrl, accountsBySubscription.get(c.subscription_id) ?? [], fx));
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Không gửi được email.' };
  }
  await db
    .prepare("INSERT INTO reminder_log (membership_id, due_date, kind, sent_at) VALUES (?, ?, 'manual', ?)")
    .bind(c.id, c.paid_through, now.getTime())
    .run();
  return { ok: true };
}
