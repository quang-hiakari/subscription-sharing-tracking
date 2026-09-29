'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-role';
import { getDrizzle } from '@/lib/db';
import { paymentAccounts } from '@/lib/db-schema';
import type { FormState } from '@/lib/form-state';
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

export async function updateAccount(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(paymentAccountSchema, formData);
  if ('error' in parsed) return { error: parsed.error };

  const existing = await getAccount(id);
  if (!existing) return { error: 'Không tìm thấy tài khoản.' };

  await getDrizzle().update(paymentAccounts).set(parsed.data).where(eq(paymentAccounts.id, id));
  redirect(LIST);
}

export async function deleteAccount(id: number, _prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAdmin();
  if ((await countSubscriptionsForAccount(id)) > 0) {
    return { error: 'Không xoá được: còn subscription đang dùng tài khoản này.' };
  }
  await getDrizzle().delete(paymentAccounts).where(eq(paymentAccounts.id, id));
  redirect(LIST);
}
