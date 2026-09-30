'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-role';
import { getDrizzle } from '@/lib/db';
import { paymentAccounts } from '@/lib/db-schema';
import { formId, type FormState } from '@/lib/form-state';
import { countSubscriptionsForAccount, getAccount } from '@/lib/queries/admin';
import { parseForm, paymentAccountSchema } from '@/lib/validation/schemas';

const LIST = '/admin/accounts';

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(paymentAccountSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  await getDrizzle().insert(paymentAccounts).values(parsed.data);
  redirect(LIST);
}

export async function updateAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formId(formData);
  if (!id) return { error: 'Không tìm thấy tài khoản.' };
  const parsed = parseForm(paymentAccountSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const existing = await getAccount(id);
  if (!existing) return { error: 'Không tìm thấy tài khoản.' };

  await getDrizzle().update(paymentAccounts).set(parsed.data).where(eq(paymentAccounts.id, id));
  redirect(LIST);
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formId(formData);
  if (!id) return { error: 'Không tìm thấy tài khoản.' };
  if ((await countSubscriptionsForAccount(id)) > 0) {
    return { error: 'Không xoá được: còn subscription đang dùng tài khoản này.' };
  }
  await getDrizzle().delete(paymentAccounts).where(eq(paymentAccounts.id, id));
  redirect(LIST);
}
