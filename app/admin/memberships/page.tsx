import Link from 'next/link';
import { FxNote, Money } from '@/components/money';
import { Badge, EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import type { Currency } from '@/lib/db-schema';
import { todayJst } from '@/lib/format/date';
import { listMemberships } from '@/lib/queries/admin';
import { getFx } from '@/lib/queries/fx';
import { membershipStatus } from '@/lib/queries/membership-status';
import { StatusBadge } from '@/components/status-badge';

export const runtime = 'edge';

export default async function MembershipsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  await requireAdmin();
  const showArchived = (await searchParams).archived === '1';
  const [rows, fx] = await Promise.all([listMemberships(showArchived), getFx()]);
  const today = todayJst();

  return (
    <>
      <PageHeader title="Thành viên trong subscription" action={{ href: '/admin/memberships/new', label: 'Thêm thành viên' }} />
      <p className="mb-3 text-sm">
        {showArchived ? (
          <Link href="/admin/memberships" className="text-blue-700 hover:underline">Ẩn các mục đã ẩn</Link>
        ) : (
          <Link href="/admin/memberships?archived=1" className="text-blue-700 hover:underline">Hiện cả mục đã ẩn</Link>
        )}
      </p>
      {rows.length === 0 ? (
        <EmptyState>Chưa có thành viên nào trong subscription.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Subscription</th>
              <th className={th}>Người</th>
              <th className={th}>Mỗi tháng</th>
              <th className={th}>Đến hạn</th>
              <th className={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const { status, daysUntilDue } = membershipStatus(r, today);
              const hidden = r.archived || r.memberArchived;
              return (
                <tr key={r.id} className={hidden ? 'text-gray-400' : undefined}>
                  <td className={td}>{r.subscriptionName}</td>
                  <td className={td}>
                    <Link href={`/admin/memberships/${r.id}`} className="font-medium text-blue-700 hover:underline">{r.memberName}</Link>
                  </td>
                  <td className={td}><Money amount={r.monthlyShare} currency={r.currency as Currency} fx={fx} /></td>
                  <td className={td}>{r.paidThrough}</td>
                  <td className={td}>
                    {hidden ? <Badge>Đã ẩn</Badge> : <StatusBadge status={status} daysUntilDue={daysUntilDue} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
      <div className="mt-4">
        <FxNote fx={fx} />
      </div>
    </>
  );
}
