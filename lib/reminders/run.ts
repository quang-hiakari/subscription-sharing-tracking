import type { Currency } from '../db-schema';
import type { Mail } from '../email/resend';
import { buildReminderEmail } from '../email/reminder-email';
import { daysBetween, todayJst } from '../format/date';
import { formatAccountLines } from '../format/payment-account';
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
  subscription_name: string;
  currency: Currency;
  remind_days_before: number | null;
  account_bank_name: string;
  account_branch_name: string | null;
  account_number: string;
  account_holder_name: string;
  account_qr_image_path: string | null;
  has_pending: number;
  manual_today: number;
}

// The single bind parameter is the start of today (JST) in epoch ms, for `manual_today`.
const CANDIDATE_SQL = `
  SELECT ms.id, ms.monthly_share, ms.currency, ms.is_family, ms.paid_through, ms.archived, m.archived AS member_archived,
         m.name AS member_name, m.email AS member_email,
         s.name AS subscription_name, s.remind_days_before,
         pa.bank_name AS account_bank_name, pa.branch_name AS account_branch_name,
         pa.account_number AS account_number, pa.account_holder_name AS account_holder_name,
         pa.qr_image_path AS account_qr_image_path,
         EXISTS (SELECT 1 FROM payments p WHERE p.membership_id = ms.id AND p.status = 'pending') AS has_pending,
         EXISTS (SELECT 1 FROM reminder_log r WHERE r.membership_id = ms.id AND r.kind = 'manual' AND r.sent_at >= ?) AS manual_today
  FROM memberships ms
  JOIN members m ON m.id = ms.member_id
  JOIN subscriptions s ON s.id = ms.subscription_id
  JOIN payment_accounts pa ON pa.id = s.payment_account_id`;

const startOfDayJstMs = (today: string) => Date.parse(`${today}T00:00:00+09:00`);

function reminderMail(c: Candidate, today: string, appUrl: string): Mail {
  const { subject, html } = buildReminderEmail({
    memberName: c.member_name,
    subscriptionName: c.subscription_name,
    currency: c.currency,
    monthlyShare: c.monthly_share,
    dueDate: c.paid_through,
    daysUntilDue: daysBetween(today, c.paid_through),
    accountDetails: formatAccountLines({
      bankName: c.account_bank_name,
      branchName: c.account_branch_name,
      accountNumber: c.account_number,
      accountHolderName: c.account_holder_name,
      qrImagePath: c.account_qr_image_path,
    }).join('\n'),
    appUrl,
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
      await send(reminderMail(c, today, appUrl));
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

  try {
    await send(reminderMail(c, today, appUrl));
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Không gửi được email.' };
  }
  await db
    .prepare("INSERT INTO reminder_log (membership_id, due_date, kind, sent_at) VALUES (?, ?, 'manual', ?)")
    .bind(c.id, c.paid_through, now.getTime())
    .run();
  return { ok: true };
}
