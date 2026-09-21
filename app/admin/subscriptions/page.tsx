import Link from 'next/link';
import { FxNote, Money } from '@/components/money';
import { EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import type { Currency } from '@/lib/db-schema';
import { listSubscriptions } from '@/lib/queries/admin';
import { getFx } from '@/lib/queries/fx';
import { DEFAULT_REMIND_DAYS_BEFORE } from '@/lib/reminders/constants';

export const runtime = 'edge';

export default async function SubscriptionsPage() {
  await requireAdmin();
  const [subs, fx] = await Promise.all([listSubscriptions(), getFx()]);

  return (
    <>
      <PageHeader title="Subscription" action={{ href: '/admin/subscriptions/new', label: 'Thêm subscription' }} />
      {subs.length === 0 ? (
        <EmptyState>Chưa có subscription nào.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Tên</th>
              <th className={th}>Giá / tháng</th>
              <th className={th}>Nhận tiền</th>
              <th className={th}>Nhắc trước</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id}>
                <td className={td}>
                  <Link href={`/admin/subscriptions/${s.id}`} className="font-medium text-blue-700 hover:underline">{s.name}</Link>
                </td>
                <td className={td}><Money amount={s.pricePerMonth} currency={s.currency as Currency} fx={fx} /></td>
                <td className={td}>{s.accountLabel}</td>
                <td className={td}>{s.remindDaysBefore ?? DEFAULT_REMIND_DAYS_BEFORE} ngày</td>
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
