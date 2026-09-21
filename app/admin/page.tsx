import Link from 'next/link';
import { FxNote, Money } from '@/components/money';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import type { Currency } from '@/lib/db-schema';
import { sumByCurrency, totalInVnd } from '@/lib/fx/convert';
import { todayJst } from '@/lib/format/date';
import { formatMoney } from '@/lib/format/money';
import { countPendingPayments, listAttention, listMemberships } from '@/lib/queries/admin';
import { getFx } from '@/lib/queries/fx';

export const runtime = 'edge';

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  const [attention, pending, active, fx] = await Promise.all([
    listAttention(todayJst()),
    countPendingPayments(),
    listMemberships(false),
    getFx(),
  ]);

  // What paying members owe per month in total (family members owe nothing).
  const monthly = sumByCurrency(
    active.filter((m) => !m.isFamily).map((m) => ({ currency: m.currency as Currency, amount: m.monthlyShare })),
  );

  return (
    <>
      <PageHeader title="Tổng quan" />
      <p className="mb-4 text-sm text-gray-500">{user.email}</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">Thanh toán chờ duyệt</div>
          <div className="text-2xl font-semibold">{pending}</div>
          {pending > 0 && (
            <Link href="/admin/payments" className="text-sm text-blue-700 hover:underline">Xem và xác nhận</Link>
          )}
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">Tổng cần thu mỗi tháng (không tính người nhà)</div>
          <div className="mt-1 space-y-0.5 text-lg font-semibold">
            {monthly.JPY > 0 && <div>{formatMoney(monthly.JPY, 'JPY')}</div>}
            {monthly.VND > 0 && <div>{formatMoney(monthly.VND, 'VND')}</div>}
            {monthly.JPY === 0 && monthly.VND === 0 && <div>0</div>}
          </div>
          {fx && monthly.JPY > 0 && monthly.VND > 0 && (
            <div className="mt-1 text-sm text-gray-500">≈ {formatMoney(totalInVnd(monthly, fx.rate), 'VND')} tổng cộng</div>
          )}
        </div>
      </div>

      <h2 className="mb-2 font-medium">Cần chú ý</h2>
      {attention.length === 0 ? (
        <EmptyState>Không có ai quá hạn hoặc sắp đến hạn.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Người</th>
              <th className={th}>Subscription</th>
              <th className={th}>Đến hạn</th>
              <th className={th}>Mỗi tháng</th>
              <th className={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {attention.map((r) => (
              <tr key={r.id}>
                <td className={td}>
                  <Link href={`/admin/memberships/${r.id}`} className="font-medium text-blue-700 hover:underline">{r.memberName}</Link>
                </td>
                <td className={td}>{r.subscriptionName}</td>
                <td className={td}>{r.paidThrough}</td>
                <td className={td}><Money amount={r.monthlyShare} currency={r.currency as Currency} fx={fx} /></td>
                <td className={td}><StatusBadge status={r.status} daysUntilDue={r.daysUntilDue} /></td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <div className="mt-4">
        <FxNote fx={fx} />
      </div>
    </>
  );
}
