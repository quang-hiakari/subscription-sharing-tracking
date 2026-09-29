import { ActionForm } from '@/components/action-form';
import { Money } from '@/components/money';
import { PaymentAccountDetails } from '@/components/payment-account-details';
import { PaymentFields } from '@/components/payment-fields';
import { PaymentHistory, PaymentStatusBadge } from '@/components/payment-history';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/ui/page-parts';
import { requireMember } from '@/lib/auth/require-role';
import type { BillingCycle, Currency } from '@/lib/db-schema';
import { todayJst } from '@/lib/format/date';
import { getMyMemberships } from '@/lib/queries/payments';
import { membershipStatus } from '@/lib/queries/membership-status';
import { requestPayment } from './actions';

export const runtime = 'edge';

// Members see exactly the amount the admin entered, in the subscription's own currency — no FX
// "≈" conversion (that's an admin-only reference; the account may even be in another currency).
export default async function MePage() {
  const user = await requireMember();
  const items = await getMyMemberships(user.memberId);
  const today = todayJst();

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Thanh toán của tôi</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <form action="/logout" method="post">
          <button type="submit" className="text-sm text-gray-500 hover:text-blue-700">Đăng xuất</button>
        </form>
      </header>

      {items.length === 0 && <EmptyState>Bạn chưa tham gia subscription nào.</EmptyState>}

      {items.map((item) => {
        const currency = item.currency as Currency;
        const billingCycle = item.billingCycle as BillingCycle;
        const cycleWord = billingCycle === 'yearly' ? 'năm' : 'tháng';
        const { status, daysUntilDue } = membershipStatus(item, today);
        const pending = item.payments.find((p) => p.status === 'pending');

        return (
          <section key={item.id} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{item.subscriptionName}</h2>
              <StatusBadge status={status} daysUntilDue={daysUntilDue} />
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-gray-500">Mỗi {cycleWord}</dt>
              <dd className="font-medium"><Money amount={item.monthlyShare} currency={currency} fx={null} /></dd>
              {!item.isFamily && (
                <>
                  <dt className="text-gray-500">Hạn tiếp theo</dt>
                  <dd className="font-medium">{item.paidThrough}</dd>
                </>
              )}
            </dl>

            {!item.isFamily && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-500">Chuyển tiền tới</h3>
                <PaymentAccountDetails
                  account={{
                    currency,
                    bankName: item.accountBankName,
                    branchName: item.accountBranchName,
                    accountNumber: item.accountNumber,
                    accountHolderName: item.accountHolderName,
                    qrImagePath: item.accountQrImagePath,
                  }}
                />
              </div>
            )}

            {item.isFamily ? (
              <p className="text-sm text-gray-500">Bạn là người nhà nên không cần thanh toán.</p>
            ) : pending ? (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                Bạn đã báo thanh toán {pending.monthsCovered} {cycleWord} (<Money amount={pending.amount} currency={currency} fx={null} />) và đang chờ xác nhận. <PaymentStatusBadge status="pending" />
              </p>
            ) : (
              <details className="rounded-md border border-gray-200 p-3">
                <summary className="cursor-pointer text-sm font-medium text-blue-700">Tôi đã chuyển tiền</summary>
                <div className="mt-3">
                  <ActionForm action={requestPayment.bind(null, item.id)} submitLabel="Báo đã trả">
                    <PaymentFields monthlyShare={item.monthlyShare} currencyLabel={currency} billingCycle={billingCycle} />
                  </ActionForm>
                </div>
              </details>
            )}

            <div>
              <h3 className="mb-2 text-sm font-medium">Lịch sử thanh toán</h3>
              <PaymentHistory rows={item.payments} currency={currency} fx={null} billingCycle={billingCycle} />
            </div>
          </section>
        );
      })}
    </main>
  );
}
