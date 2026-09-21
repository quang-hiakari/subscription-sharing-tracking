'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-role';
import { getDrizzle } from '@/lib/db';
import { members } from '@/lib/db-schema';
import type { FormState } from '@/lib/form-state';
import { countMembershipsForMember, emailTaken, getMember } from '@/lib/queries/admin';
import { memberSchema, parseForm } from '@/lib/validation/schemas';

const LIST = '/admin/members';
const EMAIL_TAKEN = 'Email này đã được dùng cho người khác.';

export async function createMember(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(memberSchema, formData);
  if ('error' in parsed) return { error: parsed.error };
  if (await emailTaken(parsed.data.email)) return { error: EMAIL_TAKEN };

  await getDrizzle().insert(members).values(parsed.data);
  redirect(LIST);
}

export async function updateMember(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(memberSchema, formData);
  if ('error' in parsed) return { error: parsed.error };
  if (!(await getMember(id))) return { error: 'Không tìm thấy người dùng.' };
  if (await emailTaken(parsed.data.email, id)) return { error: EMAIL_TAKEN };

  await getDrizzle().update(members).set(parsed.data).where(eq(members.id, id));
  redirect(LIST);
}

/** Hard delete is only for members that never joined a subscription; otherwise archive. */
export async function deleteMember(id: number, _prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAdmin();
  if ((await countMembershipsForMember(id)) > 0) {
    return { error: 'Người này đã có subscription/lịch sử. Hãy dùng "Ẩn" thay vì xoá.' };
  }
  await getDrizzle().delete(members).where(eq(members.id, id));
  redirect(LIST);
}

/** Archived members cannot log in and are skipped by reminders; history is kept. */
export async function setMemberArchived(
  id: number,
  archived: boolean,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  if (!(await getMember(id))) return { error: 'Không tìm thấy người dùng.' };
  await getDrizzle().update(members).set({ archived }).where(eq(members.id, id));
  redirect(LIST);
}
