import { ActionForm } from '@/components/action-form';
import { PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { createMember } from '../actions';
import { MemberFields } from '../member-fields';

export const runtime = 'edge';

export default async function NewMemberPage() {
  await requireAdmin();
  return (
    <div className="max-w-md">
      <PageHeader title="Thêm người dùng" />
      <ActionForm action={createMember} submitLabel="Lưu">
        <MemberFields />
      </ActionForm>
    </div>
  );
}
