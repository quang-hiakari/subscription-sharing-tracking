'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-role';
import { getDrizzle } from '@/lib/db';
import { subscriptionPaymentAccounts, subscriptions } from '@/lib/db-schema';
import type { FormState } from '@/lib/form-state';
import { countMembershipsForSubscription, getSubscription, listAccounts } from '@/lib/queries/admin';
import { parseForm, subscriptionSchema } from '@/lib/validation/schemas';

const LIST = '/admin/subscriptions';

/** Returns an error message when any chosen account does not exist. An account's own currency
 * (which country-format bank fields it has) need not match the subscription's billing currency —
 * e.g. a subscription billed in VND can pay into a JPY account; members see both, per account. */
async function accountsProblem(paymentAccountIds: number[]): Promise<string | null> {
  const validIds = new Set((await listAccounts()).map((a) => a.id));
  return paymentAccountIds.every((id) => validIds.has(id)) ? null : 'Tài khoản nhận tiền không tồn tại.';
}

/** Replaces a subscription's linked accounts in one batch (delete-all then insert-set). */
function setAccountLinks(subscriptionId: number, paymentAccountIds: number[]) {
  const db = getDrizzle();
  return db.batch([
    db.delete(subscriptionPaymentAccounts).where(eq(subscriptionPaymentAccounts.subscriptionId, subscriptionId)),
    db.insert(subscriptionPaymentAccounts).values(paymentAccountIds.map((paymentAccountId) => ({ subscriptionId, paymentAccountId }))),
  ]);
}

export async function createSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(subscriptionSchema, formData);
  if ('error' in parsed) return { error: parsed.error };
  const { paymentAccountIds, ...values } = parsed.data;
  const problem = await accountsProblem(paymentAccountIds);
  if (problem) return { error: problem };

  const [row] = await getDrizzle().insert(subscriptions).values(values).returning({ id: subscriptions.id });
  await setAccountLinks(row.id, paymentAccountIds);
  redirect(LIST);
}

export async function updateSubscription(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(subscriptionSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const existing = await getSubscription(id);
  if (!existing) return { error: 'Không tìm thấy subscription.' };
  const { paymentAccountIds, ...values } = parsed.data;
  // The subscription's currency is only its own cost; each member's share carries its own
  // currency, so changing this does not rewrite what anyone owes.
  const problem = await accountsProblem(paymentAccountIds);
  if (problem) return { error: problem };

  await getDrizzle().update(subscriptions).set(values).where(eq(subscriptions.id, id));
  await setAccountLinks(id, paymentAccountIds);
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
