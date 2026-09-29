import { Badge, TableWrap, td, th } from '@/components/ui/page-parts';
import type { BillingCycle, Currency } from '@/lib/db-schema';
import { todayJst } from '@/lib/format/date';
import { Money } from '@/components/money';
import type { FxRate } from '@/lib/fx/rates';

export interface HistoryRow {
  id: number;
  monthsCovered: number;
  amount: number;
  status: string;
  note: string | null;
  rejectReason: string | null;
  createdAt: Date;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <Badge tone="green">Đã xác nhận</Badge>;
  if (status === 'rejected') return <Badge tone="red">Bị từ chối</Badge>;
  return <Badge tone="amber">Chờ xác nhận</Badge>;
}

/** Dates are shown as JST calendar days, matching due dates. */
export function PaymentHistory({
  rows,
  currency,
  fx,
  billingCycle = 'monthly',
}: {
  rows: HistoryRow[];
  currency: Currency;
  fx: FxRate | null;
  billingCycle?: BillingCycle;
}) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">Chưa có thanh toán nào.</p>;
  const cycleWord = billingCycle === 'yearly' ? 'năm' : 'tháng';
  return (
    <TableWrap>
      <thead>
        <tr>
          <th className={th}>Ngày báo</th>
          <th className={th}>Số {cycleWord}</th>
          <th className={th}>Số tiền</th>
          <th className={th}>Trạng thái</th>
          <th className={th}>Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id}>
            <td className={td}>{todayJst(p.createdAt)}</td>
            <td className={td}>{p.monthsCovered}</td>
            <td className={td}><Money amount={p.amount} currency={currency} fx={fx} /></td>
            <td className={td}>
              <PaymentStatusBadge status={p.status} />
              {p.status === 'rejected' && p.rejectReason && <div className="mt-1 text-xs text-red-700">{p.rejectReason}</div>}
            </td>
            <td className={td}>{p.note}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}
