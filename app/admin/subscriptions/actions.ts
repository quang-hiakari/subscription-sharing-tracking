'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-role';
import { getDrizzle } from '@/lib/db';
import { subscriptions } from '@/lib/db-schema';
import type { FormState } from '@/lib/form-state';
import { countMembershipsForSubscription, getAccount, getSubscription } from '@/lib/queries/admin';
import { parseForm, subscriptionSchema } from '@/lib/validation/schemas';

const LIST = '/admin/subscriptions';

type SubscriptionInput = typeof subscriptions.$inferInsert;

/** Returns an error message when the chosen account does not exist. The account's own currency
 * (which country-format bank fields it has) need not match the subscription's billing currency —
 * e.g. a subscription billed in VND can pay into a JPY account; members see both via FX display. */
async function accountProblem(input: Pick<SubscriptionInput, 'paymentAccountId'>): Promise<string | null> {
  const account = await getAccount(input.paymentAccountId);
  if (!account) return 'Tài khoản nhận tiền không tồn tại.';
  return null;
}

export async function createSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(subscriptionSchema, formData);
  if ('error' in parsed) return { error: parsed.error };
  const problem = await accountProblem(parsed.data);
  if (problem) return { error: problem };

  await getDrizzle().insert(subscriptions).values(parsed.data);
  redirect(LIST);
}

export async function updateSubscription(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(subscriptionSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const existing = await getSubscription(id);
  if (!existing) return { error: 'Không tìm thấy subscription.' };
  // Member shares are stored in the subscription's currency; changing it would silently rewrite their meaning.
  if (existing.currency !== parsed.data.currency && (await countMembershipsForSubscription(id)) > 0) {
    return { error: 'Không đổi được loại tiền khi đã có thành viên trong subscription này.' };
  }
  const problem = await accountProblem(parsed.data);
  if (problem) return { error: problem };

  await getDrizzle().update(subscriptions).set(parsed.data).where(eq(subscriptions.id, id));
  redirect(LIST);
}

export async function deleteSubscription(id: number, _prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAdmin();
  if ((await countMembershipsForSubscription(id)) > 0) {
    return { error: 'Không xoá được: subscription đã có thành viên (kể cả đã ẩn).' };
  }
  await getDrizzle().delete(subscriptions).where(eq(subscriptions.id, id));
  redirect(LIST);
}
