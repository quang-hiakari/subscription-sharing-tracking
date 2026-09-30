'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-role';
import { getDrizzle, getDB } from '@/lib/db';
import { memberships, reminderLog } from '@/lib/db-schema';
import { formId, type FormState } from '@/lib/form-state';
import { countPaymentsForMembership, getMembership } from '@/lib/queries/admin';
import { sendMail } from '@/lib/email/send-mail';
import { recordPayment } from '@/lib/payments/service';
import { sendManualReminder } from '@/lib/reminders/run';
import { membershipUpdateSchema, parseForm, paymentInputSchema } from '@/lib/validation/schemas';

// Per-membership detail page (history, reminder, record payment). There is no membership list
// page anymore — membership management lives on the owning subscription's detail page.
const DETAIL = '/admin/memberships';

/** Emails this member a payment reminder right now (logged as `manual`; the daily cron will not repeat it today). */
export async function sendReminderNow(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formId(formData);
  if (!id) return { error: 'Không tìm thấy thành viên trong subscription.' };
  const result = await sendManualReminder(
    { db: await getDB(), send: sendMail, appUrl: process.env.APP_URL ?? '', now: new Date() },
    id,
  );
  if (!result.ok) return { error: result.error };
  redirect(`${DETAIL}/${id}`);
}

/** Admin records money received outside the app (cash, bank transfer): approved at once, due date moves. */
export async function recordMembershipPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formId(formData);
  if (!id) return { error: 'Không tìm thấy thành viên trong subscription.' };
  const parsed = parseForm(paymentInputSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const result = await recordPayment(await getDB(), { membershipId: id, ...parsed.data }, new Date());
  if (!result.ok) return { error: result.error };
  redirect(`${DETAIL}/${id}`);
}

export async function updateMembership(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formId(formData);
  if (!id) return { error: 'Không tìm thấy thành viên trong subscription.' };
  const parsed = parseForm(membershipUpdateSchema, formData);
  if ('error' in parsed) return { error: parsed.error };
  if (!(await getMembership(id))) return { error: 'Không tìm thấy thành viên trong subscription.' };

  await (await getDrizzle()).update(memberships).set(parsed.data).where(eq(memberships.id, id));
  // Called both from this membership's own page (no returnTo, stays here) and from the quick-edit
  // popup on its subscription's page (returnTo set, so saving closes the popup and stays there).
  const returnTo = formData.get('returnTo');
  redirect(typeof returnTo === 'string' && returnTo ? returnTo : `${DETAIL}/${id}`);
}

/** Hard delete only when there is no payment history (reminder log entries go with it); otherwise archive. */
export async function deleteMembership(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formId(formData);
  if (!id) return { error: 'Không tìm thấy thành viên trong subscription.' };
  if ((await countPaymentsForMembership(id)) > 0) {
    return { error: 'Đã có lịch sử thanh toán. Hãy dùng "Ẩn" thay vì xoá.' };
  }
  // Fetch before deleting: the detail page for this id 404s once the row is gone, so we need
  // somewhere else to send the admin — back to the subscription that owned it.
  const membership = await getMembership(id);
  if (!membership) return { error: 'Không tìm thấy thành viên trong subscription.' };

  const db = await getDrizzle();
  await db.batch([
    db.delete(reminderLog).where(eq(reminderLog.membershipId, id)),
    db.delete(memberships).where(eq(memberships.id, id)),
  ]);
  redirect(`/admin/subscriptions/${membership.subscriptionId}`);
}

/** Archived memberships are hidden from the member, skipped by reminders and the dashboard; history is kept. */
export async function setMembershipArchived(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formId(formData);
  if (!id) return { error: 'Không tìm thấy thành viên trong subscription.' };
  if (!(await getMembership(id))) return { error: 'Không tìm thấy thành viên trong subscription.' };
  await (await getDrizzle()).update(memberships).set({ archived: formData.get('archived') === 'true' }).where(eq(memberships.id, id));
  redirect(`${DETAIL}/${id}`);
}
