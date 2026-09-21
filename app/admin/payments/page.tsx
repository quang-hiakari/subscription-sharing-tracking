import { ActionForm } from '@/components/action-form';
import { FxNote, Money } from '@/components/money';
import { PaymentStatusBadge } from '@/components/payment-history';
import { Field } from '@/components/ui/fields';
import { EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import type { Currency } from '@/lib/db-schema';
import { addMonths, todayJst } from '@/lib/format/date';
import { getFx } from '@/lib/queries/fx';
import { listPendingPayments, listRecentDecidedPayments } from '@/lib/queries/payments';
import { approve, reject } from './actions';

export const runtime = 'edge';

export default async function PaymentsPage() {
  await requireAdmin();
  const [pending, decided, fx] = await Promise.all([listPendingPayments(), listRecentDecidedPayments(), getFx()]);

  return (
    <>
      <PageHeader title="Thanh toán" />

      <h2 className="mb-2 font-medium">Chờ xác nhận ({pending.length})</h2>
      {pending.length === 0 ? (
        <EmptyState>Không có thanh toán nào đang chờ.</EmptyState>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => {
            const currency = p.currency as Currency;
            return (
              <div key={p.id} className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-medium">{p.memberName}</span> · {p.subscriptionName}
                    <div className="text-xs text-gray-500">{p.memberEmail} · báo ngày {todayJst(p.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold"><Money amount={p.amount} currency={currency} fx={fx} /></div>
                    <div className="text-xs text-gray-500">{p.monthsCovered} tháng</div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Hạn hiện tại {p.paidThrough} → sau khi xác nhận: <span className="font-medium">{addMonths(p.paidThrough, p.monthsCovered)}</span>
                </div>
                {p.note && <div className="text-sm">Ghi chú: {p.note}</div>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <ActionForm action={approve.bind(null, p.id)} submitLabel="Xác nhận đã nhận tiền" />
                  <ActionForm action={reject.bind(null, p.id)} submitLabel="Từ chối" variant="secondary">
                    <Field label="Lý do từ chối" name="reason" required maxLength={200} />
                  </ActionForm>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-2 mt-8 font-medium">Đã xử lý gần đây</h2>
      {decided.length === 0 ? (
        <EmptyState>Chưa có.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Ngày</th>
              <th className={th}>Người</th>
              <th className={th}>Subscription</th>
              <th className={th}>Số tháng</th>
              <th className={th}>Số tiền</th>
              <th className={th}>Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {decided.map((p) => (
              <tr key={p.id}>
                <td className={td}>{p.decidedAt ? todayJst(p.decidedAt) : ''}</td>
                <td className={td}>{p.memberName}</td>
                <td className={td}>{p.subscriptionName}</td>
                <td className={td}>{p.monthsCovered}</td>
                <td className={td}><Money amount={p.amount} currency={p.currency as Currency} fx={fx} /></td>
                <td className={td}>
                  <PaymentStatusBadge status={p.status} />
                  {p.rejectReason && <div className="mt-1 text-xs text-red-700">{p.rejectReason}</div>}
                </td>
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
