'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-role';
import { getDrizzle } from '@/lib/db';
import { memberships, reminderLog } from '@/lib/db-schema';
import type { FormState } from '@/lib/form-state';
import { countPaymentsForMembership, getMember, getMembership, getSubscription, membershipExists } from '@/lib/queries/admin';
import { sendMail } from '@/lib/email/send-mail';
import { recordPayment } from '@/lib/payments/service';
import { sendManualReminder } from '@/lib/reminders/run';
import { getDB } from '@/lib/db';
import { membershipCreateSchema, membershipUpdateSchema, parseForm, paymentInputSchema } from '@/lib/validation/schemas';

const LIST = '/admin/memberships';

/** Emails this member a payment reminder right now (logged as `manual`; the daily cron will not repeat it today). */
export async function sendReminderNow(id: number, _prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAdmin();
  const result = await sendManualReminder(
    { db: getDB(), send: sendMail, appUrl: process.env.APP_URL ?? '', now: new Date() },
    id,
  );
  if (!result.ok) return { error: result.error };
  redirect(`${LIST}/${id}`);
}

/** Admin records money received outside the app (cash, bank transfer): approved at once, due date moves. */
export async function recordMembershipPayment(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(paymentInputSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const result = await recordPayment(getDB(), { membershipId: id, ...parsed.data }, new Date());
  if (!result.ok) return { error: result.error };
  redirect(`${LIST}/${id}`);
}

export async function createMembership(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(membershipCreateSchema, formData);
  if ('error' in parsed) return { error: parsed.error };
  const { memberId, subscriptionId } = parsed.data;

  const [member, subscription] = await Promise.all([getMember(memberId), getSubscription(subscriptionId)]);
  if (!member) return { error: 'Người dùng không tồn tại.' };
  if (member.archived) return { error: 'Người dùng đã bị ẩn. Hãy bỏ ẩn trước.' };
  if (!subscription) return { error: 'Subscription không tồn tại.' };
  if (await membershipExists(memberId, subscriptionId)) {
    return { error: 'Người này đã có trong subscription này (có thể đang bị ẩn).' };
  }

  await getDrizzle().insert(memberships).values(parsed.data);
  redirect(LIST);
}

export async function updateMembership(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(membershipUpdateSchema, formData);
  if ('error' in parsed) return { error: parsed.error };
  if (!(await getMembership(id))) return { error: 'Không tìm thấy thành viên trong subscription.' };

  await getDrizzle().update(memberships).set(parsed.data).where(eq(memberships.id, id));
  redirect(LIST);
}

/** Hard delete only when there is no payment history (reminder log entries go with it); otherwise archive. */
export async function deleteMembership(id: number, _prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAdmin();
  if ((await countPaymentsForMembership(id)) > 0) {
    return { error: 'Đã có lịch sử thanh toán. Hãy dùng "Ẩn" thay vì xoá.' };
  }
  const db = getDrizzle();
  await db.batch([
    db.delete(reminderLog).where(eq(reminderLog.membershipId, id)),
    db.delete(memberships).where(eq(memberships.id, id)),
  ]);
  redirect(LIST);
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
  redirect(LIST);
}
