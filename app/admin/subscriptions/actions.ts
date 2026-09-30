'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-role';
import { getDrizzle } from '@/lib/db';
import { members, memberships, subscriptionPaymentAccounts, subscriptions } from '@/lib/db-schema';
import { formId, type FormState } from '@/lib/form-state';
import { countMembershipsForSubscription, emailTaken, getMember, getSubscription, listAccounts, membershipExists } from '@/lib/queries/admin';
import { addMemberToSubscriptionSchema, parseForm, subscriptionSchema } from '@/lib/validation/schemas';

const LIST = '/admin/subscriptions';

/** Returns an error message when any chosen account does not exist. An account's own currency
 * (which country-format bank fields it has) need not match the subscription's billing currency —
 * e.g. a subscription billed in VND can pay into a JPY account; members see both, per account. */
async function accountsProblem(paymentAccountIds: number[]): Promise<string | null> {
  const validIds = new Set((await listAccounts()).map((a) => a.id));
  return paymentAccountIds.every((id) => validIds.has(id)) ? null : 'Tài khoản nhận tiền không tồn tại.';
}

/** Replaces a subscription's linked accounts in one batch (delete-all then insert-set). */
async function setAccountLinks(subscriptionId: number, paymentAccountIds: number[]) {
  const db = await getDrizzle();
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

  const [row] = await (await getDrizzle()).insert(subscriptions).values(values).returning({ id: subscriptions.id });
  await setAccountLinks(row.id, paymentAccountIds);
  redirect(LIST);
}

export async function updateSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formId(formData);
  if (!id) return { error: 'Không tìm thấy subscription.' };
  const parsed = parseForm(subscriptionSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const existing = await getSubscription(id);
  if (!existing) return { error: 'Không tìm thấy subscription.' };
  const { paymentAccountIds, ...values } = parsed.data;
  // The subscription's currency is only its own cost; each member's share carries its own
  // currency, so changing this does not rewrite what anyone owes.
  const problem = await accountsProblem(paymentAccountIds);
  if (problem) return { error: problem };

  await (await getDrizzle()).update(subscriptions).set(values).where(eq(subscriptions.id, id));
  await setAccountLinks(id, paymentAccountIds);
  redirect(LIST);
}

export async function deleteSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formId(formData);
  if (!id) return { error: 'Không tìm thấy subscription.' };
  if ((await countMembershipsForSubscription(id)) > 0) {
    return { error: 'Không xoá được: subscription đã có thành viên (kể cả đã ẩn).' };
  }
  await (await getDrizzle()).delete(subscriptions).where(eq(subscriptions.id, id));
  redirect(LIST);
}

/** Adds a member to a subscription: an existing member (by id) or a brand-new one (name + email), in one step.
 * Lives here (not in memberships/actions.ts) since its only caller is this subscription's own detail page. */
export async function addMemberToSubscription(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const subscriptionId = formId(formData);
  if (!subscriptionId) return { error: 'Subscription không tồn tại.' };
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
    const [row] = await (await getDrizzle())
      .insert(members)
      .values({ name: parsed.data.name, email: parsed.data.email })
      .returning({ id: members.id });
    memberId = row.id;
  }

  if (await membershipExists(memberId, subscriptionId)) {
    return { error: 'Người này đã có trong subscription này (có thể đang bị ẩn).' };
  }

  await (await getDrizzle()).insert(memberships).values({
    memberId,
    subscriptionId,
    currency: parsed.data.currency,
    monthlyShare: parsed.data.monthlyShare,
    isFamily: parsed.data.isFamily,
    paidThrough: parsed.data.paidThrough,
  });
  redirect(`/admin/subscriptions/${subscriptionId}`);
}
