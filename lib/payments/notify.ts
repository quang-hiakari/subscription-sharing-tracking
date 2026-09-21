import { parseAdminEmails } from '@/lib/auth/allowed-emails';
import { buildPaymentRejectedEmail, buildPaymentSubmittedEmail } from '@/lib/email/payment-emails';
import { sendMail } from '@/lib/email/send-mail';
import type { Currency } from '@/lib/db-schema';

// Best-effort emails around payments. A mail failure is logged but never fails the action:
// the payment state is already saved and the admin still sees it in the queue.

const appUrl = () => process.env.APP_URL ?? '';

/** Tells every admin that a member reported a payment for this membership. */
export async function notifyPaymentSubmitted(db: D1Database, membershipId: number): Promise<void> {
  try {
    const row = await db
      .prepare(
        `SELECT p.months_covered, p.amount, p.note, m.name AS member_name, m.email AS member_email,
                s.name AS subscription_name, s.currency
         FROM payments p
         JOIN memberships ms ON ms.id = p.membership_id
         JOIN members m ON m.id = ms.member_id
         JOIN subscriptions s ON s.id = ms.subscription_id
         WHERE p.membership_id = ? AND p.status = 'pending'`,
      )
      .bind(membershipId)
      .first<{
        months_covered: number;
        amount: number;
        note: string | null;
        member_name: string;
        member_email: string;
        subscription_name: string;
        currency: Currency;
      }>();
    if (!row) return;

    const { subject, html } = buildPaymentSubmittedEmail({
      memberName: row.member_name,
      memberEmail: row.member_email,
      subscriptionName: row.subscription_name,
      currency: row.currency,
      monthsCovered: row.months_covered,
      amount: row.amount,
      note: row.note,
      appUrl: appUrl(),
    });
    for (const to of parseAdminEmails(process.env.ADMIN_EMAILS)) await sendMail({ to, subject, html });
  } catch (err) {
    console.error('[notify] payment submitted:', err instanceof Error ? err.message : err);
  }
}

/** Tells the member their reported payment was rejected, with the admin's reason. */
export async function notifyPaymentRejected(db: D1Database, paymentId: number): Promise<void> {
  try {
    const row = await db
      .prepare(
        `SELECT p.reject_reason, m.name AS member_name, m.email AS member_email, s.name AS subscription_name
         FROM payments p
         JOIN memberships ms ON ms.id = p.membership_id
         JOIN members m ON m.id = ms.member_id
         JOIN subscriptions s ON s.id = ms.subscription_id
         WHERE p.id = ? AND p.status = 'rejected'`,
      )
      .bind(paymentId)
      .first<{ reject_reason: string | null; member_name: string; member_email: string; subscription_name: string }>();
    if (!row) return;

    const { subject, html } = buildPaymentRejectedEmail({
      memberName: row.member_name,
      subscriptionName: row.subscription_name,
      reason: row.reject_reason ?? '',
      appUrl: appUrl(),
    });
    await sendMail({ to: row.member_email, subject, html });
  } catch (err) {
    console.error('[notify] payment rejected:', err instanceof Error ? err.message : err);
  }
}
