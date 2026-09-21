import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { SelectField } from '@/components/ui/fields';
import { EmptyState, PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { todayJst } from '@/lib/format/date';
import { listMembers, listSubscriptions } from '@/lib/queries/admin';
import { createMembership } from '../actions';
import { MembershipTermsFields } from '../membership-fields';

export const runtime = 'edge';

export default async function NewMembershipPage() {
  await requireAdmin();
  const [allMembers, subs] = await Promise.all([listMembers(), listSubscriptions()]);
  const members = allMembers.filter((m) => !m.archived);

  if (members.length === 0 || subs.length === 0) {
    return (
      <EmptyState>
        Cần có ít nhất một <Link href="/admin/members/new" className="text-blue-700 underline">người dùng</Link> và một{' '}
        <Link href="/admin/subscriptions/new" className="text-blue-700 underline">subscription</Link>.
      </EmptyState>
    );
  }

  return (
    <div className="max-w-md">
      <PageHeader title="Thêm thành viên vào subscription" />
      <ActionForm action={createMembership} submitLabel="Lưu">
        <SelectField label="Người" name="memberId" options={members.map((m) => ({ value: m.id, label: `${m.name} (${m.email})` }))} />
        <SelectField
          label="Subscription"
          name="subscriptionId"
          options={subs.map((s) => ({ value: s.id, label: `${s.name} (${s.currency})` }))}
        />
        <MembershipTermsFields defaults={{ paidThrough: todayJst() }} />
      </ActionForm>
    </div>
  );
}
