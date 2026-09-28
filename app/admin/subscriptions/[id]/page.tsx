import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { FxNote, Money } from '@/components/money';
import { StatusBadge } from '@/components/status-badge';
import { Badge, Card, EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import type { Currency } from '@/lib/db-schema';
import { todayJst } from '@/lib/format/date';
import { addMemberToSubscription } from '@/app/admin/memberships/actions';
import { getSubscription, listAccounts, listAvailableMembersForSubscription, listMemberships } from '@/lib/queries/admin';
import { getFx } from '@/lib/queries/fx';
import { membershipStatus } from '@/lib/queries/membership-status';
import { deleteSubscription, updateSubscription } from '../actions';
import { SubscriptionFields } from '../subscription-fields';
import { AddMemberForm } from './add-member-form';

export const runtime = 'edge';

export default async function EditSubscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ archived?: string }>;
}) {
  await requireAdmin();
  const id = Number((await params).id);
  const subscription = Number.isInteger(id) ? await getSubscription(id) : null;
  if (!subscription) notFound();

  const showArchived = (await searchParams).archived === '1';
  const [accounts, members, availableMembers, fx] = await Promise.all([
    listAccounts(),
    listMemberships(showArchived, id),
    listAvailableMembersForSubscription(id),
    getFx(),
  ]);
  const currency = subscription.currency as Currency;
  const today = todayJst();

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={`Sửa subscription: ${subscription.name}`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Thông tin subscription">
          <ActionForm action={updateSubscription.bind(null, id)} submitLabel="Lưu">
            <SubscriptionFields accounts={accounts} defaults={subscription} />
          </ActionForm>
        </Card>

        <Card title="Thêm thành viên">
          <ActionForm action={addMemberToSubscription.bind(null, id)} submitLabel="Thêm thành viên">
            <AddMemberForm availableMembers={availableMembers} paidThrough={today} />
          </ActionForm>
        </Card>
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Thành viên</h2>
          {showArchived ? (
            <Link href={`/admin/subscriptions/${id}`} className="text-sm text-blue-700 hover:underline">Ẩn các mục đã ẩn</Link>
          ) : (
            <Link href={`/admin/subscriptions/${id}?archived=1`} className="text-sm text-blue-700 hover:underline">Hiện cả mục đã ẩn</Link>
          )}
        </div>
        {members.length === 0 ? (
          <EmptyState>Chưa có ai trong subscription này.</EmptyState>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>Người</th>
                <th className={th}>Mỗi tháng</th>
                <th className={th}>Đến hạn</th>
                <th className={th}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const { status, daysUntilDue } = membershipStatus(m, today);
                const hidden = m.archived || m.memberArchived;
                return (
                  <tr key={m.id} className={hidden ? 'text-gray-400' : undefined}>
                    <td className={td}>
                      <Link href={`/admin/memberships/${m.id}`} className="font-medium text-blue-700 hover:underline">{m.memberName}</Link>
                    </td>
                    <td className={td}><Money amount={m.monthlyShare} currency={currency} fx={fx} /></td>
                    <td className={td}>{m.paidThrough}</td>
                    <td className={td}>{hidden ? <Badge>Đã ẩn</Badge> : <StatusBadge status={status} daysUntilDue={daysUntilDue} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
        <div className="mt-3">
          <FxNote fx={fx} />
        </div>
      </Card>

      <Card>
        <ActionForm
          action={deleteSubscription.bind(null, id)}
          submitLabel="Xoá subscription"
          variant="danger"
          confirmMessage="Xoá subscription này?"
        />
      </Card>
    </div>
  );
}
