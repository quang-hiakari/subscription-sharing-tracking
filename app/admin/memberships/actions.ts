'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-role';
import { getDrizzle, getDB } from '@/lib/db';
import { members, memberships, reminderLog } from '@/lib/db-schema';
import type { FormState } from '@/lib/form-state';
import { countPaymentsForMembership, emailTaken, getMember, getMembership, getSubscription, membershipExists } from '@/lib/queries/admin';
import { sendMail } from '@/lib/email/send-mail';
import { recordPayment } from '@/lib/payments/service';
import { sendManualReminder } from '@/lib/reminders/run';
import { addMemberToSubscriptionSchema, membershipUpdateSchema, parseForm, paymentInputSchema } from '@/lib/validation/schemas';

// Per-membership detail page (history, reminder, record payment). There is no membership list
// page anymore — membership management lives on the owning subscription's detail page.
const DETAIL = '/admin/memberships';

/** Emails this member a payment reminder right now (logged as `manual`; the daily cron will not repeat it today). */
export async function sendReminderNow(id: number, _prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAdmin();
  const result = await sendManualReminder(
    { db: getDB(), send: sendMail, appUrl: process.env.APP_URL ?? '', now: new Date() },
    id,
  );
  if (!result.ok) return { error: result.error };
  redirect(`${DETAIL}/${id}`);
}

/** Admin records money received outside the app (cash, bank transfer): approved at once, due date moves. */
export async function recordMembershipPayment(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(paymentInputSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const result = await recordPayment(getDB(), { membershipId: id, ...parsed.data }, new Date());
  if (!result.ok) return { error: result.error };
  redirect(`${DETAIL}/${id}`);
}

/** Adds a member to a subscription: an existing member (by id) or a brand-new one (name + email), in one step. */
export async function addMemberToSubscription(subscriptionId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(addMemberToSubscriptionSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const subscription = await getSubscription(subscriptionId);
  if (!subscription) return { error: 'Subscription không tồn tại.' };

  let memberId: number;
  if (parsed.data.mode === 'existing') {
    const member = await getMember(parsed.data.memberId);
    if (!member) return { error: 'Người dùng không tồn tại.' };
    if (member.archived) return { error: 'Người dùng đã bị ẩn. Hãy bỏ ẩn trước.' };
    memberId = member.id;
  } else {
    if (await emailTaken(parsed.data.email)) return { error: 'Email này đã được dùng cho người khác.' };
    const [row] = await getDrizzle()
      .insert(members)
      .values({ name: parsed.data.name, email: parsed.data.email })
      .returning({ id: members.id });
    memberId = row.id;
  }

  if (await membershipExists(memberId, subscriptionId)) {
    return { error: 'Người này đã có trong subscription này (có thể đang bị ẩn).' };
  }

  await getDrizzle()
    .insert(memberships)
    .values({ memberId, subscriptionId, monthlyShare: parsed.data.monthlyShare, isFamily: parsed.data.isFamily, paidThrough: parsed.data.paidThrough });
  redirect(`/admin/subscriptions/${subscriptionId}`);
}

export async function updateMembership(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(membershipUpdateSchema, formData);
  if ('error' in parsed) return { error: parsed.error };
  if (!(await getMembership(id))) return { error: 'Không tìm thấy thành viên trong subscription.' };

  await getDrizzle().update(memberships).set(parsed.data).where(eq(memberships.id, id));
  redirect(`${DETAIL}/${id}`);
}

/** Hard delete only when there is no payment history (reminder log entries go with it); otherwise archive. */
export async function deleteMembership(id: number, _prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAdmin();
  if ((await countPaymentsForMembership(id)) > 0) {
    return { error: 'Đã có lịch sử thanh toán. Hãy dùng "Ẩn" thay vì xoá.' };
  }
  // Fetch before deleting: the detail page for this id 404s once the row is gone, so we need
  // somewhere else to send the admin — back to the subscription that owned it.
  const membership = await getMembership(id);
  if (!membership) return { error: 'Không tìm thấy thành viên trong subscription.' };

  const db = getDrizzle();
  await db.batch([
    db.delete(reminderLog).where(eq(reminderLog.membershipId, id)),
    db.delete(memberships).where(eq(memberships.id, id)),
  ]);
  redirect(`/admin/subscriptions/${membership.subscriptionId}`);
}

/** Archived memberships are hidden from the member, skipped by reminders and the dashboard; history is kept. */
export async function setMembershipArchived(
  id: number,
  archived: boolean,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  if (!(await getMembership(id))) return { error: 'Không tìm thấy thành viên trong subscription.' };
  await getDrizzle().update(memberships).set({ archived }).where(eq(memberships.id, id));
  redirect(`${DETAIL}/${id}`);
}
