'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-role';
import { getDB } from '@/lib/db';
import { formId, type FormState } from '@/lib/form-state';
import { notifyPaymentRejected } from '@/lib/payments/notify';
import { approvePayment, rejectPayment } from '@/lib/payments/service';
import { approvePaymentSchema, parseForm, rejectSchema } from '@/lib/validation/schemas';

const QUEUE = '/admin/payments';

export async function approve(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const paymentId = formId(formData, 'paymentId');
  if (!paymentId) return { error: 'Không tìm thấy thanh toán.' };
  const parsed = parseForm(approvePaymentSchema, formData);
  if ('error' in parsed) return { error: parsed.error };
  const result = await approvePayment(getDB(), paymentId, new Date(), parsed.data.monthsOverride ?? undefined);
  if (!result.ok) return { error: result.error };
  redirect(QUEUE);
}

export async function reject(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const paymentId = formId(formData, 'paymentId');
  if (!paymentId) return { error: 'Không tìm thấy thanh toán.' };
  const parsed = parseForm(rejectSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const db = getDB();
  const result = await rejectPayment(db, paymentId, parsed.data.reason, new Date());
  if (!result.ok) return { error: result.error };
  await notifyPaymentRejected(db, paymentId);
  redirect(QUEUE);
}
