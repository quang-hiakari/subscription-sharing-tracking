import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { countMembershipsForMember, getMember } from '@/lib/queries/admin';
import { deleteMember, setMemberArchived, updateMember } from '../actions';
import { MemberFields } from '../member-fields';

export const runtime = 'edge';

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const member = Number.isInteger(id) ? await getMember(id) : null;
  if (!member) notFound();
  const hasHistory = (await countMembershipsForMember(id)) > 0;

  return (
    <div className="max-w-md space-y-8">
      <div>
        <PageHeader title={`Sửa: ${member.name}`} />
        <ActionForm action={updateMember.bind(null, id)} submitLabel="Lưu">
          <MemberFields defaults={member} />
        </ActionForm>
      </div>

      <div className="space-y-3 border-t border-gray-200 pt-4">
        {member.archived ? (
          <ActionForm action={setMemberArchived.bind(null, id, false)} submitLabel="Bỏ ẩn" variant="secondary" />
        ) : (
          <ActionForm
            action={setMemberArchived.bind(null, id, true)}
            submitLabel="Ẩn người này"
            variant="secondary"
            confirmMessage="Ẩn người này? Họ sẽ không đăng nhập được và không bị nhắc nữa."
          />
        )}
        {hasHistory ? (
          <p className="text-xs text-gray-500">Đã có subscription/lịch sử nên không xoá được, chỉ ẩn.</p>
        ) : (
          <ActionForm
            action={deleteMember.bind(null, id)}
            submitLabel="Xoá người này"
            variant="danger"
            confirmMessage="Xoá người này?"
          />
        )}
      </div>
    </div>
  );
}
