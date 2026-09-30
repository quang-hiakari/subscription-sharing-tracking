import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { Card, PageHeader } from '@/components/ui/page-parts';
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
    <div className="max-w-2xl space-y-6">
      <PageHeader title={`Sửa: ${member.name}`} />
      <Card>
        <ActionForm action={updateMember} submitLabel="Lưu" hidden={{ id }}>
          <MemberFields defaults={member} />
        </ActionForm>
      </Card>

      <Card>
        <div className="space-y-3">
          {member.archived ? (
            <ActionForm action={setMemberArchived} submitLabel="Bỏ ẩn" variant="secondary" hidden={{ id, archived: 'false' }} />
          ) : (
            <ActionForm
              action={setMemberArchived}
              submitLabel="Ẩn người này"
              variant="secondary"
              confirmMessage="Ẩn người này? Họ sẽ không đăng nhập được và không bị nhắc nữa."
              hidden={{ id, archived: 'true' }}
            />
          )}
          {hasHistory ? (
            <p className="text-xs text-gray-500">Đã có subscription/lịch sử nên không xoá được, chỉ ẩn.</p>
          ) : (
            <ActionForm
              action={deleteMember}
              submitLabel="Xoá người này"
              variant="danger"
              confirmMessage="Xoá người này?"
              hidden={{ id }}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
