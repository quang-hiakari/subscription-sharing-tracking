'use server';

import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/auth/require-role';
import { getDB } from '@/lib/db';
import { formId, type FormState } from '@/lib/form-state';
import { notifyPaymentSubmitted } from '@/lib/payments/notify';
import { createPaymentRequest } from '@/lib/payments/service';
import { parseForm, paymentInputSchema } from '@/lib/validation/schemas';

/** A member reports that they paid; an admin then approves or rejects it. */
export async function requestPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  // Ownership of `membershipId` is enforced by the service against this member's id, not by the client.
  const membershipId = formId(formData, 'membershipId');
  if (!membershipId) return { error: 'Không tìm thấy subscription.' };
  const user = await requireMember();
  const parsed = parseForm(paymentInputSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const db = await getDB();
  const result = await createPaymentRequest(db, user.memberId, { membershipId, ...parsed.data }, new Date());
  if (!result.ok) return { error: result.error };
  await notifyPaymentSubmitted(db, membershipId);
  redirect('/me');
}
