import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { PaymentFields } from '@/components/payment-fields';
import { PaymentHistory } from '@/components/payment-history';
import { Card, PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import type { BillingCycle, Currency } from '@/lib/db-schema';
import { todayJst } from '@/lib/format/date';
import { countPaymentsForMembership, getMembership, listRemindersForMembership } from '@/lib/queries/admin';
import { getFx } from '@/lib/queries/fx';
import { listPaymentsForMembership } from '@/lib/queries/payments';
import { deleteMembership, recordMembershipPayment, sendReminderNow, setMembershipArchived, updateMembership } from '../actions';
import { MembershipTermsFields } from '../membership-fields';

export const dynamic = 'force-dynamic';

function reminderLabel(kind: string): string {
  if (kind === 'manual') return 'Gửi tay';
  if (kind === 't-minus') return 'Trước hạn';
  if (kind === 't0') return 'Đến hạn';
  return `Quá hạn (lần ${kind.replace('overdue-', '')})`;
}

export default async function EditMembershipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const membership = Number.isInteger(id) ? await getMembership(id) : null;
  if (!membership) notFound();
  const hasPayments = (await countPaymentsForMembership(id)) > 0;
  const history = await listPaymentsForMembership(id);
  const reminders = await listRemindersForMembership(id);
  const fx = await getFx();
  const currency = membership.currency as Currency;
  const billingCycle = membership.billingCycle as BillingCycle;
  const canPay = !membership.isFamily && !membership.archived;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={`${membership.memberName} · ${membership.subscriptionName}`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Thông tin">
          <ActionForm action={updateMembership} submitLabel="Lưu" hidden={{ id }}>
            <MembershipTermsFields defaults={membership} billingCycle={billingCycle} />
          </ActionForm>
        </Card>

        {canPay && (
          <Card>
            <div>
              <h2 className="mb-3 font-medium">Ghi nhận thanh toán đã nhận</h2>
              <ActionForm action={recordMembershipPayment} submitLabel="Ghi nhận" hidden={{ id }}>
                <PaymentFields monthlyShare={membership.monthlyShare} currencyLabel={currency} billingCycle={billingCycle} />
              </ActionForm>
            </div>

            <div className="mt-6 space-y-3 border-t border-gray-200 pt-4">
              <h2 className="font-medium">Nhắc thanh toán</h2>
              <ActionForm
                action={sendReminderNow}
                submitLabel="Gửi nhắc ngay"
                variant="secondary"
                confirmMessage={`Gửi email nhắc tới ${membership.memberEmail}?`}
                hidden={{ id }}
              />
              {reminders.length > 0 && (
                <ul className="text-sm text-gray-600">
                  {reminders.map((r) => (
                    <li key={r.id}>
                      {todayJst(r.sentAt)} · {reminderLabel(r.kind)} · hạn {r.dueDate}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        )}
      </div>

      <Card title="Lịch sử thanh toán">
        <PaymentHistory rows={history} currency={currency} fx={fx} billingCycle={billingCycle} />
      </Card>

      <Card>
        <div className="flex flex-wrap gap-3">
          {membership.archived ? (
            <ActionForm action={setMembershipArchived} submitLabel="Bỏ ẩn" variant="secondary" hidden={{ id, archived: 'false' }} />
          ) : (
            <ActionForm
              action={setMembershipArchived}
              submitLabel="Ẩn khỏi subscription"
              variant="secondary"
              confirmMessage="Ẩn mục này? Sẽ không còn nhắc và không hiện cho thành viên."
              hidden={{ id, archived: 'true' }}
            />
          )}
          {hasPayments ? (
            <p className="self-center text-xs text-gray-500">Đã có lịch sử thanh toán nên không xoá được, chỉ ẩn.</p>
          ) : (
            <ActionForm
              action={deleteMembership}
              submitLabel="Xoá"
              variant="danger"
              confirmMessage="Xoá mục này?"
              hidden={{ id }}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
