import { ActionForm } from '@/components/action-form';
import { Card, PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { createMember } from '../actions';
import { MemberFields } from '../member-fields';

export const runtime = 'edge';

export default async function NewMemberPage() {
  await requireAdmin();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Thêm người dùng" />
      <Card>
        <ActionForm action={createMember} submitLabel="Lưu">
          <MemberFields />
        </ActionForm>
      </Card>
    </div>
  );
}
